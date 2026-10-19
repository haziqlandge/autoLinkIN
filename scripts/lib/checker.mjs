// Style rules every draft must pass before the owner sees it.

export const BANNED_DASHES = ['‒', '–', '—', '―'];
export const POST_LIMIT = 3000;
export const COMMENT_LIMIT = 1250;
export const MAX_EMOJI = 5;
export const MAX_HASHTAGS = 5;
export const FOLD_CHARS = 210;

export const BLOCKLIST = [
  'excited to announce',
  'thrilled to announce',
  'game-changer',
  'game changer',
  'delve',
  'let me be honest',
  "here's the thing",
  'plot twist',
];

export const DENSITY_WORDS = [
  'crucial', 'robust', 'seamless', 'leverage', 'elevate', 'landscape',
  'streamline', 'notably', 'comprehensive', 'insights', 'foster', 'nuanced',
];

export const SWEARS = [
  'fuck', 'fucking', 'fucked', 'shit', 'shitty', 'bullshit', 'bitch', 'bastard',
  'asshole', 'arse', 'dick', 'damn', 'crap', 'wtf',
];

const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const TEXT_SYMBOLS = new Set(['©', '®', '™']); // (c) (r) tm without emoji presentation
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function countEmoji(text) {
  let n = 0;
  for (const { segment } of segmenter.segment(text || '')) {
    if (TEXT_SYMBOLS.has(segment)) continue;
    if (PICTO.test(segment)) n += 1;
  }
  return n;
}

export function countHashtags(text) {
  return ((text || '').match(/(?:^|\s)#\p{L}[\p{L}\p{N}_]*/gu) || []).length;
}

const LOWER_I = /(?<![\p{L}\p{N}.\-'’])i(?:['’](?:m|ve|ll|d))?(?![\p{L}\p{N}\-])(?!\.\p{L})/gu;

function normalise(text) {
  return text.toLowerCase().replace(/’/g, "'");
}

function wordsIn(text, words) {
  return words.filter((w) => new RegExp(`\\b${w}\\w*\\b`, 'i').test(text));
}

function checkText(label, text, limit, fails) {
  const found = BANNED_DASHES.filter((d) => text.includes(d));
  if (found.length) fails.push(`${label}: banned dash ${found.map((d) => `U+${d.codePointAt(0).toString(16).toUpperCase()}`).join(', ')}; use a hyphen, comma or rewrite`);
  const length = Array.from(text).length;
  if (length > limit) fails.push(`${label}: ${length} characters, over the ${limit} limit`);
  const lowerI = text.match(LOWER_I);
  if (lowerI) fails.push(`${label}: lowercase "${lowerI[0]}" should be capitalised`);
  const swears = SWEARS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
  if (swears.length) fails.push(`${label}: swearing (${swears.join(', ')})`);
  const lower = normalise(text);
  const phrases = BLOCKLIST.filter((p) => lower.includes(p));
  if (phrases.length) fails.push(`${label}: blocklisted phrase (${phrases.join(', ')})`);
}

export function checkDraft({ post = '', comment = '' } = {}) {
  const fails = [];
  const warns = [];
  checkText('post', post, POST_LIMIT, fails);
  checkText('comment', comment, COMMENT_LIMIT, fails);

  const emoji = countEmoji(post) + countEmoji(comment);
  if (emoji > MAX_EMOJI) fails.push(`emoji: ${emoji} across post and comment, the cap is ${MAX_EMOJI}`);
  else if (emoji > 0) warns.push(`emoji: ${emoji} present; justify each one in brief.md or remove it`);

  const tags = countHashtags(post) + countHashtags(comment);
  if (tags > MAX_HASHTAGS) fails.push(`hashtags: ${tags}, the cap is ${MAX_HASHTAGS} (default 3)`);

  const firstLine = (post.split(/\r?\n/).find((l) => l.trim()) || '').trim();
  if (Array.from(firstLine).length > FOLD_CHARS) warns.push(`hook: first line runs past the ${FOLD_CHARS}-character fold`);
  if (firstLine.endsWith('?')) warns.push('hook: opens with a question; lead with a concrete line instead');

  for (const para of post.split(/\r?\n\s*\r?\n/)) {
    const hits = wordsIn(para, DENSITY_WORDS);
    if (hits.length >= 3) warns.push(`AI vocabulary: "${hits.join('", "')}" in one paragraph`);
  }
  return { fails, warns };
}
