// Content signals and a transparent reach estimate for the preview dashboard.
// These are heuristics drawn from common LinkedIn guidance, not LinkedIn's own numbers.
import { checkDraft, countHashtags, FOLD_CHARS } from './checker.mjs';

const VIDEO = /\.(mp4|webm|mov)$/i;

export function contentSignals(post, { media = [] } = {}) {
  const helping = [];
  const holding = [];
  let score = 0;
  const add = (ok, points, good, bad) => {
    if (ok) { score += points; if (good) helping.push(good); } else if (bad) holding.push(bad);
  };
  const text = String(post || '').trim();
  const chars = Array.from(text).length;
  const paragraphs = text.split(/\r?\n\s*\r?\n/).filter((p) => p.trim());
  const firstLine = (text.split(/\r?\n/).find((l) => l.trim()) || '').trim();
  const lastText = [...paragraphs].reverse().find((p) => !p.trim().startsWith('#')) || '';
  const tags = countHashtags(text);

  add(Array.from(firstLine).length <= FOLD_CHARS, 15, 'The opening line shows in full before "… more"', 'The opening line gets cut off by "… more"');
  add(!firstLine.endsWith('?'), 5, null, 'Opens with a question instead of a statement');
  add(chars >= 900 && chars <= 2100, 15, 'Length is in the range that tends to do well',
    chars < 900 ? 'Short posts tend to get less reach' : 'Very long posts lose readers');
  add(tags >= 1 && tags <= 3, 10, `${tags} focused hashtag${tags === 1 ? '' : 's'}`, tags === 0 ? 'No hashtags' : 'More hashtags than needed');
  add(!/https?:\/\//.test(text), 10, 'No links in the post itself', 'A link in the post itself can lower reach, so put it in the first comment');
  add(media.length > 0, 15, media.some((m) => VIDEO.test(m)) ? 'Has a video' : 'Has an image', 'No image or video');
  add(/\?\s*$/.test(lastText.trim()), 10, 'Ends with a question that invites comments', 'Doesn\'t end with a question or an invite to comment');
  add(!paragraphs.some((p) => Array.from(p).length > 450), 10, 'Short, easy-to-scan paragraphs', 'Has a long block of text');
  add(checkDraft({ post: text, comment: '' }).fails.length === 0, 10, 'Passes every guardrail', 'Fails a guardrail');
  return { score: Math.min(100, score), helping, holding };
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const num = (v) => (Number.isFinite(v) ? v : null);
const ASSUMED_ENGAGEMENT = 0.02;

// Best signal first: your past impressions, then your past engagement, then network size.
export function estimateReach(account, { score = 50 } = {}) {
  if (!account) return null;
  const posts = Array.isArray(account.recentPosts) ? account.recentPosts : [];
  const impressions = posts.map((p) => num(p.impressions)).filter((v) => v !== null);
  const engaged = posts.filter((p) => num(p.reactions) !== null || num(p.comments) !== null)
    .map((p) => (p.reactions || 0) + (p.comments || 0) + (p.reposts || 0));
  let baseline;
  let basis;
  if (impressions.length) { baseline = median(impressions); basis = 'impressions'; }
  else if (engaged.length) { baseline = median(engaged) / ASSUMED_ENGAGEMENT; basis = 'engagement'; }
  else { baseline = ((account.followers || 0) + (account.connections || 0)) * 0.08; basis = 'network'; }
  baseline = Math.max(baseline, 5);

  const rates = posts.filter((p) => num(p.impressions) > 0)
    .map((p) => ((p.reactions || 0) + (p.comments || 0) + (p.reposts || 0)) / p.impressions);
  const rate = rates.length ? median(rates) : ASSUMED_ENGAGEMENT;
  const multiplier = 0.6 + 0.8 * (score / 100);
  const low = Math.round(baseline * multiplier * 0.6);
  const high = Math.round(baseline * multiplier * 1.5);
  return {
    basis,
    baseline: Math.round(baseline),
    multiplier: Math.round(multiplier * 100) / 100,
    low,
    high,
    engagementRate: rate,
    reactions: { low: Math.round(low * rate * 0.7), high: Math.max(Math.round(high * rate * 1.3), Math.round(low * rate * 0.7)) },
  };
}
