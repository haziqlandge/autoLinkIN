import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpDir, makeRepo, commit, runHook } from './helpers.mjs';

const CLI = fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url));
const STOP = fileURLToPath(new URL('../scripts/hooks/stop.mjs', import.meta.url));

function cli(args) {
  const res = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { code: res.status, stdout: res.stdout.trim() };
}

test('cli check fails on an em dash and writes checks.txt', () => {
  const dir = tmpDir();
  writeFileSync(join(dir, 'post.md'), 'I built it \u2014 fast');
  writeFileSync(join(dir, 'first-comment.md'), '');
  assert.equal(cli(['check', dir]).code, 1);
  assert.ok(existsSync(join(dir, 'checks.txt')));
  writeFileSync(join(dir, 'post.md'), 'I built it fast.');
  assert.equal(cli(['check', dir]).code, 0);
});

test('declined moves sinceSha so the stop hook only shows newer work', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'old work');
  assert.equal(cli(['declined', r, '--drafts-dir', d]).code, 0);
  commit(r, 'new work');
  const ctx = runHook(STOP, { cwd: r }, { CLAUDE_PLUGIN_OPTION_DRAFTS_DIR: d }).stdout;
  assert.match(ctx, /new work/);
  assert.doesNotMatch(ctx, /old work/);
});

test('new creates a draft and the voice file, history lists it', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'x');
  const made = JSON.parse(cli(['new', r, 'First launch', '--drafts-dir', d]).stdout);
  assert.ok(existsSync(made.dir));
  assert.match(readFileSync(join(d, 'linkedin-voice.md'), 'utf8'), /Rules learned from edits/);
  const hist = JSON.parse(cli(['history', r, '--drafts-dir', d]).stdout);
  assert.equal(hist[0].id, made.id);
  assert.equal(JSON.parse(cli(['eligible', r, '--drafts-dir', d]).stdout).eligible, true);
  assert.equal(JSON.parse(cli(['commits', r, '--drafts-dir', d]).stdout).commits.length, 1);
});

test('usage errors exit 2', () => {
  assert.equal(cli([]).code, 2);
  assert.equal(cli(['declined']).code, 2);
  assert.equal(cli(['declined', 'C:/x']).code, 2); // no drafts dir
});
