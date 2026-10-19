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

test('dashboard shows account tiles, projection, analysis and plain checks', () => {
  const h = renderPreview({
    post: 'I shipped it.', comment: '',
    insights: {
      account: { sample: true, followers: 1240, connections: 860, recentPosts: [{ impressions: 900, reactions: 30, comments: 6 }] },
      analysis: 'Strong hook. <b>Add</b> an image.',
      checks: [{ id: 'voice', label: 'Reads like you, not like AI', status: 'pass', note: 'No AI clichés' },
        { id: 'hook', label: 'Hook lands before more', status: 'warn', note: 'Opens with a question' }],
      signals: { score: 72, helping: ['Has an image'], holding: ['No question at the end'] },
      estimate: { basis: 'impressions', low: 500, high: 1200, reactions: { low: 10, high: 40 } },
    },
  });
  assert.match(h, /class="dash"/);
  assert.match(h, /1,240/);
  assert.match(h, /Sample data/);
  assert.match(h, /500[\s\S]*1,200/);
  assert.match(h, /72/);
  assert.match(h, /Strong hook\. &lt;b&gt;Add&lt;\/b&gt; an image\./);
  assert.match(h, /Reads like you, not like AI/);
  assert.match(h, /1 of 2 checks passed/);
  assert.match(h, /No question at the end/);
  assert.doesNotMatch(h, /npm|\d+ tests/i);
});

test('without account stats the dashboard says how to add them', () => {
  const h = renderPreview({ post: 'x', comment: '', insights: { checks: [], signals: { score: 40, helping: [], holding: [] }, estimate: null } });
  assert.match(h, /class="dash"/);
  assert.match(h, /No account stats yet/);
});

test('cli preview writes preview.html with the dashboard from the draft folder', () => {
  const root = tmpDir();
  const dir = join(root, '2026-01-01-demo-launch');
  mkdirSync(join(dir, 'media'), { recursive: true });
  writeFileSync(join(dir, 'media', 'a.png'), '');
  writeFileSync(join(dir, 'post.md'), 'I shipped it.');
  writeFileSync(join(dir, 'first-comment.md'), 'Repo: x');
  writeFileSync(join(dir, 'analysis.md'), 'A short, honest launch post.');
  writeFileSync(join(root, 'account.json'), JSON.stringify({ sample: true, followers: 321, connections: 45, recentPosts: [] }));
  const res = spawnSync(process.execPath, [CLI, 'preview', dir, '--name', 'Test Person'], { encoding: 'utf8' });
  assert.equal(res.status, 0);
  const html = readFileSync(join(dir, 'preview.html'), 'utf8');
  assert.match(html, /I shipped it\./);
  assert.match(html, /media\/a\.png/);
  assert.match(html, /A short, honest launch post\./);
  assert.match(html, /321/);
  assert.match(html, /Hook lands before/);
});
