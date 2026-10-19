import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpDir } from './helpers.mjs';
import { foldIndex, renderPreview } from '../scripts/lib/preview.mjs';

const CLI = fileURLToPath(new URL('../scripts/cli.mjs', import.meta.url));

test('fold backs off to whitespace and respects three lines', () => {
  const t = 'word '.repeat(60);
  const i = foldIndex(t);
  assert.ok(i <= 210);
  assert.match(t.slice(0, i), /word\s*$/);
  assert.equal(foldIndex('a\nb\nc\nd is long'), 'a\nb\nc'.length);
  assert.equal(foldIndex('short'), 5);
});

test('renders escaped text, media and comment', () => {
  const h = renderPreview({
    post: '<script>x</script> hi', comment: 'link here', media: ['shot.png', 'demo.mp4'], displayName: 'Test Person', headline: 'h',
  });
  assert.ok(!h.includes('<script>x'));
  assert.match(h, /&lt;script&gt;/);
  assert.match(h, /<img[^>]+media\/shot\.png/);
  assert.match(h, /<video[^>]+media\/demo\.mp4/);
  assert.match(h, /link here/);
  assert.match(h, /Test Person/);
});

test('matches the LinkedIn feed card layout', () => {
  const h = renderPreview({
    post: `${'word '.repeat(80)}\n\nTry it #ClaudeCode #DevTools`, comment: 'Repo link', media: [], displayName: 'Test Person', headline: 'Builder',
  });
  assert.match(h, /• You/);
  assert.match(h, /<span class="dots">…<\/span><button class="more"[^>]*>more<\/button>/);
  assert.match(h, /<a class="hashtag"[^>]*>#ClaudeCode<\/a>/);
  for (const label of ['Like', 'Comment', 'Repost', 'Send']) assert.match(h, new RegExp(`aria-label="${label}"`));
  assert.match(h, /Add a comment/);
  assert.match(h, /Most relevant/);
  assert.match(h, /#f4f2ee/i);
  // The full text travels as JSON so the page can re-cut at exactly three rendered lines.
  const data = JSON.parse(h.match(/<script type="application\/json" id="post-data">([\s\S]*?)<\/script>/)[1]);
  assert.match(data.text, /#ClaudeCode/);
  assert.ok(!/<\/script>/i.test(JSON.stringify(renderPreview({ post: '</script><b>x', comment: '' }).match(/id="post-data">([\s\S]*?)<\/script>/)[1])));
});

test('cli preview writes preview.html from the draft folder', () => {
  const dir = tmpDir();
  mkdirSync(join(dir, 'media'));
  writeFileSync(join(dir, 'media', 'a.png'), '');
  writeFileSync(join(dir, 'post.md'), 'I shipped it.');
  writeFileSync(join(dir, 'first-comment.md'), 'Repo: x');
  const res = spawnSync(process.execPath, [CLI, 'preview', dir, '--name', 'Test Person'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  const html = readFileSync(join(dir, 'preview.html'), 'utf8');
  assert.match(html, /I shipped it\./);
  assert.match(html, /media\/a\.png/);
});
