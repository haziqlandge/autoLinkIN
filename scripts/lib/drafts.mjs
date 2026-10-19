// Draft folders, the history log and the per-project pointer file.
import { mkdirSync, existsSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readProjectFile } from './eligibility.mjs';

export const STATUSES = ['drafting', 'approved', 'posted', 'abandoned'];

export const VOICE_TEMPLATE = `# LinkedIn voice notes

Learned from the owner's edits to autoLinkIN drafts. Entries are dated; merge and prune them so this stays short.

## Rules learned from edits

## Phrases to avoid
`;

export function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function historyFile(draftsDir) {
  return join(draftsDir, 'history.jsonl');
}

export function appendHistory(draftsDir, entry) {
  mkdirSync(draftsDir, { recursive: true });
  appendFileSync(historyFile(draftsDir), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

export function setStatus(draftsDir, id, status, extra = {}) {
  if (!STATUSES.includes(status)) throw new Error(`unknown status "${status}"; use one of ${STATUSES.join(', ')}`);
  appendHistory(draftsDir, { id, status, ...extra });
}

export function readHistory(draftsDir) {
  let raw = '';
  try { raw = readFileSync(historyFile(draftsDir), 'utf8'); } catch { return []; }
  const byId = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry?.id) continue;
    byId.set(entry.id, { ...(byId.get(entry.id) || {}), ...entry });
  }
  return [...byId.values()];
}

function excludeFile(projectRoot) {
  try {
    const rel = execFileSync('git', ['-C', projectRoot, 'rev-parse', '--git-path', 'info/exclude'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true,
    }).trim();
    return resolve(projectRoot, rel);
  } catch {
    return null;
  }
}

export function updatePointer(projectRoot, draftDir) {
  const data = readProjectFile(projectRoot);
  const drafts = Array.isArray(data.drafts) ? data.drafts : [];
  if (!drafts.includes(draftDir)) drafts.push(draftDir);
  writeFileSync(join(projectRoot, '.autolinkin'), `${JSON.stringify({ ...data, drafts }, null, 2)}\n`);
  const exclude = excludeFile(projectRoot);
  if (!exclude) return;
  let text = '';
  try { text = readFileSync(exclude, 'utf8'); } catch { /* new file */ }
  if (text.split(/\r?\n/).some((l) => l.trim() === '.autolinkin')) return;
  mkdirSync(dirname(exclude), { recursive: true });
  appendFileSync(exclude, `${text && !text.endsWith('\n') ? '\n' : ''}.autolinkin\n`);
}

export function createDraft(draftsDir, { projectRoot, title, date = todayISO() }) {
  const base = `${date}-${slugify(basename(projectRoot)) || 'project'}-${slugify(title) || 'draft'}`;
  let id = base;
  for (let n = 2; existsSync(join(draftsDir, id)); n += 1) id = `${base}-${n}`;
  const dir = join(draftsDir, id);
  mkdirSync(join(dir, 'media'), { recursive: true });
  appendHistory(draftsDir, { id, project: projectRoot, date, title, status: 'drafting' });
  updatePointer(projectRoot, dir);
  return { id, dir };
}
