import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpDir } from './helpers.mjs';
import { getProject, updateProject, projectKey, readState } from '../scripts/lib/state.mjs';

test('updateProject merges and survives reread', () => {
  const d = tmpDir();
  updateProject(d, 'C:/r', { sinceSha: 'a' });
  updateProject(d, 'C:/r', { lastSeenSha: 'b' });
  assert.deepEqual([getProject(d, 'C:/r').sinceSha, getProject(d, 'C:/r').lastSeenSha], ['a', 'b']);
});

test('projectKey ignores slash style and case on win32', { skip: process.platform !== 'win32' }, () => {
  assert.equal(projectKey('C:\\Foo\\Bar'), projectKey('c:/foo/bar'));
});

test('missing or corrupt state reads as empty, defaults filled', () => {
  const d = tmpDir();
  assert.deepEqual(readState(d), { projects: {} });
  mkdirSync(join(d, 'state'));
  writeFileSync(join(d, 'state', 'projects.json'), '{not json');
  assert.deepEqual(readState(d), { projects: {} });
  assert.deepEqual(getProject(d, 'C:/x'), {
    sinceSha: null, lastSeenSha: null, visibility: null, visibilityCheckedAt: null, firstMilestones: [],
  });
});
