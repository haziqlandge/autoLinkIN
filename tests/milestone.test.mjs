import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { tmpDir, makeRepo, commit, runHook } from './helpers.mjs';
import { classifyCommand } from '../scripts/lib/milestone.mjs';

const HOOK = fileURLToPath(new URL('../scripts/hooks/post-tool-use.mjs', import.meta.url));

test('classifies real milestones', () => {
  assert.equal(classifyCommand('gh release create v1.2.0 --notes x').kind, 'release');
  assert.equal(classifyCommand('npm test && git tag v1.2.0').detail, 'v1.2.0');
  assert.equal(classifyCommand('vercel --prod').firstOnly, true);
  assert.equal(classifyCommand('git push origin main --follow-tags').kind, 'tag');
  assert.equal(classifyCommand('NODE_ENV=production npm publish').kind, 'publish');
  assert.equal(classifyCommand('git tag -a v2.0.0 -m "two"').detail, 'v2.0.0');
  assert.equal(classifyCommand('npm version minor').kind, 'version');
});

test('ignores look-alikes (Review Focus 4)', () => {
  for (const c of ['git tag', 'git tag -l', 'git tag --list "v*"', 'git tag -d v1', 'gh release view v1',
    'npm publish --dry-run', 'echo "npm publish"', 'vercel', 'git push origin main']) {
    assert.equal(classifyCommand(c), null, c);
  }
});

test('hook: emits once per first-only kind, silent outside repos and on junk', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'x');
  const env = { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d };
  const input = (c) => ({ tool_name: 'Bash', tool_input: { command: c }, cwd: r });
  const out = runHook(HOOK, input('gh release create v1.0.0'), env);
  assert.match(JSON.parse(out.stdout).hookSpecificOutput.additionalContext, /release.*v1\.0\.0/s);
  assert.notEqual(runHook(HOOK, input('vercel --prod'), env).stdout, '');
  assert.equal(runHook(HOOK, input('vercel --prod'), env).stdout, '');
  assert.deepEqual(runHook(HOOK, { ...input('gh release create v2'), cwd: tmpDir() }, env), { code: 0, stdout: '' });
  assert.deepEqual(runHook(HOOK, 'not json', env), { code: 0, stdout: '' });
  assert.deepEqual(runHook(HOOK, input('gh release create v3'), {}), { code: 0, stdout: '' });
  assert.deepEqual(runHook(HOOK, { ...input('gh release create v4'), tool_name: 'Read' }, env), { code: 0, stdout: '' });
});
