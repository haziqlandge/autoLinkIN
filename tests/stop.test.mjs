import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { tmpDir, makeRepo, commit, runHook } from './helpers.mjs';
import { updateProject } from '../scripts/lib/state.mjs';

const STOP = fileURLToPath(new URL('../scripts/hooks/stop.mjs', import.meta.url));
const POST = fileURLToPath(new URL('../scripts/hooks/post-tool-use.mjs', import.meta.url));

test('fires once per new commit set and accumulates since sinceSha', () => {
  const d = tmpDir();
  const r = makeRepo();
  const env = { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d };
  assert.equal(runHook(STOP, { cwd: r, stop_hook_active: false }, env).stdout, '');
  commit(r, 'add export');
  const a = runHook(STOP, { cwd: r }, env).stdout;
  assert.match(a, /add export/);
  assert.equal(JSON.parse(a).hookSpecificOutput.hookEventName, 'Stop');
  assert.equal(runHook(STOP, { cwd: r }, env).stdout, '');
  commit(r, 'add import');
  const b = JSON.parse(runHook(STOP, { cwd: r }, env).stdout).hookSpecificOutput.additionalContext;
  assert.match(b, /add import/);
  assert.match(b, /add export/);
});

test('silent when stop_hook_active, outside repos, or after a milestone hook saw HEAD', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'x');
  const env = { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d };
  assert.equal(runHook(STOP, { cwd: r, stop_hook_active: true }, env).stdout, '');
  assert.equal(runHook(STOP, { cwd: tmpDir() }, env).stdout, '');
  runHook(POST, { tool_name: 'Bash', tool_input: { command: 'git tag v1' }, cwd: r }, env);
  assert.equal(runHook(STOP, { cwd: r }, env).stdout, '');
  assert.deepEqual(runHook(STOP, 'junk', env), { code: 0, stdout: '' });
});

test('first sight of a repo with history baselines silently, then reports only new work', () => {
  const d = tmpDir();
  const r = makeRepo();
  const env = { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d };
  commit(r, 'ancient work');
  assert.equal(runHook(STOP, { cwd: r }, env).stdout, '');
  commit(r, 'fresh feature');
  const ctx = runHook(STOP, { cwd: r }, env).stdout;
  assert.match(ctx, /fresh feature/);
  assert.doesNotMatch(ctx, /ancient work/);
});

test('unknown sinceSha falls back to recent commits (Review Focus 5)', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'kept');
  updateProject(d, r, { sinceSha: 'f'.repeat(40) });
  assert.match(runHook(STOP, { cwd: r }, { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d }).stdout, /kept/);
});
