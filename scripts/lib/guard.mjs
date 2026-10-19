// Protected paths: nothing edits them without the owner seeing the change.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const WIN = process.platform === 'win32';
const PREVIEW_LIMIT = 4000;

function norm(p) {
  const out = resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return WIN ? out.toLowerCase() : out;
}

export function isProtectedPath(p, protectedPaths) {
  if (!p || !protectedPaths?.length) return false;
  const target = norm(p);
  return protectedPaths.some((base) => {
    const b = norm(base);
    return target === b || target.startsWith(`${b}/`);
  });
}

const WRITE_TOKENS = /(^|[^-=])>>?|\bsed\s+(-[a-z]*i|--in-place)|\btee\b|\bset-content\b|\badd-content\b|\bout-file\b|\b(mv|cp|rm|move-item|copy-item|remove-item|rename-item|new-item|del|erase|ren)\b/i;

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commandForms(base) {
  const b = norm(base);
  const forms = [b];
  const drive = b.match(/^([a-z]):\/(.*)$/i);
  if (drive) forms.push(`/${drive[1].toLowerCase()}/${drive[2]}`); // Git Bash style
  return forms;
}

export function shellWritesTo(cmd, protectedPaths) {
  if (typeof cmd !== 'string' || !protectedPaths?.length || !WRITE_TOKENS.test(cmd)) return false;
  const home = homedir().replace(/\\/g, '/');
  let text = cmd.replace(/\\+/g, '/')
    .replace(/(^|[\s"'=])~\//g, `$1${home}/`)
    .replace(/\$(home|env:userprofile)\//gi, `${home}/`);
  if (WIN) text = text.toLowerCase();
  return protectedPaths.some((base) => commandForms(base).some((form) => {
    const f = WIN ? form.toLowerCase() : form;
    return new RegExp(`${escapeRe(f)}(?=$|[/\\s"'\`;|&)])`).test(text);
  }));
}

function lineDiff(oldText, newText) {
  const a = oldText.split(/\r?\n/);
  const b = newText.split(/\r?\n/);
  if (a.length * b.length > 4_000_000) {
    return [...a.map((l) => `-${l}`), ...b.map((l) => `+${l}`)].join('\n');
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { i += 1; j += 1; }
    else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) { out.push(`+${b[j]}`); j += 1; }
    else { out.push(`-${a[i]}`); i += 1; }
  }
  return out.join('\n') || '(no line changes)';
}

function truncate(text) {
  return text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}\n...(truncated)` : text;
}

export function buildPreview(toolName, toolInput = {}, readFile = readFileSync) {
  const block = (oldS, newS) => `--- old\n${oldS ?? ''}\n+++ new\n${newS ?? ''}`;
  switch (toolName) {
    case 'Edit':
      return truncate(`Edit ${toolInput.file_path}\n${block(toolInput.old_string, toolInput.new_string)}`);
    case 'MultiEdit':
      return truncate(`MultiEdit ${toolInput.file_path}\n${(toolInput.edits || []).map((e) => block(e.old_string, e.new_string)).join('\n\n')}`);
    case 'Write': {
      let current = '';
      try { current = readFile(toolInput.file_path, 'utf8'); } catch { /* new file */ }
      return truncate(`Write ${toolInput.file_path}\n${lineDiff(current, toolInput.content ?? '')}`);
    }
    case 'NotebookEdit':
      return truncate(`NotebookEdit ${toolInput.notebook_path}\n${toolInput.new_source ?? ''}`);
    default:
      return truncate(`Command:\n${toolInput.command ?? ''}`);
  }
}
