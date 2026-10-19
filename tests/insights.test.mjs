import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDraft } from '../scripts/lib/checker.mjs';
import { contentSignals, estimateReach } from '../scripts/lib/insights.mjs';

const good = [
  '41 commits later, my Packet Tracer MCP builds labs from plain English.',
  '',
  `${'It took three weekends and a lot of broken topologies to get here. '.repeat(14)}`,
  '',
  'What would you build with it?',
  '',
  '#PacketTracer #MCP #Networking',
].join('\n');

test('plain-language checks: every group passes on a clean post', () => {
  const { checks } = checkDraft({ post: good, comment: 'Repo: https://example.com' });
  assert.deepEqual(checks.map((c) => c.status), Array(checks.length).fill('pass'));
  assert.ok(checks.some((c) => c.label === 'Reads like you, not like AI'));
  assert.ok(checks.every((c) => !/U\+|regex|npm|triad/i.test(`${c.label} ${c.note}`)));
});

test('plain-language checks: problems show as human notes', () => {
  const { checks } = checkDraft({ post: 'Excited to announce — so i built it. Fast. Simple. Done.', comment: '' });
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  assert.equal(byId.voice.status, 'fail');
  assert.match(byId.voice.note, /AI posts/);
  assert.equal(byId.punctuation.status, 'fail');
  assert.equal(byId.caps.status, 'fail');
});

test('content signals score what helps and what holds a post back', () => {
  const s = contentSignals(good, { media: ['shot.png'] });
  assert.ok(s.score >= 80, `score ${s.score}`);
  assert.ok(s.helping.some((h) => /question/i.test(h)));
  assert.ok(s.helping.some((h) => /image|video/i.test(h)));
  const weak = contentSignals('Check this https://x.com', { media: [] });
  assert.ok(weak.score < s.score);
  assert.ok(weak.holding.some((h) => /link/i.test(h)));
});

test('reach estimate uses past impressions first, then engagement, then network size', () => {
  const signals = { score: 50 };
  const fromImpressions = estimateReach({ followers: 100, connections: 100, recentPosts: [{ impressions: 400 }, { impressions: 600 }, { impressions: 500 }] }, signals);
  assert.equal(fromImpressions.basis, 'impressions');
  assert.ok(fromImpressions.low < 500 && fromImpressions.high > 500);
  const fromEngagement = estimateReach({ followers: 100, connections: 100, recentPosts: [{ reactions: 10, comments: 2 }] }, signals);
  assert.equal(fromEngagement.basis, 'engagement');
  const fromNetwork = estimateReach({ followers: 1000, connections: 500 }, signals);
  assert.equal(fromNetwork.basis, 'network');
  assert.ok(fromNetwork.high > fromNetwork.low && fromNetwork.reactions.high >= fromNetwork.reactions.low);
  assert.equal(estimateReach(null, signals), null);
  const better = estimateReach({ followers: 1000, connections: 500 }, { score: 90 });
  assert.ok(better.high > fromNetwork.high);
});
