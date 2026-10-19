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

export function renderPreview({ post = '', comment = '', media = [], displayName = '', headline = '' }) {
  const name = displayName || 'You';
  const cut = foldIndex(post);
  const folded = cut < post.length;
  const tags = media.map(mediaTag).filter(Boolean);
  const chars = Array.from(post).length;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Draft preview</title>
<style>
  body { margin: 0; background: #f4f2ee; font: 14px/1.43 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #191919; }
  .wrap { max-width: 555px; margin: 24px auto; padding: 0 16px; }
  .card { background: #fff; border-radius: 8px; box-shadow: 0 0 0 1px rgba(0,0,0,.08); overflow: hidden; }
  .head { display: flex; gap: 8px; padding: 12px 16px 0; }
  .avatar { width: 48px; height: 48px; border-radius: 50%; background: #0a66c2; color: #fff; display: grid; place-items: center; font-weight: 600; font-size: 20px; flex: none; }
  .name { font-weight: 600; } .sub { color: rgba(0,0,0,.6); font-size: 12px; }
  .text { padding: 8px 16px 12px; white-space: pre-wrap; word-wrap: break-word; }
  .more { color: rgba(0,0,0,.6); background: none; border: 0; padding: 0; font: inherit; cursor: pointer; }
  .rest { display: none; } .open .rest { display: inline; } .open .more, .open .dots { display: none; }
  .media { display: grid; gap: 2px; } .media img, .media video { width: 100%; display: block; background: #000; }
  .bar { display: flex; justify-content: space-around; border-top: 1px solid #e8e8e8; margin: 0 16px; padding: 4px 0; color: rgba(0,0,0,.6); font-weight: 600; }
  .bar span { padding: 10px 8px; }
  .comments { padding: 8px 16px 16px; display: flex; gap: 8px; }
  .comments .avatar { width: 32px; height: 32px; font-size: 14px; }
  .bubble { background: #f2f2f2; border-radius: 0 8px 8px 8px; padding: 8px 12px; white-space: pre-wrap; flex: 1; }
  .meta { color: rgba(0,0,0,.6); font-size: 12px; margin: 8px 4px; }
</style></head>
<body><div class="wrap">
<div class="card">
  <div class="head"><div class="avatar">${esc(name.trim()[0] || 'Y')}</div>
    <div><div class="name">${esc(name)}</div><div class="sub">${esc(headline)}</div><div class="sub">Now</div></div></div>
  <div class="text" id="text">${esc(post.slice(0, cut))}${folded ? `<span class="dots">...</span><button class="more" onclick="document.getElementById('text').classList.add('open')">see more</button><span class="rest">${esc(post.slice(cut))}</span>` : ''}</div>
  ${tags.length ? `<div class="media">${tags.join('')}</div>` : ''}
  <div class="bar"><span>Like</span><span>Comment</span><span>Repost</span><span>Send</span></div>
  ${comment.trim() ? `<div class="comments"><div class="avatar">${esc(name.trim()[0] || 'Y')}</div><div class="bubble"><div class="name">${esc(name)}</div>${esc(comment)}</div></div>` : ''}
</div>
<div class="meta">${chars} / ${POST_LIMIT} characters. "see more" cuts at character ${cut}.</div>
</div></body></html>
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
