import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDraft, countEmoji, countHashtags } from '../scripts/lib/checker.mjs';

const ok = 'I shipped v2 of the Packet Tracer MCP after 41 commits.\n\nIt builds labs from plain English.';

test('clean post passes with no warnings', () => {
  assert.deepEqual(checkDraft({ post: ok, comment: '' }), { fails: [], warns: [] });
});

test('dashes', () => {
  assert.ok(checkDraft({ post: ok + ' a — b', comment: '' }).fails.length);
  assert.ok(checkDraft({ post: ok + ' a – b', comment: '' }).fails.length);
  assert.ok(checkDraft({ post: ok, comment: 'see ― here' }).fails.length);
  assert.equal(checkDraft({ post: ok + ' real-time', comment: '' }).fails.length, 0);
});

test('emoji counting (Review Focus 3)', () => {
  assert.equal(countEmoji('👨‍👩‍👧 👍🏽 🇮🇳 ❤️'), 4);
  assert.equal(checkDraft({ post: ok + ' 🚀🚀🚀', comment: '🚀🚀🚀' }).fails.length, 1);
  assert.deepEqual(checkDraft({ post: ok + ' 🚀', comment: '' }).fails, []);
  assert.equal(checkDraft({ post: ok + ' 🚀', comment: '' }).warns.length, 1);
});

test('hashtags', () => {
  assert.equal(countHashtags('#a #b C# #1 x#y'), 2);
  assert.ok(checkDraft({ post: ok + '\n#a #b #c #d #e #f', comment: '' }).fails.length);
  assert.equal(checkDraft({ post: ok + '\n#a #b #c', comment: '' }).fails.length, 0);
});

test('limits', () => {
  assert.ok(checkDraft({ post: 'I '.repeat(1501).slice(0, 3001), comment: '' }).fails.some((f) => /3000/.test(f)));
  assert.ok(checkDraft({ post: ok, comment: 'a'.repeat(1251) }).fails.some((f) => /1250/.test(f)));
});

test('lowercase i', () => {
  for (const bad of ['so i built it', "i'm done", 'and i’ve shipped']) {
    assert.ok(checkDraft({ post: bad, comment: '' }).fails.length, bad);
  }
  for (const fine of ['I built it', 'i.e. this', 'Wi-Fi', 'pi day']) {
    assert.equal(checkDraft({ post: fine, comment: '' }).fails.length, 0, fine);
  }
});

test('blocklist, swears, warnings', () => {
  assert.ok(checkDraft({ post: 'Excited to announce v2', comment: '' }).fails.length);
  assert.ok(checkDraft({ post: 'This shit works', comment: '' }).fails.length);
  assert.ok(checkDraft({ post: 'Why did I build this?\n\nBecause.', comment: '' }).warns.length);
  assert.ok(checkDraft({ post: ok + '\n\nA robust, seamless way to leverage it.', comment: '' }).warns.length);
  assert.ok(checkDraft({ post: 'A'.repeat(211) + '\n\nrest', comment: '' }).warns.some((w) => /210/.test(w)));
});
