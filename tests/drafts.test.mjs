import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpDir, makeRepo, commit } from './helpers.mjs';
import { slugify, createDraft, setStatus, readHistory } from '../scripts/lib/drafts.mjs';

test('slugify', () => {
  assert.equal(slugify('Packet Tracer MCP v2!'), 'packet-tracer-mcp-v2');
  assert.ok(slugify('x'.repeat(80)).length <= 40);
});

test('createDraft writes folder, history, pointer and exclude once', () => {
  const d = tmpDir();
  const r = makeRepo();
  commit(r, 'x');
  writeFileSync(join(r, '.autolinkin'), '{"nda":false,"optIn":true}');
  const a = createDraft(d, { projectRoot: r, title: 'v2 launch', date: '2026-10-19' });
  const b = createDraft(d, { projectRoot: r, title: 'v2 launch', date: '2026-10-19' });
  assert.ok(existsSync(join(a.dir, 'media')));
  assert.equal(b.id, `${a.id}-2`);
  const ptr = JSON.parse(readFileSync(join(r, '.autolinkin'), 'utf8'));
  assert.equal(ptr.optIn, true);
  assert.equal(ptr.drafts.length, 2);
  const exclude = readFileSync(join(r, '.git/info/exclude'), 'utf8');
  assert.equal(exclude.split(/\r?\n/).filter((l) => l.trim() === '.autolinkin').length, 1);
  setStatus(d, a.id, 'posted', { postUrl: 'u' });
  const entry = readHistory(d).find((e) => e.id === a.id);
  assert.equal(entry.status, 'posted');
  assert.equal(entry.title, 'v2 launch');
});
