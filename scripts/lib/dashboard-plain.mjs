// "plain" preview style: the insights dashboard laid out like a web-analytics
// page (a KPI strip that switches the main chart, then two tabbed list cards).
// Kept as the quieter alternative to the default "cards" style.
// Light theme, self-contained HTML/CSS/JS. Motion uses the Web Animations API,
// which is time-based, so throttled frames (background tabs, screen capture)
// still land on the final state.
import { esc, inline, fmt } from './html.mjs';

// `pre` hides the animated parts until the script starts the entrance.
// The timeout shows everything anyway if the script never runs.
export const DASH_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>document.documentElement.classList.add('pre');setTimeout(function(){document.documentElement.classList.remove('pre')},2500);</script>`;

const UI = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const DASH_CSS = `
  .studio { --d-bg: #f6f5f1; --d-card: #fff; --d-line: #e3e1db; --d-line2: #eeece7; --d-ink: #1f1e1a; --d-dim: #5c5b55; --d-faint: #8a8880;
    --d-blue: #d4501e; --d-blue-t: rgba(212,80,30,.08); --d-blue-t2: rgba(212,80,30,.14);
    --d-green: #256b43; --d-amber: #7a5a12; --d-red: #b42318;
    min-height: 100vh; padding: 20px; display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr);
    background: var(--d-bg); color: var(--d-ink); font-family: ${UI}; font-size: 14px; line-height: 20px; font-variant-numeric: tabular-nums; }

  /* feed column */
  .d-feed { display: flex; flex-direction: column; gap: 12px; min-height: 0; }
  .d-bar-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; }
  .d-h { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
  .d-frame { flex: 0 1 auto; min-height: 0; overflow: auto; padding: 16px; border-radius: 10px; background: #f0efeb; border: 1px solid var(--d-line); scrollbar-width: thin; }
  .feed { width: 552px; max-width: 100%; margin: 0 auto; }

  /* dashboard column */
  .dash { display: flex; flex-direction: column; gap: 16px; min-width: 0; min-height: 0; }
  .d-head-l { display: flex; align-items: baseline; gap: 14px; min-width: 0; }
  .d-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .d-status { display: inline-flex; align-items: center; gap: 7px; color: var(--d-dim); font-size: 13.5px; white-space: nowrap; }
  .d-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--d-faint); flex: none; }
  .d-dot.pass { background: #2e7d4f; } .d-dot.warn { background: #a0731a; } .d-dot.fail { background: #b42318; }
  .d-head-r { display: flex; align-items: center; gap: 14px; color: var(--d-dim); font-size: 13px; white-space: nowrap; }
  .d-ghost { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 1px solid var(--d-line); border-radius: 8px;
    background: var(--d-card); color: var(--d-ink); font: 500 13px/1 ${UI}; cursor: pointer; }
  .d-ghost:hover { background: #f0efeb; }
  .d-ghost svg { color: var(--d-dim); }

  .d-box { position: relative; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--d-card);
    border: 1px solid var(--d-line); border-radius: 10px; box-shadow: 0 1px 2px rgba(28,25,23,.04); }
  .d-main { flex: 1.25 1 0; min-height: 330px; }

  /* KPI strip */
  .d-kpis { display: grid; grid-template-columns: 1.35fr 1.1fr 1fr 1fr 1fr; padding: 8px; gap: 0; border-bottom: 1px solid var(--d-line2); }
  .d-kpi { position: relative; display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 10px 14px 12px; border: 0; border-radius: 8px;
    background: none; color: inherit; font: inherit; text-align: left; }
  .d-kpi + .d-kpi::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 1px; background: var(--d-line); }
  button.d-kpi { cursor: pointer; }
  button.d-kpi:hover { background: #f8f7f4; }
  .d-kpi[aria-selected="true"] { background: #f0efeb; }
  .d-kpi[aria-selected="true"]::before, .d-kpi[aria-selected="true"] + .d-kpi::before { display: none; }
  .d-kpi[aria-selected="true"]::after { content: ""; position: absolute; left: 14px; right: 14px; bottom: 0; height: 2px; border-radius: 2px; background: var(--d-blue); }
  .d-k-l { font-size: 11.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--d-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .d-kpi[aria-selected="true"] .d-k-l { color: var(--d-ink); }
  .d-k-v { display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; font-size: 22px; line-height: 28px; font-weight: 700; letter-spacing: -.02em; white-space: nowrap; }
  .d-k-v .to { font-size: 14px; font-weight: 500; letter-spacing: 0; color: var(--d-faint); }
  .d-k-v small { font-size: 13px; font-weight: 500; letter-spacing: 0; color: var(--d-faint); }
  .d-k-s { font-size: 12.5px; color: var(--d-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .d-up { color: var(--d-green); } .d-down { color: var(--d-red); }

  /* main chart */
  .d-chart { position: relative; flex: 1; min-height: 200px; margin: 14px 18px 0; }
  .d-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .d-grid line { stroke: var(--d-line2); }
  .d-grid text, .d-xl text { fill: var(--d-faint); font: 500 11px ${UI}; }
  .d-xl text.post { fill: var(--d-blue); font-weight: 600; }
  .d-area { fill: url(#d-fill); }
  .d-line { fill: none; stroke: var(--d-blue); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
  .d-proj { fill: none; stroke: var(--d-blue); stroke-width: 2; stroke-dasharray: 4 5; opacity: .7; }
  .d-pt { fill: #fff; stroke: var(--d-blue); stroke-width: 2; }
  .d-band { fill: var(--d-blue-t2); stroke: var(--d-blue); stroke-width: 1; stroke-dasharray: 3 3; }
  .d-mid { fill: var(--d-blue); }
  .d-pt, .d-mid, .d-band { transform-box: fill-box; transform-origin: 50% 50%; }
  .d-band { transform-origin: 50% 100%; }
  .d-guide { stroke: var(--d-line); stroke-width: 1; }
  .d-tip { position: absolute; z-index: 2; pointer-events: none; padding: 8px 10px; border-radius: 8px; background: var(--d-ink); color: #fff; font-size: 12.5px; line-height: 17px;
    white-space: nowrap; transform: translate(-50%, calc(-100% - 12px)); opacity: 0; transition: opacity .12s; }
  .d-tip b { display: block; font-size: 14px; }
  .d-tip.on { opacity: 1; }
  .d-note { margin: 0; padding: 10px 18px 14px; color: var(--d-faint); font-size: 12px; line-height: 16px; }
  .d-empty { margin: auto; padding: 24px; max-width: 46ch; text-align: center; color: var(--d-dim); font-size: 14px; line-height: 21px; }
  .d-empty b { color: var(--d-ink); font-weight: 600; }

  /* tabbed list cards */
  .d-pair { flex: 1 1 0; min-height: 250px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .d-tabs { display: flex; gap: 18px; margin: 0 18px; border-bottom: 1px solid var(--d-line2); }
  .d-tab { position: relative; height: 44px; padding: 0; border: 0; background: none; color: var(--d-faint); font: 600 12px/1 ${UI}; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
  .d-tab:hover { color: var(--d-dim); }
  .d-tab[aria-selected="true"] { color: var(--d-ink); }
  .d-tab[aria-selected="true"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--d-ink); }
  .d-tab .n { margin-left: 5px; color: var(--d-faint); font-weight: 500; }
  .d-tab:focus-visible, .d-kpi:focus-visible, .d-ghost:focus-visible { outline: 2px solid var(--d-blue); outline-offset: 2px; }
  .d-pane { flex: 1; min-height: 0; overflow: auto; padding: 10px 18px 16px; scrollbar-width: thin; }
  .d-pane[hidden] { display: none; }
  .d-cols { display: flex; justify-content: space-between; padding: 4px 8px 6px; color: var(--d-dim); font-size: 12.5px; }
  .d-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .d-r { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; min-height: 34px; padding: 6px 8px; font-size: 14px; line-height: 19px; }
  .d-r > i { position: absolute; z-index: 0; left: 0; top: 0; bottom: 0; border-radius: 6px; background: var(--d-blue-t); transform-origin: left; }
  .d-r > span { position: relative; z-index: 1; min-width: 0; }
  .d-r .d-v { font-weight: 500; text-align: right; white-space: nowrap; }
  .d-r .d-l { display: flex; align-items: center; gap: 10px; }
  .d-r .d-l > span { min-width: 0; }
  .d-r.best .d-v { font-weight: 700; }
  .d-sig { flex: none; width: 18px; height: 18px; display: grid; place-items: center; }
  .d-sig.plus { color: var(--d-green); } .d-sig.minus { color: var(--d-amber); }
  .d-chk { align-items: start; padding: 9px 8px; border-bottom: 1px solid var(--d-line2); }
  .d-chk:last-child { border-bottom: 0; }
  .d-chk .d-l { align-items: start; }
  .d-chk .d-dot { margin-top: 6px; }
  .d-chk .d-c-n { display: block; margin-top: 2px; color: var(--d-dim); font-size: 12.5px; line-height: 17px; }
  .d-chk .d-v { font-size: 12.5px; font-weight: 600; }
  .d-chk .d-v.pass { color: var(--d-green); } .d-chk .d-v.warn { color: var(--d-amber); } .d-chk .d-v.fail { color: var(--d-red); }
  .d-read { padding-top: 4px; }
  .d-read p { margin: 0 0 12px; max-width: 64ch; color: #3a3632; font-size: 14px; line-height: 22px; }
  .d-read code { font: 500 .9em ui-monospace, "Cascadia Mono", Consolas, monospace; padding: 1px 4px; border-radius: 4px; background: #f0efeb; }
  .d-try { margin: 16px 0 2px; padding-top: 14px; border-top: 1px solid var(--d-line2); }
  .d-try .d-k-l { display: block; margin-bottom: 6px; }
  .d-try p { margin: 0; color: var(--d-ink); font-weight: 500; }
  .d-none { margin: 0; color: var(--d-dim); padding: 8px; }
  .d-foot { margin: 0; color: var(--d-faint); font-size: 12px; line-height: 16px; }

  .pre .d-feed, .pre .dash > * { opacity: 0; }

  @media (min-width: 1100px) and (min-height: 680px) {
    body:has(.studio) { overflow: hidden; }
    .studio { height: 100vh; min-height: 0; grid-template-columns: minmax(420px, 600px) minmax(0, 1fr); }
    .studio.solo { grid-template-columns: minmax(0, 620px); justify-content: center; }
  }
  @media (max-width: 1099px), (max-height: 679px) {
    .studio { max-width: 820px; margin: 0 auto; }
    .d-frame, .d-pane { overflow: visible; }
    .d-main { flex: none; } .d-chart { flex: none; height: 260px; }
    .d-pair { flex: none; }
  }
  @media (max-width: 760px) {
    .studio { padding: 12px; gap: 14px; }
    .d-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .d-kpi + .d-kpi::before { display: none; }
    .d-pair { grid-template-columns: minmax(0, 1fr); }
    .d-head-r .d-src { display: none; }
  }
  @media (prefers-reduced-motion: reduce) { .studio * { transition: none !important; } }
`;

export const DASH_SCRIPT = String.raw`(() => {
  const root = document.documentElement;
  const studio = document.querySelector('.studio');
  const show = () => root.classList.remove('pre');
  if (!studio) return show();
  const still = !Element.prototype.animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  // Play keyframes on each element, staggered; 'backwards' holds the first frame during the delay.
  const play = (els, frames, opts = {}, step = 0) => {
    if (still) return;
    [...els].forEach((e, i) => e.animate(frames, { duration: 600, easing: EASE, fill: 'backwards', ...opts, delay: (opts.delay || 0) + i * step }));
  };
  const FADE_UP = (d) => [{ opacity: 0, transform: 'translateY(' + d + 'px)' }, { opacity: 1, transform: 'none' }];
  const NS = 'http://www.w3.org/2000/svg';
  const num = (n, dec = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const short = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(n * 10) / 10));

  // Underline tabs inside each list card.
  for (const list of studio.querySelectorAll('.d-tabs')) {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const pick = (t) => {
      for (const x of tabs) {
        const on = x === t;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
      }
      enter(document.getElementById(t.getAttribute('aria-controls')));
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); const n = tabs[(i + d + tabs.length) % tabs.length]; pick(n); n.focus(); }
      });
    });
  }

  function enter(pane) {
    if (still || !pane) return;
    play(pane.querySelectorAll('.d-r, .d-read > *'), FADE_UP(6), { duration: 450 }, 35);
    play(pane.querySelectorAll('.d-r > i'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 700, delay: 100 }, 50);
  }

  // The main chart: recent posts as a line, this post as a projected range.
  const dataEl = document.getElementById('d-chart-data');
  const chart = studio.querySelector('.d-chart');
  const data = dataEl ? JSON.parse(dataEl.textContent) : null;
  const sel = studio.querySelector('.d-kpi[aria-selected="true"]');
  let metric = sel ? sel.dataset.metric : null;
  const tip = chart && chart.querySelector('.d-tip');

  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceStep(v) {
    if (!(v > 0)) return 0.25;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
  }

  function draw(animate) {
    if (!chart || !data || !metric) return;
    const m = data.series[metric];
    const old = chart.querySelector('svg');
    if (old) old.remove();
    const W = chart.clientWidth;
    const H = chart.clientHeight;
    if (!W || !H) return;
    const L = 44, R = 12, T = 12, B = 26;
    const vals = m.values.filter((v) => v != null);
    const top = niceStep(Math.max(0, ...vals, m.est ? m.est[1] : 0) * 1.05 / 4) * 4;
    const n = data.labels.length + (m.est ? 1 : 0);
    const room = (W - L - R) / Math.max(1, n);
    const x = (i) => L + room * (i + 0.5);
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const fmtv = (v) => (m.unit === '%' ? num(v, 1) + '%' : num(v));
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': 'true' });
    const defs = el('defs', {}, svg);
    const g = el('linearGradient', { id: 'd-fill', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#d4501e', 'stop-opacity': 0.14 }, g);
    el('stop', { offset: 1, 'stop-color': '#d4501e', 'stop-opacity': 0 }, g);
    const grid = el('g', { class: 'd-grid' }, svg);
    for (let k = 0; k <= 4; k += 1) {
      const v = (top * k) / 4;
      el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }, grid);
      el('text', { x: L - 10, y: y(v) + 4, 'text-anchor': 'end' }, grid).textContent = m.unit === '%' ? short(v) + '%' : short(v);
    }
    const xl = el('g', { class: 'd-xl' }, svg);
    const names = data.labels.concat(m.est ? ['This post'] : []);
    names.forEach((name, i) => {
      const t = el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', class: m.est && i === n - 1 ? 'post' : '' }, xl);
      const max = Math.max(4, Math.floor(room / 6.5));
      t.textContent = name.length > max ? name.slice(0, max - 1) + '…' : name;
    });
    const pts = m.values.map((v, i) => (v == null ? null : [x(i), y(v)])).filter(Boolean);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    let area = null, path = null, proj = null, band = null, mid = null;
    if (pts.length) {
      area = el('path', { class: 'd-area', d: line + ' L' + pts[pts.length - 1][0] + ' ' + y(0) + ' L' + pts[0][0] + ' ' + y(0) + ' Z' }, svg);
      path = el('path', { class: 'd-line', d: line }, svg);
    }
    if (m.est) {
      const ex = x(n - 1);
      const mv = (m.est[0] + m.est[1]) / 2;
      const last = pts[pts.length - 1];
      if (last) proj = el('path', { class: 'd-proj', d: 'M' + last[0] + ' ' + last[1] + ' L' + ex + ' ' + y(mv) }, svg);
      if (m.est[1] > m.est[0]) band = el('rect', { class: 'd-band', x: ex - 9, width: 18, y: y(m.est[1]), height: Math.max(2, y(m.est[0]) - y(m.est[1])), rx: 5 }, svg);
      mid = el('circle', { class: 'd-mid', cx: ex, cy: y(mv), r: 4 }, svg);
    }
    const dots = pts.map((p) => el('circle', { class: 'd-pt', cx: p[0], cy: p[1], r: 3.5 }, svg));
    const guide = el('line', { class: 'd-guide', y1: T, y2: H - B, x1: -10, x2: -10 }, svg);
    chart.insertBefore(svg, tip);

    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      let i = Math.floor((e.clientX - r.left - L) / room);
      i = Math.max(0, Math.min(n - 1, i));
      const isPost = m.est && i === n - 1;
      const v = isPost ? null : m.values[i];
      if (!isPost && v == null) return;
      guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i));
      const b = document.createElement('b');
      b.textContent = isPost ? (m.est[0] === m.est[1] ? fmtv(m.est[0]) : fmtv(m.est[0]) + ' to ' + fmtv(m.est[1])) : fmtv(v);
      tip.replaceChildren(names[i], b);
      tip.style.left = Math.max(60, Math.min(W - 60, x(i))) + 'px';
      tip.style.top = (isPost ? y(m.est[1]) : y(v)) + 'px';
      tip.classList.add('on');
    });
    svg.addEventListener('pointerleave', () => { tip.classList.remove('on'); guide.setAttribute('x1', -10); guide.setAttribute('x2', -10); });

    if (!animate || still) return;
    const POP = [{ transform: 'scale(0)' }, { transform: 'scale(1)' }];
    const BACK = 'cubic-bezier(.34,1.56,.64,1)';
    if (path) {
      const len = path.getTotalLength();
      play([path], [{ strokeDasharray: len + ' ' + len, strokeDashoffset: len }, { strokeDasharray: len + ' ' + len, strokeDashoffset: 0 }], { duration: 1100, easing: 'ease-in-out' });
    }
    if (area) play([area], [{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 300 });
    play(dots, POP, { duration: 450, delay: 200, easing: BACK }, 90);
    if (proj) play([proj], [{ opacity: 0 }, { opacity: 0.7 }], { duration: 400, delay: 900 });
    if (band) play([band], [{ opacity: 0, transform: 'scaleY(0)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 600, delay: 1000 });
    if (mid) play([mid], POP, { duration: 450, delay: 1150, easing: BACK });
  }

  for (const k of studio.querySelectorAll('button.d-kpi')) {
    k.addEventListener('click', () => {
      for (const x of studio.querySelectorAll('button.d-kpi')) x.setAttribute('aria-selected', String(x === k));
      metric = k.dataset.metric;
      draw(true);
    });
  }
  let wait;
  addEventListener('resize', () => { clearTimeout(wait); wait = setTimeout(() => draw(false), 120); });

  // Count-ups read the clock each frame and always finish on the real value.
  let countRun = 0;
  function counts() {
    const run = ++countRun;
    const nodes = [...studio.querySelectorAll('[data-count]')].filter((n) => Number.isFinite(Number(n.dataset.count)));
    const D = 1200;
    const t0 = performance.now();
    const set = (k) => { for (const n of nodes) n.textContent = num(Number(n.dataset.count) * (1 - Math.pow(1 - k, 4)), Number(n.dataset.dec || 0)); };
    const tick = (now) => { if (run !== countRun) return; const k = Math.min(1, (now - t0) / D); set(k); if (k < 1) requestAnimationFrame(tick); };
    set(0);
    requestAnimationFrame(tick);
    setTimeout(() => { if (run === countRun) set(1); }, D + 150);
  }

  function full() {
    show();
    draw(true);
    if (still) return;
    play([studio.querySelector('.d-feed'), ...studio.querySelectorAll('.dash > *')], FADE_UP(10), { duration: 700 }, 80);
    for (const pane of studio.querySelectorAll('.d-pane:not([hidden])')) enter(pane);
    counts();
  }
  const replay = studio.querySelector('[data-replay]');
  if (replay) replay.addEventListener('click', full);
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
    if (e.key === 'r' || e.key === 'R') full();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(full); else full();
})();`;

function medianOf(values) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const count = (n, dec = 0) => (Number.isFinite(n)
  ? `<span data-count="${dec ? n.toFixed(dec) : Math.round(n)}"${dec ? ` data-dec="${dec}"` : ''}>${dec ? n.toFixed(dec) : fmt(n)}</span>`
  : fmt(n));
const engagementOf = (p) => (p.reactions || 0) + (p.comments || 0) + (p.reposts || 0);

const BASIS = {
  impressions: 'Estimated from the impressions your recent posts got, adjusted for this post\'s content score.',
  engagement: 'Estimated from reactions and comments on your recent posts, since impressions are not public, adjusted for this post\'s content score.',
  network: 'Estimated from your followers and connections, since no recent posts were found, adjusted for this post\'s content score.',
};

const STATUS = { pass: 'Pass', warn: 'Warning', fail: 'Fail' };

const ICON = {
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  minus: '<path d="M6 12h12"/>',
};
const icon = (name, size = 14) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

export function verdictFor(checks = [], score = 0) {
  if (checks.some((c) => c.status === 'fail')) return { kind: 'fail', text: 'Needs fixes', sub: 'Fix the failed checks before you post.' };
  if (checks.some((c) => c.status === 'warn')) return { kind: 'warn', text: 'Almost there', sub: 'A couple of things could be better. See Checks.' };
  if (score >= 60) return { kind: 'pass', text: 'Ready to post', sub: 'Every check passes and the post has strong signals.' };
  return { kind: 'weak', text: 'Could be stronger', sub: 'It passes every check, but a few changes would help it travel further.' };
}

function sourceText(account) {
  if (!account) return '';
  if (account.sample) return '<span class="d-src">Sample data</span>';
  const when = account.capturedAt ? new Date(account.capturedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  return `<span class="d-src">From ${esc(account.source || 'LinkedIn')}${when ? `, ${esc(when)}` : ''}</span>`;
}

export function feedHead() {
  return '<div class="d-bar-h"><h2 class="d-h">Post preview</h2></div>';
}

function delta(value, typical) {
  if (!Number.isFinite(value) || !(typical > 0)) return '';
  const d = Math.round((value / typical - 1) * 100);
  if (d === 0) return '<span class="d-k-s">Same as typical</span>';
  return `<span class="d-k-s"><span class="${d > 0 ? 'd-up' : 'd-down'}">${d > 0 ? '↗' : '↘'} ${Math.abs(d)}%</span> vs typical</span>`;
}

function range(lo, hi) {
  return `<span><span data-count="${Math.round(lo)}">${fmt(lo)}</span> <span class="to">to</span> <span data-count="${Math.round(hi)}">${fmt(hi)}</span></span>`;
}

function kpiStrip({ account, signals, estimate }, metrics) {
  const posts = Array.isArray(account?.recentPosts) ? account.recentPosts : [];
  const typImp = medianOf(posts.map((p) => p.impressions));
  const typEng = medianOf(posts.map(engagementOf));
  const rate = estimate?.engagementRate != null ? estimate.engagementRate * 100 : NaN;
  const first = metrics[0];
  const cell = (key, label, value, sub) => {
    const on = metrics.includes(key);
    const open = on ? `<button class="d-kpi" type="button" role="tab" data-metric="${key}" aria-selected="${key === first}">` : '<div class="d-kpi">';
    return `${open}<span class="d-k-l">${label}</span><span class="d-k-v">${value}</span>${sub}${on ? '</button>' : '</div>'}`;
  };
  const r = estimate?.reactions;
  return `<div class="d-kpis" role="tablist" aria-label="Chart metric">
    ${cell('imp', 'Impressions', estimate ? range(estimate.low, estimate.high) : fmt(NaN), estimate ? delta((estimate.low + estimate.high) / 2, typImp) : '<span class="d-k-s">Expected for this post</span>')}
    ${cell('eng', 'Reactions', r ? range(r.low, r.high) : fmt(NaN), r ? delta((r.low + r.high) / 2, typEng) : '<span class="d-k-s">Reactions and comments</span>')}
    ${cell('rate', 'Engagement', Number.isFinite(rate) ? `<span>${count(rate, 1)}%</span>` : fmt(NaN), '<span class="d-k-s">Your median rate</span>')}
    ${cell('fol', 'Followers', count(account?.followers), account ? `<span class="d-k-s">${fmt(account.connections)} connections</span>` : '<span class="d-k-s">No stats yet</span>')}
    ${cell('score', 'Content score', `${count(signals?.score ?? 0)}<small>/ 100</small>`, `<span class="d-k-s">${(signals?.helping || []).length} of ${(signals?.helping || []).length + (signals?.holding || []).length} signals strong</span>`)}
  </div>`;
}

function chartData({ account, estimate }) {
  const posts = Array.isArray(account?.recentPosts) ? account.recentPosts : [];
  if (!posts.length && !estimate) return null;
  const labels = posts.map((p, i) => String(p.label || `Post ${i + 1}`));
  const imp = posts.map((p) => (Number.isFinite(p.impressions) ? p.impressions : null));
  const rate = posts.map((p) => (p.impressions > 0 ? Math.round((engagementOf(p) / p.impressions) * 1000) / 10 : null));
  const series = {};
  if (imp.some((v) => v != null) || estimate) series.imp = { values: imp, est: estimate ? [estimate.low, estimate.high] : null };
  series.eng = { values: posts.map(engagementOf), est: estimate?.reactions ? [estimate.reactions.low, estimate.reactions.high] : null };
  if (rate.some((v) => v != null)) {
    const r = estimate?.engagementRate != null ? Math.round(estimate.engagementRate * 1000) / 10 : null;
    series.rate = { values: rate, unit: '%', est: r != null ? [r, r] : null };
  }
  return { labels, series };
}

function mainCard(ins) {
  const data = chartData(ins);
  const metrics = data ? ['imp', 'eng', 'rate'].filter((k) => data.series[k]) : [];
  const body = data
    ? `<div class="d-chart"><div class="d-tip" role="status"></div></div>
    <script type="application/json" id="d-chart-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
    ${ins.estimate ? `<p class="d-note">${esc(BASIS[ins.estimate.basis] || '')}</p>` : ''}`
    : '<p class="d-empty">No account stats yet. Set <b>stats_profile</b> to your LinkedIn profile and lndraft will read your followers, connections and recent posts before the preview.</p>';
  return `<section class="d-box d-main">${kpiStrip(ins, metrics)}${body}</section>`;
}

function tabs(id, items) {
  return `<div class="d-tabs" role="tablist">${items.map(([key, label, n], i) => `<button class="d-tab" type="button" role="tab" id="d-tab-${id}-${key}" aria-controls="d-pane-${id}-${key}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${label}${n != null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
}
const pane = (id, key, first, body) => `<div class="d-pane" role="tabpanel" id="d-pane-${id}-${key}" aria-labelledby="d-tab-${id}-${key}"${first ? '' : ' hidden'}>${body}</div>`;

function readCard({ analysis, signals }) {
  const paras = String(analysis || '').split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
  const tryThis = paras.length > 1 ? paras.pop() : null;
  const helping = signals?.helping || [];
  const holding = signals?.holding || [];
  const rows = (list, kind, none) => (list.length
    ? `<ul class="d-rows">${list.map((t) => `<li class="d-r"><span class="d-l"><span class="d-sig ${kind}">${icon(kind === 'plus' ? 'check' : 'minus')}</span><span>${esc(t)}</span></span></li>`).join('')}</ul>`
    : `<p class="d-none">${none}</p>`);
  const read = paras.length
    ? `<div class="d-read">${paras.map((p) => `<p>${inline(p)}</p>`).join('')}${tryThis ? `<div class="d-try"><span class="d-k-l">Try this</span><p>${inline(tryThis)}</p></div>` : ''}</div>`
    : '<p class="d-none">No analysis written for this draft yet.</p>';
  return `<section class="d-box">
    ${tabs('a', [['read', 'Analysis'], ['help', 'Helping', helping.length], ['hold', 'Holding back', holding.length]])}
    ${pane('a', 'read', true, read)}
    ${pane('a', 'help', false, rows(helping, 'plus', 'Nothing yet.'))}
    ${pane('a', 'hold', false, rows(holding, 'minus', 'Nothing. Nice.'))}
  </section>`;
}

function checksCard({ checks, account }) {
  const passed = checks.filter((c) => c.status === 'pass').length;
  const order = { fail: 0, warn: 1, pass: 2 };
  const sorted = [...checks].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  const list = checks.length
    ? `<div class="d-cols"><span>${passed} of ${checks.length} checks passed</span><span>Result</span></div>
      <ul class="d-rows">${sorted.map((c) => `<li class="d-r d-chk"><span class="d-l"><i class="d-dot ${esc(c.status)}" aria-hidden="true"></i><span><span>${esc(c.label)}</span><span class="d-c-n">${esc(c.note)}</span></span></span><span class="d-v ${esc(c.status)}">${STATUS[c.status] || esc(c.status)}</span></li>`).join('')}</ul>`
    : '<p class="d-none">No checks ran.</p>';
  const posts = Array.isArray(account?.recentPosts) ? account.recentPosts : [];
  const byImp = posts.some((p) => Number.isFinite(p.impressions));
  const metric = (p) => (byImp ? p.impressions : engagementOf(p));
  const top = Math.max(1, ...posts.map(metric).filter(Number.isFinite));
  const ranked = [...posts].sort((a, b) => (metric(b) || 0) - (metric(a) || 0));
  const recent = posts.length
    ? `<div class="d-cols"><span>Post</span><span>${byImp ? 'Impressions' : 'Reactions'}</span></div>
      <ul class="d-rows">${ranked.map((p, i) => `<li class="d-r${i === 0 ? ' best' : ''}"><i style="width:${(((metric(p) || 0) / top) * 100).toFixed(1)}%"></i><span>${esc(p.label || 'Post')}</span><span class="d-v">${fmt(metric(p))}</span></li>`).join('')}</ul>`
    : `<p class="d-none">${account ? 'No recent posts found.' : 'No account stats yet.'}</p>`;
  return `<section class="d-box">
    ${tabs('c', [['chk', 'Checks', `${passed}/${checks.length}`], ['posts', 'Recent posts', posts.length || null]])}
    ${pane('c', 'chk', true, list)}
    ${pane('c', 'posts', false, recent)}
  </section>`;
}

// The whole page: the feed card on the left, the dashboard (when there are insights) on the right.
export function page({ feed, insights = null, title = '' }) {
  return `<div class="studio${insights ? '' : ' solo'}">
<main class="d-feed">${feedHead()}<div class="d-frame">${feed}</div></main>
${insights ? dashboardHtml({ ...insights, title }) : ''}
</div>`;
}

export function dashboardHtml({ account = null, analysis = '', checks = [], signals = null, estimate = null, title = '' } = {}) {
  const ins = { account, analysis, checks, signals, estimate };
  const v = verdictFor(checks, signals?.score ?? 0);
  const dated = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(title);
  const name = dated ? dated[2] : title || 'Draft';
  const when = dated ? new Date(`${dated[1]}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return `<aside class="dash" aria-label="Insights">
    <header class="d-bar-h">
      <div class="d-head-l"><h1 class="d-h d-title">${esc(name)}</h1>${when ? `<span class="d-status">${esc(when)}</span>` : ''}<span class="d-status"><i class="d-dot ${v.kind}" aria-hidden="true"></i>${esc(v.text)}</span></div>
      <div class="d-head-r">${sourceText(account)}<button class="d-ghost" type="button" data-replay title="Replay the animation (R)">${icon('replay')}Replay</button></div>
    </header>
    ${mainCard(ins)}
    <div class="d-pair">${readCard(ins)}${checksCard(ins)}</div>
    <p class="d-foot">${esc(v.sub)} Estimates combine your own numbers with common LinkedIn patterns. They are not LinkedIn's internal data.</p>
  </aside>`;
}
