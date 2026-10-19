import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpDir, makeRepo, commit } from './helpers.mjs';
import { repoRoot, headSha, commitsSince, diffstat, originUrl } from '../scripts/lib/git.mjs';

test('git helpers on empty, normal and rewritten history', () => {
  assert.equal(repoRoot(tmpDir()), null);
  const r = makeRepo();
  assert.equal(headSha(r), null);
  const a = commit(r, 'first');
  commit(r, 'second');
  assert.deepEqual(commitsSince(r, null).map((c) => c.subject), ['second', 'first']);
  assert.deepEqual(commitsSince(r, a).map((c) => c.subject), ['second']);
  assert.equal(commitsSince(r, '0'.repeat(40)).length, 2); // Review Focus 5
});

test('repoRoot, diffstat and originUrl', () => {
  const r = makeRepo();
  const a = commit(r, 'one');
  commit(r, 'two');
  assert.ok(repoRoot(r));
  assert.match(diffstat(r, a), /1 file changed/);
  assert.equal(originUrl(r), null);
});
