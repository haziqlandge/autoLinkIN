// Which projects may get drafts: never private GitHub repos or NDA work,
// unless the project opts in through its .autolinkin file.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { originUrl } from './git.mjs';
import { getProject, updateProject } from './state.mjs';

const VISIBILITY_TTL_MS = 24 * 60 * 60 * 1000;

export function readProjectFile(root) {
  try {
    const data = JSON.parse(readFileSync(join(root, '.autolinkin'), 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function parseGithubRepo(url) {
  if (!url) return null;
  const m = String(url).trim().match(/github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function defaultGhVisibility(ownerRepo) {
  try {
    const out = execFileSync('gh', ['repo', 'view', ownerRepo, '--json', 'visibility', '--jq', '.visibility'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 8000,
      windowsHide: true,
    }).trim().toLowerCase();
    if (out === 'public') return 'public';
    if (out === 'private' || out === 'internal') return 'private';
  } catch {
    // gh missing, offline or no access
  }
  return null;
}

function visibilityFor(root, ownerRepo, { draftsDir, ghVisibility, now }) {
  const project = getProject(draftsDir, root);
  if (project.visibility && project.visibilityCheckedAt && now - project.visibilityCheckedAt < VISIBILITY_TTL_MS) {
    return project.visibility;
  }
  const visibility = ghVisibility(ownerRepo);
  if (visibility) updateProject(draftsDir, root, { visibility, visibilityCheckedAt: now });
  return visibility;
}

export function checkEligibility(root, { draftsDir, ghVisibility = defaultGhVisibility, now = Date.now() } = {}) {
  const flags = readProjectFile(root);
  if (flags.optIn === true) return { eligible: true, reason: 'opt-in' };
  if (flags.nda === true) return { eligible: false, reason: 'nda' };
  const ownerRepo = parseGithubRepo(originUrl(root));
  if (!ownerRepo) return { eligible: true, reason: 'no-remote' };
  const visibility = visibilityFor(root, ownerRepo, { draftsDir, ghVisibility, now });
  if (visibility === 'private') return { eligible: false, reason: 'private' };
  if (visibility === 'public') return { eligible: true, reason: 'public' };
  return { eligible: true, reason: 'unknown' };
}
