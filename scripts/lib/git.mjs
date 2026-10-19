// Read-only git queries. Every function returns null or [] on any git error.
import { execFileSync } from 'node:child_process';

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  }).trim();
}

function tryGit(cwd, args) {
  try {
    return git(cwd, args);
  } catch {
    return null;
  }
}

export function repoRoot(cwd) {
  return tryGit(cwd, ['rev-parse', '--show-toplevel']) || null;
}

export function headSha(root) {
  return tryGit(root, ['rev-parse', '--verify', '-q', 'HEAD']) || null;
}

function isAncestor(root, sha) {
  try {
    git(root, ['merge-base', '--is-ancestor', sha, 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

function usableBase(root, sinceSha) {
  return sinceSha && isAncestor(root, sinceSha) ? sinceSha : null;
}

export function commitsSince(root, sinceSha, limit = 30) {
  if (!headSha(root)) return [];
  const base = usableBase(root, sinceSha);
  const range = base ? [`${base}..HEAD`] : ['HEAD'];
  const out = tryGit(root, ['log', `-n${limit}`, '--format=%H%x09%s', ...range]);
  if (!out) return [];
  return out.split('\n').filter(Boolean).map((line) => {
    const [sha, ...rest] = line.split('\t');
    return { sha, subject: rest.join('\t') };
  });
}

export function diffstat(root, sinceSha) {
  const base = usableBase(root, sinceSha);
  if (!base) return '';
  return tryGit(root, ['diff', '--shortstat', `${base}..HEAD`]) || '';
}

export function originUrl(root) {
  return tryGit(root, ['remote', 'get-url', 'origin']) || null;
}
