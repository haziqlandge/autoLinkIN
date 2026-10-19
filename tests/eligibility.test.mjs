import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpDir, makeRepo, commit } from './helpers.mjs';
import { parseGithubRepo, checkEligibility, readProjectFile } from '../scripts/lib/eligibility.mjs';

test('parses github remotes', () => {
  assert.equal(parseGithubRepo('https://github.com/a/b.git'), 'a/b');
  assert.equal(parseGithubRepo('git@github.com:a/b.git'), 'a/b');
  assert.equal(parseGithubRepo('https://gitlab.com/a/b'), null);
});

test('rules: no remote, nda, private, opt-in, cache', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'x');
  assert.deepEqual(checkEligibility(r, { draftsDir: d }), { eligible: true, reason: 'no-remote' });
  writeFileSync(join(r, '.autolinkin'), '{"nda":true}');
  assert.equal(checkEligibility(r, { draftsDir: d }).reason, 'nda');
  writeFileSync(join(r, '.autolinkin'), '{}');
  execFileSync('git', ['-C', r, 'remote', 'add', 'origin', 'https://github.com/a/b']);
  let calls = 0;
  const gh = () => { calls++; return 'private'; };
  assert.equal(checkEligibility(r, { draftsDir: d, ghVisibility: gh }).reason, 'private');
  checkEligibility(r, { draftsDir: d, ghVisibility: gh });
  assert.equal(calls, 1);
  writeFileSync(join(r, '.autolinkin'), '{"optIn":true}');
  assert.deepEqual(checkEligibility(r, { draftsDir: d, ghVisibility: gh }), { eligible: true, reason: 'opt-in' });
});

test('a GitHub origin whose visibility cannot be confirmed is not eligible unless opted in', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'x');
  execFileSync('git', ['-C', r, 'remote', 'add', 'origin', 'git@github.com:a/secret.git']);
  let calls = 0;
  const gh = () => { calls++; return null; };
  assert.deepEqual(checkEligibility(r, { draftsDir: d, ghVisibility: gh }), { eligible: false, reason: 'unknown' });
  checkEligibility(r, { draftsDir: d, ghVisibility: gh });
  assert.equal(calls, 2); // an unknown answer is never cached
  writeFileSync(join(r, '.autolinkin'), '{"optIn":true}');
  assert.equal(checkEligibility(r, { draftsDir: d, ghVisibility: gh }).eligible, true);
});

test('invalid .autolinkin reads as empty', () => {
  const r = makeRepo();
  writeFileSync(join(r, '.autolinkin'), 'nope');
  assert.deepEqual(readProjectFile(r), {});
});
