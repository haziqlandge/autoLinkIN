import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

export function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'autolinkin-'));
}

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function makeRepo() {
  const root = tmpDir();
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.name', 'Test']);
  git(root, ['config', 'user.email', 'test@example.com']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  return root;
}

let counter = 0;
export function commit(root, msg) {
  counter += 1;
  writeFileSync(join(root, `file-${counter}.txt`), `${msg}\n`);
  git(root, ['add', '-A']);
  git(root, ['commit', '-q', '-m', msg]);
  return git(root, ['rev-parse', 'HEAD']);
}

export function runHook(scriptPath, input, env = {}) {
  const stdin = typeof input === 'string' ? input : JSON.stringify(input);
  const cleanEnv = { ...process.env };
  for (const key of Object.keys(cleanEnv)) {
    if (key.startsWith('CLAUDE_PLUGIN_OPTION_')) delete cleanEnv[key];
  }
  const res = spawnSync(process.execPath, [scriptPath], {
    input: stdin,
    encoding: 'utf8',
    env: { ...cleanEnv, ...env },
  });
  return { code: res.status, stdout: res.stdout.trim() };
}
