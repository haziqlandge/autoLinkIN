// Per-project state kept in <draftsDir>/state/projects.json.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULTS = Object.freeze({
  sinceSha: null,
  lastSeenSha: null,
  visibility: null,
  visibilityCheckedAt: null,
  firstMilestones: [],
});

export function projectKey(root) {
  const key = resolve(root).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? key.toLowerCase() : key;
}

function stateFile(draftsDir) {
  return join(draftsDir, 'state', 'projects.json');
}

export function readState(draftsDir) {
  try {
    const data = JSON.parse(readFileSync(stateFile(draftsDir), 'utf8'));
    if (data && typeof data.projects === 'object' && data.projects !== null) return data;
  } catch {
    // missing or corrupt: start fresh
  }
  return { projects: {} };
}

export function getProject(draftsDir, root) {
  const stored = readState(draftsDir).projects[projectKey(root)] || {};
  return { ...DEFAULTS, firstMilestones: [], ...stored };
}

export function updateProject(draftsDir, root, patch) {
  const state = readState(draftsDir);
  const key = projectKey(root);
  const next = { ...DEFAULTS, firstMilestones: [], ...(state.projects[key] || {}), ...patch };
  state.projects[key] = next;
  const file = stateFile(draftsDir);
  mkdirSync(join(draftsDir, 'state'), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, file);
  return next;
}
