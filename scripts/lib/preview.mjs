// LinkedIn feed-card preview for a draft folder.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { FOLD_CHARS, POST_LIMIT } from './checker.mjs';

const IMAGE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VIDEO = new Set(['.mp4', '.webm', '.mov']);

export function foldIndex(text) {
  let lineCut = text.length;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n' && ++seen === 3) { lineCut = i; break; }
  }
  let charCut = text.length;
  if (text.length > FOLD_CHARS) {
    let j = FOLD_CHARS;
    while (j > 0 && !/\s/.test(text[j])) j -= 1;
    while (j > 0 && /\s/.test(text[j - 1])) j -= 1;
    charCut = j || FOLD_CHARS;
  }
  return Math.min(lineCut, charCut);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mediaTag(file) {
  const src = `media/${encodeURIComponent(file)}`;
  const ext = extname(file).toLowerCase();
  if (IMAGE.has(ext)) return `<img src="${src}" alt="${esc(file)}">`;
  if (VIDEO.has(ext)) return `<video src="${src}" controls playsinline></video>`;
  return '';
}

// Escaped text with links and hashtags styled the way the feed shows them.
function rich(text) {
  return esc(text)
    .replace(/\bhttps?:\/\/[^\s<]+/g, (url) => `<a class="link" href="${url}">${url}</a>`)
    .replace(/(^|\s)(#\p{L}[\p{L}\p{N}_]*)/gu, '$1<a class="hashtag" href="#">$2</a>');
}

// Simple outline icons drawn for this preview (24px grid, stroke = currentColor).
const ICON = {
  like: '<path d="M7.5 20.5H5A1.5 1.5 0 0 1 3.5 19v-7A1.5 1.5 0 0 1 5 10.5h2.5m0 10v-10m0 10h9.2a2 2 0 0 0 2-1.6l1.2-6a2 2 0 0 0-2-2.4H14V6.4A2.4 2.4 0 0 0 11.6 4L7.5 10.5"/>',
  comment: '<path d="M5 4.5h14A1.5 1.5 0 0 1 20.5 6v9a1.5 1.5 0 0 1-1.5 1.5h-9l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z"/>',
  repost: '<path d="M17 3.5l3 3-3 3"/><path d="M4 11.5v-1a4 4 0 0 1 4-4h12"/><path d="M7 20.5l-3-3 3-3"/><path d="M20 12.5v1a4 4 0 0 1-4 4H4"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3l-6.5 18-4-7.5L3 9.5z"/>',
  dots: '<circle cx="6" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0"/><path d="M9.5 9.5h.01M14.5 9.5h.01" stroke-width="2.4"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/>',
  caret: '<path d="M7 10l5 5 5-5"/>',
};

function icon(name, size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
}

const STYLE = `
  :root { --text: rgba(0,0,0,.9); --muted: rgba(0,0,0,.6); --icon: rgba(0,0,0,.75); --line: rgba(140,140,140,.2); --blue: #0a66c2; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f2ee; color: var(--text); font-size: 14px; line-height: 20px; -webkit-font-smoothing: antialiased;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, Oxygen, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; }
  .wrap { max-width: 584px; margin: 24px auto; padding: 0 16px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  a { color: var(--blue); text-decoration: none; } a:hover { text-decoration: underline; }
  .avatar { flex: none; width: 48px; height: 48px; border-radius: 999px; display: grid; place-items: center; background: #dfdad2; color: #56524c; font-size: 20px; font-weight: 600; }
  .avatar.s { width: 32px; height: 32px; font-size: 14px; }
  .head { position: relative; display: flex; gap: 8px; padding: 12px 52px 0 12px; }
  .who { min-width: 0; }
  .name { font-size: 16px; font-weight: 600; line-height: 20px; }
  .deg { font-size: 12px; font-weight: 400; line-height: 1; color: var(--muted); }
  .sub { font-size: 12px; line-height: 15px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tool { width: 32px; height: 32px; display: grid; place-items: center; color: var(--icon); border-radius: 999px; }
  .head .tool { position: absolute; top: 9px; right: 12px; }
  .text { margin: 4px 0 0; padding: 4px 12px 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .more { background: none; border: 0; padding: 0 0 0 4px; font: inherit; color: var(--muted); cursor: pointer; }
  .more:hover { color: var(--blue); text-decoration: underline; }
  .rest { display: none; } .open .rest { display: inline; } .open .dots, .open .more { display: none; }
  .media { display: grid; gap: 2px; } .media img, .media video { display: block; width: 100%; }
  .actions { display: flex; align-items: center; gap: 2px; height: 44px; padding: 0 12px; }
  .act { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 40px; height: 44px; padding: 0 8px; border: 0; border-radius: 4px; background: none; color: var(--icon); font: inherit; font-weight: 600; cursor: pointer; }
  .act:hover { background: rgba(0,0,0,.08); }
  .composer { display: flex; align-items: center; gap: 8px; padding: 8px 12px 0; }
  .pill { flex: 1; height: 42px; display: flex; align-items: center; border: 1px solid var(--line); border-radius: 24px; padding: 0 6px 0 16px; color: var(--muted); }
  .pill .ph { flex: 1; } .pill .tool { width: 32px; } .gif { font-size: 13px; font-weight: 700; letter-spacing: .02em; }
  .sort { display: flex; align-items: center; gap: 2px; padding: 16px 12px 0 20px; }
  .comment { display: flex; gap: 8px; padding: 17px 12px 12px; }
  .c-body { flex: 1; min-width: 0; }
  .c-top { display: flex; align-items: flex-start; gap: 8px; }
  .c-who { flex: 1; min-width: 0; }
  .c-name { font-weight: 600; line-height: 19px; }
  .badge { display: inline-block; margin-left: 4px; padding: 0 4px; border-radius: 4px; background: #e9e5df; color: var(--muted); font-size: 12px; font-weight: 600; line-height: 16px; vertical-align: 1px; }
  .c-time { font-size: 12px; color: var(--muted); line-height: 19px; }
  .c-top .tool { width: 24px; height: 19px; }
  .c-text { margin-top: 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .c-acts { display: flex; gap: 16px; margin-top: 6px; color: var(--icon); }
  .meta { margin: 8px 4px 24px; font-size: 12px; color: var(--muted); }
`;

// The feed shows exactly three rendered lines (blank lines count) and then
// "… more". The server-side fold is a character estimate; this script re-cuts
// the text in the browser at the true three-line point.
const FIT_SCRIPT = String.raw`(() => {
  const p = document.getElementById('text');
  const text = JSON.parse(document.getElementById('post-data').textContent).text;
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rich = (s) => esc(s)
    .replace(/\bhttps?:\/\/[^\s<]+/g, (u) => '<a class="link" href="' + u + '">' + u + '</a>')
    .replace(/(^|\s)(#\p{L}[\p{L}\p{N}_]*)/gu, '$1<a class="hashtag" href="#">$2</a>');
  const MAX = 3 * 20 + 1;
  const height = () => { const cs = getComputedStyle(p); return p.getBoundingClientRect().height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom); };
  const show = (n) => { p.innerHTML = rich(text.slice(0, n)) + (n < text.length ? '<span class="dots">…</span><button class="more">more</button>' : ''); };
  p.addEventListener('click', (e) => { if (e.target.classList.contains('more')) p.innerHTML = rich(text); });
  show(text.length);
  if (height() <= MAX) return;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); show(mid); if (height() <= MAX) lo = mid; else hi = mid - 1; }
  let n = lo;
  while (n > 0 && !/\s/.test(text[n])) n -= 1;
  while (n > 0 && /\s/.test(text[n - 1])) n -= 1;
  show(n || lo);
  const at = document.getElementById('fold-at');
  if (at) at.textContent = String(n || lo);
})();`;

export function renderPreview({ post = '', comment = '', media = [], displayName = '', headline = '' }) {
  const name = displayName || 'You';
  const initial = esc(Array.from(name.trim())[0] || 'Y');
  const cut = foldIndex(post);
  const folded = cut < post.length;
  const tags = media.map(mediaTag).filter(Boolean);
  const chars = Array.from(post).length;
  const commentBlock = comment.trim() ? `
  <div class="sort">Most relevant ${icon('caret', 16)}</div>
  <div class="comment">
    <div class="avatar s">${initial}</div>
    <div class="c-body">
      <div class="c-top">
        <div class="c-who"><div class="c-name">${esc(name)}<span class="badge">Author</span></div><div class="sub">${esc(headline)}</div></div>
        <span class="c-time">Now</span><span class="tool">${icon('dots', 16)}</span>
      </div>
      <div class="c-text">${rich(comment)}</div>
      <div class="c-acts">${icon('like', 16)}${icon('comment', 16)}</div>
    </div>
  </div>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Draft preview</title>
<style>${STYLE}</style></head>
<body><div class="wrap">
<div class="card">
  <div class="head">
    <div class="avatar">${initial}</div>
    <div class="who">
      <div class="name">${esc(name)} <span class="deg">• You</span></div>
      <div class="sub">${esc(headline)}</div>
      <div class="sub">Now</div>
    </div>
    <span class="tool" aria-label="More options">${icon('dots')}</span>
  </div>
  <p class="text" id="text">${rich(post.slice(0, cut))}${folded ? `<span class="dots">…</span><button class="more" onclick="document.getElementById('text').classList.add('open')">more</button><span class="rest">${rich(post.slice(cut))}</span>` : ''}</p>
  ${tags.length ? `<div class="media">${tags.join('')}</div>` : ''}
  <div class="actions">
    <button class="act" aria-label="Like">${icon('like')}</button>
    <button class="act" aria-label="Comment">${icon('comment')}</button>
    <button class="act" aria-label="Repost">${icon('repost')}</button>
    <button class="act" aria-label="Send">${icon('send')}</button>
  </div>
  <div class="composer">
    <div class="avatar s">${initial}</div>
    <div class="pill"><span class="ph">Add a comment…</span><span class="tool">${icon('smile')}</span><span class="tool gif">GIF</span><span class="tool">${icon('image')}</span></div>
  </div>${commentBlock}
  ${commentBlock ? '' : '<div style="height:12px"></div>'}
</div>
<div class="meta">${chars} / ${POST_LIMIT} characters. The feed cuts to "\u2026 more" at character <span id="fold-at">${cut}</span>.</div>
</div>
<script type="application/json" id="post-data">${JSON.stringify({ text: post }).replace(/</g, '\\u003c')}</script>
<script>${FIT_SCRIPT}</script>
</body></html>
`;
}

function readText(path) {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

export function writePreview(draftDir, { displayName = '', headline = '' } = {}) {
  let media = [];
  try { media = readdirSync(join(draftDir, 'media')).sort(); } catch { /* no media yet */ }
  const html = renderPreview({
    post: readText(join(draftDir, 'post.md')).trim(),
    comment: readText(join(draftDir, 'first-comment.md')).trim(),
    media,
    displayName,
    headline,
  });
  const out = join(draftDir, 'preview.html');
  writeFileSync(out, html);
  return out;
}
