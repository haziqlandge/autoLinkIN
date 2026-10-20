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
  assert.match(h, /class="badge">Author</);
  // The full text travels as JSON so the page can re-cut at exactly three rendered lines.
  const data = JSON.parse(h.match(/<script type="application\/json" id="post-data">([\s\S]*?)<\/script>/)[1]);
  assert.match(data.text, /#ClaudeCode/);
  assert.ok(!/<\/script>/i.test(JSON.stringify(renderPreview({ post: '</script><b>x', comment: '' }).match(/id="post-data">([\s\S]*?)<\/script>/)[1])));
});

const INSIGHTS = {
  account: { sample: true, followers: 1240, connections: 860, recentPosts: [
    { label: 'Launch', impressions: 2100, reactions: 40, comments: 8, reposts: 2 },
    { label: 'Recap', impressions: 900, reactions: 12, comments: 2 }] },
  analysis: 'Strong hook. <b>Add</b> an image.\n\nAdd a question at the end.',
  checks: [{ id: 'voice', label: 'Reads like you, not like AI', status: 'pass', note: 'No AI clichés' },
    { id: 'hook', label: 'Hook lands before more', status: 'warn', note: 'Opens with a question' }],
  signals: { score: 72, helping: ['Has an image'], holding: ['No question at the end'] },
  estimate: { basis: 'impressions', low: 500, high: 1200, engagementRate: 0.024, reactions: { low: 10, high: 40 } },
};
const chartData = (h, id) => JSON.parse(h.match(new RegExp(`id="${id}">([\\s\\S]*?)</script>`))[1]);

for (const style of ['cards', 'plain']) {
  test(`${style} style shows account numbers, projection, analysis and plain checks`, () => {
    const h = renderPreview({ post: 'I shipped it.', comment: '', insights: INSIGHTS, style, title: '2026-01-01-demo' });
    assert.match(h, /1,240/);
    assert.match(h, /860 connections/);
    assert.match(h, /Sample data/);
    assert.match(h, /data-count="500"[\s\S]*data-count="1200"/);
    assert.match(h, /data-count="72"/);
    assert.match(h, /Almost there/);
    assert.match(h, /Strong hook\. &lt;b&gt;Add&lt;\/b&gt; an image\./);
    assert.match(h, /Add a question at the end\./);
    assert.match(h, /Reads like you, not like AI/);
    assert.match(h, /1 of 2 checks passed/);
    assert.match(h, /No question at the end/);
    assert.match(h, />demo</);
    assert.doesNotMatch(h, /npm|\d+ tests/i);
    assert.doesNotMatch(h, /<script src=/); // no CDN scripts: motion is native
    assert.doesNotMatch(h, /data-width|>Mobile</); // one feed width, no desktop/mobile switch
    const data = chartData(h, style === 'cards' ? 'p-chart-data' : 'd-chart-data');
    assert.deepEqual(data.labels, ['Launch', 'Recap']);
    assert.deepEqual(data.series.imp.est, [500, 1200]);
    assert.deepEqual(data.series.eng.values, [50, 14]);
  });
}

test('cards style: one board reads readiness, the post, then the forecast', () => {
  const h = renderPreview({ post: 'I shipped it.', comment: '', insights: INSIGHTS });
  // Three columns in story order, no page tabs.
  assert.match(h, /aria-label="Is it ready\?"[\s\S]*aria-label="The post"[\s\S]*class="card"[\s\S]*aria-label="How far could it go\?"/);
  assert.doesNotMatch(h, /data-go=|class="p-page"/);
  // Guardrails are one cell per check, issues first.
  assert.equal((h.match(/class="b-chk /g) || []).length, 2);
  assert.match(h, /class="b-chk warn"[^>]*data-label="Hook lands before more"/);
  // The analysis sits under the post and ends on the one change worth making.
  assert.match(h, /aria-label="The post"[\s\S]*class="b-card b-read"[\s\S]*Strong hook[\s\S]*class="p-try"[\s\S]*Add a question at the end\.[\s\S]*aria-label="How far could it go\?"/);
  for (const m of ['imp', 'eng', 'rate']) assert.match(h, new RegExp(`data-metric="${m}"`));
  assert.equal((h.match(/class="p-col" data-i=/g) || []).length, 2);
  assert.match(h, /class="p-col post"/);
  // The engagement mix has its own card; one insight card steps through the rest.
  assert.match(h, /class="b-card b-mixcard"/);
  for (const tab of ['Mix', 'Audience', 'Timing', 'Top posts', 'Trend']) assert.match(h, new RegExp(`data-to="\\d"[^>]*>${tab}<`));
  assert.match(h, /Engagement mix[\s\S]*Reactions[\s\S]*52[\s\S]*Comments[\s\S]*10[\s\S]*Reposts[\s\S]*2/);
});

test('plain style: a KPI strip switches one chart, with tabbed lists below', () => {
  const h = renderPreview({ post: 'I shipped it.', comment: '', insights: INSIGHTS, style: 'plain' });
  assert.match(h, /button class="d-kpi"[^>]*data-metric="imp" aria-selected="true"/);
  for (const tab of ['Analysis', 'Helping', 'Holding back', 'Checks', 'Recent posts']) assert.match(h, new RegExp(`role="tab"[^>]*>${tab}<`));
  assert.match(h, /class="d-try"[\s\S]*Add a question at the end\./);
});

test('unknown styles fall back to cards', () => {
  assert.match(renderPreview({ post: 'x', comment: '', insights: INSIGHTS, style: 'nope' }), /class="p-top"/);
});

test('verdict follows the checks and the score', () => {
  const v = (checks, score) => renderPreview({ post: 'x', comment: '', insights: { checks, signals: { score, helping: [], holding: [] }, estimate: null } });
  assert.match(v([{ id: 'a', label: 'A', status: 'pass', note: '' }], 80), /Ready to post/);
  assert.match(v([{ id: 'a', label: 'A', status: 'fail', note: '' }], 90), /Needs fixes/);
  assert.match(v([{ id: 'a', label: 'A', status: 'pass', note: '' }], 40), /Could be stronger/);
});

test('without account stats the dashboard says how to add them', () => {
  const h = renderPreview({ post: 'x', comment: '', insights: { checks: [], signals: { score: 40, helping: [], holding: [] }, estimate: null } });
  assert.match(h, /No account stats yet/);
  assert.match(renderPreview({ post: 'x', comment: '', style: 'plain', insights: { checks: [], signals: { score: 40, helping: [], holding: [] }, estimate: null } }), /No account stats yet/);
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
  assert.match(html, /class="p-top"/);
  const plain = spawnSync(process.execPath, [CLI, 'preview', dir, '--style', 'plain'], { encoding: 'utf8' });
  assert.equal(plain.status, 0);
  assert.match(readFileSync(join(dir, 'preview.html'), 'utf8'), /class="d-kpis"/);
  const bad = spawnSync(process.execPath, [CLI, 'preview', dir, '--style', 'nope'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown style "nope"/);
});
