// "cards" preview style (the default): one screen, no tabs, read left to right
// as a story. 01 Is it ready? (score cells, guardrail cells, the length meter),
// 02 The post (the feed card as LinkedIn shows it, with the analysis under it)
// and 03 How far could it go? (reach next to your typical and best posts, a
// day-by-day cell chart, the engagement mix and one card that steps through
// audience, timing, top posts and trend).
// Colour carries the story: the two ink cards with electric lime are this
// draft's verdict and forecast; light bone and graphite cards are the detail
// and your history. On a desktop window the board is locked to the viewport
// and charts flex to fit. Some numbers are modelled (daily decay, audience
// split, best times) and the page says so. Self-contained HTML/CSS/JS. Motion
// uses the Web Animations API, which is time-based, so throttled frames still
// land on the final state.
import { esc, inline, fmt } from './html.mjs';

// `pre` hides the animated parts until the script starts the entrance.
// The timeout shows everything anyway if the script never runs.
export const DASH_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>document.documentElement.classList.add('pre');setTimeout(function(){document.documentElement.classList.remove('pre')},2500);</script>`;

const UI = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';

// Day-by-day model: share of a post's impressions on each of its first 7 days,
// and the assumed audience split (followers, their network, beyond).
const DECAY = [0.38, 0.22, 0.14, 0.1, 0.07, 0.05, 0.04];
const SPLIT = [0.5, 0.32, 0.18];
const AUDIENCE = ['Your followers', 'Their network', 'Beyond your network'];
// Cells per day column in the recent-posts chart.
const ROWS = 18;
// Ticks in the length meter, one per 50 characters of LinkedIn's 3,000.
const TICKS = 60;
// Graphite ramp for context data, lime ramp for this draft and for good.
const GRAPH = ['#2a2c28', '#8b8e85', '#c9cbc2'];
const LIMES = ['#f2f8dc', '#dcef9e', '#c4e45f', '#a3c92a', '#7b9a10'];

export const DASH_CSS = `
  .app { --bg: #f3f3ef; --card: #fff; --line: #e4e4dd; --line2: #efefea; --ink: #161714; --dim: #62655d; --faint: #8a8d84;
    --g1: #2a2c28; --g2: #6f726a; --g3: #a5a89f; --g4: #d3d5cd; --cell: #eeefe9;
    --lime: #c4ee3a; --lime2: #a3c92a; --lime3: #dcef9e; --lime-ink: #4a6300;
    --amber: #d98b16; --red: #cf3a26;
    min-height: 100vh; display: flex; flex-direction: column;
    background: var(--bg); color: var(--ink); font: 400 13px/18px ${UI}; font-variant-numeric: tabular-nums; }
  .app button { font-family: inherit; color: inherit; }
  /* ink cards: this draft's verdict and forecast */
  .b-dark { --card: #161714; --line: #161714; --line2: rgba(243,243,239,.1); --ink: #f3f3ef; --dim: rgba(243,243,239,.62); --faint: rgba(243,243,239,.42);
    --cell: rgba(243,243,239,.1); --g4: rgba(243,243,239,.2); --g3: rgba(243,243,239,.5); --lime-ink: #c4ee3a; color: var(--ink); }

  /* top bar */
  .p-top { flex: none; display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 24px; background: var(--card); border-bottom: 1px solid var(--line); }
  .b-logo { flex: none; width: 22px; height: 22px; border-radius: 6px; background: var(--ink); display: grid; place-items: center; color: var(--lime); font: 600 11px/1 ${MONO}; }
  .b-draft { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .b-draft b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; letter-spacing: -.01em; }
  .b-draft span { color: var(--dim); font-size: 12px; white-space: nowrap; }
  .b-top-r { margin-left: auto; display: flex; align-items: center; gap: 18px; color: var(--dim); font-size: 12px; white-space: nowrap; }
  .b-status { display: inline-flex; align-items: center; gap: 7px; color: var(--ink); font-size: 13px; font-weight: 500; }
  .b-src { display: inline-flex; align-items: center; gap: 6px; cursor: help; }
  .b-icon { width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px; background: none; color: var(--dim); cursor: pointer; transition: background .15s, color .15s; }
  .b-icon:hover { background: var(--cell); color: var(--ink); }

  .b-dot { width: 8px; height: 8px; border-radius: 999px; flex: none; background: var(--g3); }
  .b-dot.pass { background: var(--lime2); } .b-dot.warn { background: var(--amber); } .b-dot.fail { background: var(--red); }
  .b-dark .b-dot.pass { background: var(--lime); }
  .b-dot.hold { background: none; box-shadow: inset 0 0 0 1.5px var(--g3); }

  /* the board */
  .b-board { flex: 1; display: grid; grid-template-columns: minmax(280px, 340px) minmax(0, 584px) minmax(0, 1fr); gap: 20px; padding: 18px 24px 22px; }
  .b-col { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; align-content: start; }
  .b-left { grid-template-rows: auto minmax(220px, 1fr) auto auto; }
  .b-mid { grid-template-rows: auto minmax(0, max-content) minmax(150px, 1fr); }
  .b-right { grid-template-rows: auto auto minmax(0, 1.3fr) minmax(0, 1fr); }
  .b-tabs button.b-narrow { display: none; }
  .b-pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); gap: 16px; min-height: 0; }
  .b-kick { display: flex; align-items: baseline; gap: 10px; color: var(--ink); font-size: 13px; font-weight: 600; letter-spacing: -.005em; }
  .b-kick span { color: var(--faint); font: 500 11px ${MONO}; }
  .b-kick small { margin-left: auto; color: var(--faint); font-size: 12px; font-weight: 400; }
  .b-card { position: relative; min-width: 0; display: flex; flex-direction: column; padding: 18px 20px; background: var(--card); border: 1px solid var(--line); border-radius: 16px; }
  .b-card > * { flex-shrink: 0; }
  .b-card > .b-slides, .b-card > .b-chart, .b-card > .b-mix { flex-shrink: 1; }
  .b-h { display: flex; align-items: center; justify-content: space-between; gap: 10px 14px; flex-wrap: wrap; min-height: 26px; margin-bottom: 14px; }
  .b-t { margin: 0; font-size: 13px; line-height: 18px; font-weight: 600; }
  .b-s { color: var(--dim); font-size: 12px; line-height: 16px; }
  .b-num { font-weight: 600; letter-spacing: -.03em; }
  .b-mono { font-family: ${MONO}; font-size: 11px; letter-spacing: 0; }
  .b-none { margin: 0; color: var(--dim); }
  .b-none b { color: var(--ink); font-weight: 600; }
  .to { margin: 0 .25em; color: var(--faint); font-size: .5em; font-weight: 400; letter-spacing: 0; }

  /* small controls: underline tabs and bare chevrons */
  .b-tabs { display: inline-flex; gap: 16px; }
  .b-tabs button { height: 24px; padding: 0; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--dim); font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: color .15s, border-color .15s; }
  .b-tabs button:hover { color: var(--ink); }
  .b-tabs button[aria-pressed="true"] { color: var(--ink); border-bottom-color: var(--ink); }
  .b-dark .b-tabs button[aria-pressed="true"] { border-bottom-color: var(--lime); }
  .b-tabs button .n { margin-left: 5px; color: var(--faint); font: 500 11px ${MONO}; }
  .b-step { display: inline-flex; align-items: center; gap: 2px; }
  .b-step button { width: 24px; height: 24px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--dim); cursor: pointer; transition: background .15s, color .15s; }
  .b-step button:hover { background: var(--cell); color: var(--ink); }
  .b-step span { min-width: 30px; text-align: center; color: var(--faint); font: 500 11px ${MONO}; }
  .b-tabs button:focus-visible, .b-step button:focus-visible, .b-icon:focus-visible, .b-chk:focus-visible { outline: 2px solid var(--lime2); outline-offset: 2px; }

  /* decks: one slide at a time */
  .b-slides { position: relative; flex: 1; min-height: 0; }
  .b-slide { position: absolute; inset: 0; display: flex; flex-direction: column; min-height: 0; }
  .b-slide[hidden], [data-slide][hidden] { display: none; }
  .b-scroll { overflow: auto; }
  /* Scrollbars: no track or arrows, a slim thumb that shows only while the pointer is over the area. */
  .b-scroll, .b-feed { scrollbar-width: thin; scrollbar-color: transparent transparent; }
  .b-scroll:hover, .b-feed:hover { scrollbar-color: var(--g4) transparent; }
  .b-scroll::-webkit-scrollbar, .b-feed::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  .b-scroll::-webkit-scrollbar-button, .b-feed::-webkit-scrollbar-button { display: none; }
  .b-scroll::-webkit-scrollbar-track, .b-feed::-webkit-scrollbar-track { background: transparent; }
  .b-scroll::-webkit-scrollbar-thumb, .b-feed::-webkit-scrollbar-thumb { border-radius: 3px; background: transparent; }
  .b-scroll:hover::-webkit-scrollbar-thumb, .b-feed:hover::-webkit-scrollbar-thumb { background: var(--g4); }
  .b-scroll.b-fade::after { content: ""; position: sticky; bottom: 0; display: block; height: 32px; margin-top: -32px; background: linear-gradient(to bottom, transparent, var(--card)); pointer-events: none; }

  /* 01: score */
  .b-score { display: flex; align-items: baseline; gap: 6px; }
  .b-score .b-num { font-size: 56px; line-height: 56px; }
  .b-score .of { color: var(--faint); font-size: 15px; }
  .b-score .b-status { margin-left: auto; font-size: 12px; }
  .b-sig { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; height: 34px; margin: 16px 0 8px; }
  .b-sig i { border-radius: 6px; background: var(--lime); transform-origin: bottom; }
  .b-sig i.hold { background: var(--cell); box-shadow: inset 0 0 0 1.5px var(--g4); }
  .b-sig-k { display: flex; justify-content: space-between; color: var(--dim); font-size: 12px; margin-bottom: 10px; }
  .b-list { flex: 1; min-height: 0; margin-right: -8px; padding-right: 8px; }
  .b-card > .b-list { flex-shrink: 1; }
  .b-sub { display: flex; justify-content: space-between; margin: 14px 0 2px; color: var(--dim); font-size: 12px; font-weight: 500; }
  .b-sub:first-child { margin-top: 4px; }
  .b-rows { list-style: none; margin: 0; padding: 0; }
  .b-rows li { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 6px 0; border-top: 1px solid var(--line2); }
  .b-rows li:first-child { border-top: 0; }

  /* 01: guardrails */
  .b-chks { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; height: 28px; }
  .b-chk { padding: 0; border: 0; border-radius: 6px; cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .b-chk.pass { background: var(--g1); } .b-chk.warn { background: var(--amber); } .b-chk.fail { background: var(--red); }
  .b-chk:hover { transform: translateY(-2px); }
  .b-chk[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--card), 0 0 0 3.5px var(--lime2); }
  .b-chk-d { min-height: 38px; margin: 12px 0 0; }
  .b-chk-d b { display: block; font-weight: 500; }
  .b-chk-d span { color: var(--dim); font-size: 12px; }

  /* 01: length */
  .b-len-n { display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px; }
  .b-len-n .b-num { font-size: 26px; line-height: 30px; letter-spacing: -.02em; }
  .b-ticks { display: flex; align-items: flex-end; gap: 2px; height: 26px; }
  .b-ticks i { flex: 1; height: 50%; border-radius: 2px; background: var(--cell); transform-origin: bottom; }
  .b-ticks i.zone { height: 100%; background: var(--g4); }
  .b-ticks i.on { background: var(--g1); }
  .b-ticks i.on.zone { background: var(--lime2); }
  .b-ticks-k { position: relative; height: 14px; margin-top: 6px; color: var(--faint); }
  .b-ticks-k span { position: absolute; top: 0; transform: translateX(-50%); }
  .b-ticks-k span:first-child { transform: none; } .b-ticks-k span:last-child { transform: translateX(-100%); }
  .b-len-f { margin: 12px 0 0; color: var(--dim); font-size: 12px; }

  /* 02: the post as LinkedIn shows it, and the analysis under it */
  .b-feed { min-height: 0; overflow: auto; border-radius: 14px; }
  .feed { width: 552px; max-width: 100%; margin: 0 auto; }
  .feed .card { border-color: var(--line); border-radius: 14px; }
  .feed .meta { margin: 8px 4px 0; }
  .b-body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; }
  .b-card > .b-body { flex-shrink: 1; }
  .b-read p { margin: 0; max-width: 70ch; color: #2e302b; font-size: 14.5px; line-height: 23px; }
  .p-try { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--line2); }
  .p-try h3 { margin: 0 0 8px; color: var(--lime-ink); font-size: 12px; line-height: 16px; font-weight: 600; }
  .b-read .p-try p { color: var(--ink); font-size: 15px; font-weight: 500; }
  .b-read code { font: 500 .88em ${MONO}; padding: 1px 4px; border-radius: 4px; background: var(--cell); }

  /* 03: reach, next to your typical and best posts */
  .b-reach { display: grid; grid-template-columns: auto minmax(220px, 1.5fr) minmax(170px, .8fr); gap: 32px; align-items: center; }
  .b-reach-n { display: grid; gap: 4px; }
  .b-reach-n .b-num { font-size: 36px; line-height: 40px; white-space: nowrap; }
  .b-delta { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; }
  .b-delta.up { color: var(--lime-ink); } .b-delta.down { color: var(--red); }
  .b-delta i { font-style: normal; font-size: 8px; }
  .b-cmp { display: grid; gap: 10px; }
  .b-cmp > div { display: grid; grid-template-columns: 108px minmax(0, 1fr) auto; gap: 12px; align-items: center; }
  .b-cmp > div > span { color: var(--dim); font-size: 12px; white-space: nowrap; }
  .b-cmp > div > b { min-width: 92px; text-align: right; font-weight: 500; white-space: nowrap; }
  .b-cmp .now > span, .b-cmp .now > b { color: var(--lime); font-weight: 600; }
  .b-track { position: relative; height: 10px; border-radius: 5px; background: var(--cell); }
  .b-track i { position: absolute; top: 0; bottom: 0; left: 0; border-radius: inherit; background: var(--g3); transform-origin: left; }
  .b-cmp .best .b-track i { background: #f3f3ef; }
  .b-cmp .now .b-track i { background: var(--lime); }
  .b-track s { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 1px; background: #161714; }
  .b-side { display: grid; gap: 0; }
  .b-side > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 7px 0; border-top: 1px solid var(--line2); }
  .b-side > div:first-child { border-top: 0; }
  .b-side > div > span { color: var(--dim); font-size: 12px; white-space: nowrap; }
  .b-side > div > b { font-size: 16px; line-height: 22px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; }

  /* 03: day-by-day cell chart */
  .b-chart { flex: 1; min-height: 0; display: grid; grid-template-columns: 30px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; column-gap: 10px; padding-top: 18px; }
  .b-y { position: relative; }
  .b-y span { position: absolute; right: 0; transform: translateY(50%); color: var(--faint); }
  .b-plot { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 12px; min-height: 0; }
  .p-col { position: relative; display: flex; min-height: 0; }
  .p-col[hidden] { display: none; }
  .b-days { flex: 1; display: grid; grid-template-columns: repeat(${DECAY.length}, minmax(0, 1fr)); gap: 2px; }
  .b-day { display: flex; flex-direction: column-reverse; gap: 2px; min-height: 0; }
  .b-day i { flex: 1; min-height: 2px; border-radius: 2px; background: var(--cell); transition: background-color .25s; }
  .b-day i.l1 { background: ${GRAPH[1]}; } .b-day i.l2 { background: #acafa6; } .b-day i.l3 { background: ${GRAPH[2]}; }
  .p-col.best .b-day i.l1 { background: var(--g1); } .p-col.best .b-day i.l2 { background: #50534c; } .p-col.best .b-day i.l3 { background: #777a72; }
  .p-col.post .b-day i.l1 { background: var(--lime2); } .p-col.post .b-day i.l2 { background: var(--lime); } .p-col.post .b-day i.l3 { background: var(--lime3); }
  .b-tip { position: absolute; z-index: 1; left: 0; bottom: calc(var(--h, 0%) + 4px); color: var(--dim); font-size: 12px; font-weight: 500; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .15s, bottom .3s; }
  .p-col.best .b-tip { color: var(--ink); font-weight: 600; opacity: 1; }
  .p-col.post .b-tip { color: var(--lime-ink); font-weight: 600; opacity: 1; }
  .p-col:hover .b-tip { opacity: 1; }
  .b-x { grid-column: 2; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 12px; padding-top: 8px; }
  .b-x span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dim); font-size: 12px; }
  .b-x span.post { color: var(--lime-ink); font-weight: 600; }
  .b-keys { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin-top: 12px; color: var(--dim); font-size: 12px; }
  .b-keys span { display: inline-flex; align-items: center; gap: 7px; }
  .b-keys i { width: 9px; height: 9px; border-radius: 2px; }
  .b-keys .info { margin-left: auto; color: var(--faint); cursor: help; }

  /* 03: engagement mix */
  .b-mix { flex: 1; min-height: 0; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 20px; align-items: center; }
  .b-donut { position: relative; height: 100%; min-height: 0; max-height: 170px; aspect-ratio: 1; }
  .b-donut svg { display: block; width: 100%; height: 100%; transform: rotate(-90deg); }
  .b-donut circle { fill: none; stroke-width: 14; }
  .b-donut b { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; font-size: 24px; line-height: 26px; font-weight: 600; letter-spacing: -.02em; }
  .b-donut b small { display: block; color: var(--dim); font-size: 11px; line-height: 15px; font-weight: 400; letter-spacing: 0; }
  .b-legend { list-style: none; margin: 0; padding: 0; }
  .b-legend li { display: grid; grid-template-columns: minmax(0, 1fr) auto 36px; gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line2); }
  .b-legend li:first-child { border-top: 0; }
  .b-legend li span:first-child { display: flex; align-items: center; gap: 8px; }
  .b-legend li span:first-child i { width: 9px; height: 9px; border-radius: 2px; }
  .b-legend b { font-weight: 500; }
  .b-legend li span:last-child { text-align: right; color: var(--dim); }

  /* 03: insight slides */
  .b-cap { margin-bottom: 10px; color: var(--dim); font-size: 12px; }
  .b-lane { display: flex; gap: 2px; height: 12px; }
  .b-lane i { flex: 1; border-radius: 2px; background: var(--cell); }
  .b-aud { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
  .b-aud li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; }
  .b-aud .b-lane { grid-column: 1 / -1; }
  .b-aud b { font-weight: 500; }
  .b-heat { flex: 1; min-height: 0; display: grid; grid-template-columns: 38px repeat(7, minmax(0, 1fr)); grid-template-rows: 14px; grid-auto-rows: minmax(0, 1fr); gap: 4px; }
  .b-heat > span { display: grid; place-items: center; color: var(--faint); }
  .b-heat > span.h { place-items: center end; padding-right: 4px; }
  .b-heat i { border-radius: 5px; transform-origin: center; }
  .b-heat i.top { box-shadow: inset 0 0 0 2px var(--g1); }
  .b-rank { list-style: none; margin: 0; padding: 0; }
  .b-rank li { display: grid; grid-template-columns: 16px minmax(0, 1fr) 96px 48px; gap: 12px; align-items: center; min-height: 30px; border-top: 1px solid var(--line2); }
  .b-rank li:first-child { border-top: 0; }
  .b-rank .no { color: var(--faint); }
  .b-rank b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 400; }
  .b-rank .v { text-align: right; font-weight: 500; }
  .b-line { position: relative; flex: 1; min-height: 60px; margin-top: 16px; }
  .b-line svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
  .b-line .area { fill: url(#b-area); }
  .b-line .stroke { fill: none; stroke: var(--g1); stroke-width: 2; stroke-linecap: round; }
  .b-line .proj { fill: none; stroke: var(--lime2); stroke-width: 2; stroke-dasharray: 4 4; }
  .b-line .med { stroke: var(--g4); stroke-width: 1; stroke-dasharray: 3 4; }
  .b-pt { position: absolute; width: 9px; height: 9px; margin: 0 0 -4.5px -4.5px; border-radius: 999px; background: var(--card); border: 2px solid var(--g1); }
  .b-pt.est { background: var(--lime); border-color: var(--g1); }
  .b-band { position: absolute; width: 10px; margin-left: -5px; border-radius: 5px; background: var(--lime3); }
  .b-vl { position: absolute; transform: translate(-50%, -8px); color: var(--ink); font-size: 11.5px; font-weight: 600; white-space: nowrap; }
  .b-vl.est { color: var(--lime-ink); transform: translate(-100%, -8px); }
  .b-line-x { display: flex; justify-content: space-between; margin-top: 8px; color: var(--faint); }

  .pre .b-board > * > * { opacity: 0; }

  /* A desktop window holds the whole board; charts and slides flex to fit. */
  @media (min-width: 1280px) and (min-height: 700px) {
    .app { height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
    .b-board { min-height: 0; }
    .b-col { min-height: 0; align-content: stretch; }
    .b-col > .b-card, .b-pair > .b-card { min-height: 0; overflow: hidden; }
  }
  @media (min-width: 1280px) and (max-width: 1679px) {
    .b-board { grid-template-columns: 300px minmax(0, 560px) minmax(0, 1fr); gap: 16px; padding: 16px 18px 18px; }
    .b-reach { grid-template-columns: auto minmax(0, 1fr); gap: 14px 24px; }
    .b-side { grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 20px; padding-top: 10px; border-top: 1px solid var(--line2); }
    .b-side > div { display: grid; justify-content: start; gap: 2px; border-top: 0; padding: 0; }
    .b-reach-n .b-num { font-size: 30px; line-height: 34px; }
    .b-cmp > div { grid-template-columns: 96px minmax(0, 1fr) auto; }
    .b-pair { grid-template-columns: minmax(0, 1fr); }
    .b-pair > .b-mixcard { display: none; }
    .b-tabs button.b-narrow { display: inline-block; }
  }
  @media (min-width: 1280px) and (max-height: 860px) {
    .b-score .b-num { font-size: 44px; line-height: 44px; }
    .b-sig { height: 26px; margin: 12px 0 6px; }
    .b-sig-k, .b-len-f { display: none; }
    .b-card { padding: 14px 16px; }
    .b-col, .b-pair { gap: 12px; }
    .b-h { margin-bottom: 10px; }
    [data-chart-label] { display: none; }
    .b-chart { padding-top: 12px; }
    .b-keys { margin-top: 8px; }
    .b-cmp { gap: 6px; }
    .b-cap { margin-bottom: 6px; }
    .b-rank li { min-height: 24px; }
    .b-aud { gap: 8px; } .b-aud .b-lane { height: 9px; }
    .b-heat { gap: 3px; }
  }
  @media (max-width: 1279px), (max-height: 699px) {
    .b-slides { min-height: 240px; }
    .b-list { flex: none; }
    .b-chart { grid-template-rows: 280px auto; }
    .b-mix { min-height: 170px; }
  }
  @media (max-width: 1279px) {
    .b-board { grid-template-columns: minmax(260px, 1fr) minmax(0, 584px); }
    .b-right { grid-column: 1 / -1; }
    .b-reach { grid-template-columns: auto minmax(0, 1fr); }
    .b-side { grid-column: 1 / -1; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 20px; }
    .b-side > div { border-top: 0; }
  }
  @media (max-width: 900px) {
    .p-top { padding: 0 14px; }
    .b-top-r .b-src { display: none; }
    .b-board { grid-template-columns: minmax(0, 1fr); padding: 14px; gap: 22px; }
    .b-mid { order: -1; }
    .b-col { gap: 14px; }
    .b-reach { grid-template-columns: minmax(0, 1fr); gap: 16px; }
    .b-side { grid-template-columns: minmax(0, 1fr); }
    .b-cmp > div { grid-template-columns: 88px minmax(0, 1fr) auto; }
    .b-pair { grid-template-columns: minmax(0, 1fr); }
    .b-plot, .b-x { gap: 5px; }
    .b-days, .b-day { gap: 1px; }
    .b-insight .b-tabs { overflow-x: auto; max-width: 100%; }
  }
  @media (prefers-reduced-motion: reduce) { .app * { transition: none !important; } }
`;

export const DASH_SCRIPT = String.raw`(() => {
  const root = document.documentElement;
  const app = document.querySelector('.app');
  const show = () => root.classList.remove('pre');
  if (!app || !app.querySelector('.b-col')) return show();
  const still = !Element.prototype.animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  // Play keyframes on each element, staggered; 'backwards' holds the first frame during the delay.
  const play = (els, frames, opts = {}, step = 0) => {
    if (still) return;
    [...els].forEach((e, i) => e.animate(frames, { duration: 500, easing: EASE, fill: 'backwards', ...opts, delay: (opts.delay || 0) + i * step }));
  };
  const num = (n, dec) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const short = (n) => (n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(Math.round(n * 10) / 10));

  // Count-ups read the clock each frame and always finish on the real value.
  function counts(scope) {
    const nodes = [...scope.querySelectorAll('[data-count]')].filter((n) => Number.isFinite(Number(n.dataset.count)));
    if (still || !nodes.length) return;
    const D = 900;
    const t0 = performance.now();
    const set = (k) => { for (const n of nodes) n.textContent = num(Number(n.dataset.count) * (1 - Math.pow(1 - k, 4)), Number(n.dataset.dec || 0)); };
    const tick = (now) => { const k = Math.min(1, (now - t0) / D); set(k); if (k < 1) requestAnimationFrame(tick); };
    set(0);
    requestAnimationFrame(tick);
    setTimeout(() => set(1), D + 150);
  }

  // Recent-posts chart: each post spread over its first days (a typical decay), each day a
  // column of cells in three audience layers. The best post in graphite, this post in lime.
  const DECAY = ${JSON.stringify(DECAY)};
  const SPLIT = ${JSON.stringify(SPLIT)};
  const dataEl = document.getElementById('p-chart-data');
  const data = dataEl ? JSON.parse(dataEl.textContent) : null;
  const niceStep = (v) => { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v); };
  function chart(metric) {
    if (!data || !data.series[metric]) return;
    const m = data.series[metric];
    const rate = m.unit === '%';
    const f = (v) => (rate ? num(v, 1) + '%' : num(v, 0));
    const daily = (v) => DECAY.map((d) => (rate ? v : v * d));
    const vals = m.values.filter((v) => v != null);
    const mid = m.est ? (m.est[0] + m.est[1]) / 2 : null;
    const peak = Math.max(0, ...vals.map((v) => daily(v)[0]), m.est ? daily(m.est[1])[0] : 0);
    const step = niceStep((peak * 1.15) / 4);
    const top = step * 4;
    const rows = (v) => Math.max(v > 0 ? 1 : 0, Math.min(${ROWS}, Math.round((v / top) * ${ROWS})));
    [...app.querySelectorAll('.b-y span')].forEach((s, k) => { s.textContent = rate ? short(step * k) + '%' : short(step * k); });
    const best = Math.max(...vals);
    for (const col of app.querySelectorAll('.p-col')) {
      const post = col.classList.contains('post');
      if (post) { col.hidden = !m.est; if (!m.est) continue; }
      const v = post ? mid : m.values[Number(col.dataset.i)];
      const days = [...col.querySelectorAll('.b-day')];
      const per = v == null ? DECAY.map(() => 0) : daily(v);
      per.forEach((dv, d) => {
        const n = rows(dv);
        const a = rate ? n : Math.round(n * SPLIT[0]);
        const b = rate ? n : Math.round(n * (SPLIT[0] + SPLIT[1]));
        [...days[d].children].forEach((c, k) => { c.className = k >= n ? '' : k < a ? 'l1' : k < b ? 'l2' : 'l3'; });
        days[d].title = 'Day ' + (d + 1) + ': ' + f(dv);
      });
      col.style.setProperty('--h', (rows(per[0]) / ${ROWS}) * 100 + '%');
      if (!post) col.classList.toggle('best', v === best);
      col.querySelector('.b-tip').textContent = post ? (m.est[0] === m.est[1] ? f(m.est[0]) : f(m.est[0]) + ' to ' + f(m.est[1])) : v == null ? 'No data' : f(v);
    }
    const label = app.querySelector('[data-chart-label]');
    if (label) label.textContent = m.label;
  }
  // Lit cells rise from the bottom row, post by post, day by day.
  function fillCells(scope, delay = 0) {
    if (still || !scope) return;
    [...scope.querySelectorAll('.p-col')].forEach((col, ci) => {
      [...col.querySelectorAll('.b-day')].forEach((day, di) => {
        [...day.children].forEach((c, k) => {
          if (c.className) c.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE, fill: 'backwards', delay: delay + ci * 60 + di * 12 + k * 14 });
        });
      });
    });
  }
  for (const b of app.querySelectorAll('[data-metric]')) {
    b.addEventListener('click', () => {
      for (const x of app.querySelectorAll('[data-metric]')) x.setAttribute('aria-pressed', String(x === b));
      chart(b.dataset.metric);
      fillCells(app.querySelector('.b-chart'));
    });
  }
  const firstMetric = app.querySelector('[data-metric][aria-pressed="true"]');
  if (firstMetric) chart(firstMetric.dataset.metric);

  // Per-element animations, used on the first entrance and whenever a slide comes in.
  function animate(scope, base = 0) {
    if (still) return;
    play(scope.querySelectorAll('.b-sig i, .b-chks .b-chk'), [{ opacity: 0, transform: 'scaleY(.2)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: base + 150 }, 45);
    play(scope.querySelectorAll('.b-ticks i'), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 300, delay: base + 150 }, 6);
    play(scope.querySelectorAll('.b-track i'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 800, delay: base + 200 }, 120);
    play(scope.querySelectorAll('.b-heat i'), [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: base + 60 }, 7);
    play(scope.querySelectorAll('.b-lane i'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: base + 80 }, 6);
    play(scope.querySelectorAll('.b-rows li, .b-legend li, .b-rank li, .b-aud li, .b-side > div'), [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: base + 60 }, 35);
    for (const arc of scope.querySelectorAll('[data-arc]')) {
      const [len, gap, off] = arc.dataset.arc.split(' ').map(Number);
      play([arc], [{ strokeDasharray: '0 ' + (len + gap), strokeDashoffset: off }, { strokeDasharray: len + ' ' + gap, strokeDashoffset: off }], { duration: 900, delay: base + 100 + Number(arc.dataset.delay || 0), easing: 'cubic-bezier(.3,.9,.3,1)' });
    }
    for (const p of scope.querySelectorAll('.b-line .stroke, .b-line .proj')) {
      if (!p.getTotalLength) continue;
      const len = p.getTotalLength();
      p.animate([{ strokeDasharray: len + ' ' + len, strokeDashoffset: len }, { strokeDasharray: len + ' ' + len, strokeDashoffset: 0 }], { duration: 900, delay: base + (p.classList.contains('proj') ? 900 : 100), easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
    }
    play(scope.querySelectorAll('.b-line .area'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: base + 500 });
    play(scope.querySelectorAll('.b-pt, .b-vl, .b-band'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: base + 450 }, 70);
    counts(scope);
  }

  // Decks: one slide at a time, picked by tabs or stepped with the chevrons (wrapping).
  for (const deck of app.querySelectorAll('[data-deck]')) {
    const slides = [...deck.querySelectorAll('[data-slide]')];
    const tabs = [...deck.querySelectorAll('[data-to]')];
    const pos = deck.querySelector('[data-pos]');
    const live = () => slides.map((_, k) => k).filter((k) => { const t = tabs.find((x) => Number(x.dataset.to) === k); return !t || getComputedStyle(t).display !== 'none'; });
    let at = Math.max(0, slides.findIndex((s) => !s.hidden));
    const set = (i, dir) => {
      const L = live();
      at = L.includes(i) ? i : L[0];
      slides.forEach((s, k) => { s.hidden = k !== at; });
      tabs.forEach((t) => t.setAttribute('aria-pressed', String(Number(t.dataset.to) === at)));
      if (pos) pos.textContent = (L.indexOf(at) + 1) + ' / ' + L.length;
      if (!still && dir != null) {
        slides[at].animate([{ opacity: 0, transform: 'translateX(' + (dir * 14) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: EASE });
        animate(slides[at]);
      }
    };
    tabs.forEach((t) => t.addEventListener('click', () => set(Number(t.dataset.to), Number(t.dataset.to) >= at ? 1 : -1)));
    for (const b of deck.querySelectorAll('[data-step]')) b.addEventListener('click', () => { const L = live(); const d = Number(b.dataset.step); set(L[(L.indexOf(at) + d + L.length) % L.length], d); });
    set(at);
    addEventListener('resize', () => set(at));
  }

  // Guardrail cells: pick one to read it.
  const detail = app.querySelector('[data-chk-detail]');
  for (const c of app.querySelectorAll('.b-chk')) {
    const pick = () => {
      for (const x of app.querySelectorAll('.b-chk')) x.setAttribute('aria-pressed', String(x === c));
      if (!detail) return;
      const b = document.createElement('b');
      const s = document.createElement('span');
      b.textContent = c.dataset.label + ' · ' + c.dataset.state;
      s.textContent = c.dataset.note;
      detail.replaceChildren(b, s);
    };
    c.addEventListener('click', pick);
    c.addEventListener('mouseenter', pick);
    c.addEventListener('focus', pick);
  }

  // Scroll areas fade at the foot while there is more below.
  const fades = [...app.querySelectorAll('.b-scroll')];
  const fade = () => { for (const e of fades) e.classList.toggle('b-fade', e.scrollTop + e.clientHeight < e.scrollHeight - 2); };
  for (const e of fades) e.addEventListener('scroll', fade, { passive: true });
  addEventListener('resize', fade);

  function enter() {
    fade();
    show();
    if (window.__fitPost) window.__fitPost();
    if (still) return;
    [...app.querySelectorAll('.b-col > *, .b-pair > *')].forEach((c, i) => c.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE, fill: 'backwards', delay: i * 50 }));
    for (const c of app.querySelectorAll('.b-card')) animate(c, 120);
    fillCells(app.querySelector('.b-chart'), 250);
  }
  const replay = app.querySelector('[data-replay]');
  if (replay) replay.addEventListener('click', enter);
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target.closest && e.target.closest('input, textarea, [contenteditable]'))) return;
    if ((e.key === 'r' || e.key === 'R') && replay) enter();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(enter); else enter();
})();`;

function medianOf(values) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const engagementOf = (p) => (p.reactions || 0) + (p.comments || 0) + (p.reposts || 0);
const recentOf = (account) => (Array.isArray(account?.recentPosts) ? account.recentPosts : []);
const count = (n, dec = 0) => (Number.isFinite(n)
  ? `<span data-count="${dec ? n.toFixed(dec) : Math.round(n)}"${dec ? ` data-dec="${dec}"` : ''}>${dec ? n.toFixed(dec) : fmt(n)}</span>`
  : fmt(n));
const range = (lo, hi) => (Number.isFinite(lo) && Number.isFinite(hi) ? `${count(lo)}<span class="to">to</span>${count(hi)}` : fmt(NaN));
const niceTop = (v) => { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)); return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((m) => m >= v); };
const mid = (lo, hi) => (lo + hi) / 2;
const lane = (v, max, n, color) => { const on = v > 0 ? Math.max(1, Math.round((v / max) * n)) : 0; return Array.from({ length: n }, (_, i) => `<i${i < on ? ` style="background:${color}"` : ''}></i>`).join(''); };

const BASIS = {
  impressions: 'Estimated from the impressions your recent posts got, adjusted for this post\'s content score.',
  engagement: 'Estimated from reactions and comments on your recent posts, since impressions are not public, adjusted for this post\'s content score.',
  network: 'Estimated from your followers and connections, since no recent posts were found, adjusted for this post\'s content score.',
};
const STATUS = { pass: 'Pass', warn: 'Warning', fail: 'Fail' };

const ICON = {
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  prev: '<path d="M15 6l-6 6 6 6"/>',
  next: '<path d="M9 6l6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};
const icon = (name, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
const stepper = (n) => `<div class="b-step"><button type="button" data-step="-1" aria-label="Previous">${icon('prev', 15)}</button><span data-pos>1 / ${n}</span><button type="button" data-step="1" aria-label="Next">${icon('next', 15)}</button></div>`;
const kicker = (no, text, aside = '') => `<div class="b-kick"><span>${no}</span>${text}${aside ? `<small>${aside}</small>` : ''}</div>`;

export function verdictFor(checks = [], score = 0) {
  if (checks.some((c) => c.status === 'fail')) return { kind: 'fail', text: 'Needs fixes', sub: 'Fix the failed checks before you post.' };
  if (checks.some((c) => c.status === 'warn')) return { kind: 'warn', text: 'Almost there', sub: 'A couple of things could be better. See the guardrails.' };
  if (score >= 60) return { kind: 'pass', text: 'Ready to post', sub: 'Every check passes and the post has strong signals.' };
  return { kind: 'hold', text: 'Could be stronger', sub: 'It passes every check, but a few changes would help it travel further.' };
}

function splitAnalysis(analysis) {
  const paras = String(analysis || '').split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
  const tryThis = paras.length > 1 ? paras.pop() : null;
  return { paras, tryThis };
}

function anatomy(post) {
  const text = String(post || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  return {
    chars: Array.from(text).length,
    words,
    paras: text.split(/\r?\n\s*\r?\n/).filter((p) => p.trim()).length,
    tags: (text.match(/(^|\s)#\p{L}/gu) || []).length,
    secs: Math.max(1, Math.round((words / 230) * 60)),
  };
}

function delta(value, typical) {
  if (!Number.isFinite(value) || !(typical > 0)) return '';
  const d = Math.round((value / typical - 1) * 100);
  return d ? `<span class="b-delta ${d > 0 ? 'up' : 'down'}"><i>${d > 0 ? '▲' : '▼'}</i>${Math.abs(d)}%</span>` : '';
}

// A circle arc that the entrance draws in: length, gap and offset along the circumference.
function arc(r, len, c, off, stroke, delay = 0) {
  return `<circle cx="50" cy="50" r="${r}" stroke="${stroke}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" data-arc="${len.toFixed(2)} ${(c - len).toFixed(2)} ${off.toFixed(2)}" data-delay="${delay}"/>`;
}

/* ---------- 01 Is it ready? ---------- */

function scoreCard(signals, checks) {
  const s = Math.max(0, Math.min(100, Math.round(signals?.score ?? 0)));
  const v = verdictFor(checks, s);
  const helping = signals?.helping || [];
  const holding = signals?.holding || [];
  const cells = [...helping.map((t) => `<i title="Helping: ${esc(t)}"></i>`), ...holding.map((t) => `<i class="hold" title="Holding back: ${esc(t)}"></i>`)].join('');
  const rows = (items, kind) => (items.length ? `<ul class="b-rows">${items.map((t) => `<li><i class="b-dot ${kind}"></i>${esc(t)}</li>`).join('')}</ul>` : `<p class="b-none">${kind === 'hold' ? 'Nothing. Nice.' : 'Nothing yet.'}</p>`);
  return `<article class="b-card b-dark">
    <div class="b-h"><h2 class="b-t">Content score</h2><span class="b-s">${helping.length + holding.length} signals</span></div>
    <div class="b-score" role="img" aria-label="Content score ${s} out of 100"><b class="b-num"><span data-count="${s}">${s}</span></b><span class="of">/100</span><span class="b-status"><i class="b-dot ${v.kind}"></i>${esc(v.text)}</span></div>
    <div class="b-sig" aria-hidden="true">${cells || '<i class="hold"></i>'}</div>
    <div class="b-sig-k"><span>${helping.length} helping</span><span>${holding.length} holding back</span></div>
    <div class="b-list b-scroll"><div class="b-sub"><span>Holding back</span><span>${holding.length}</span></div>${rows(holding, 'hold')}<div class="b-sub"><span>Helping</span><span>${helping.length}</span></div>${rows(helping, 'pass')}</div>
  </article>`;
}

function checksCard(checks) {
  const n = { pass: 0, warn: 0, fail: 0 };
  for (const c of checks) if (c.status in n) n[c.status] += 1;
  const order = { fail: 0, warn: 1, pass: 2 };
  const sorted = [...checks].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  const first = sorted[0];
  const cells = sorted.map((c, i) => `<button type="button" class="b-chk ${esc(c.status)}" data-label="${esc(c.label)}" data-note="${esc(c.note)}" data-state="${STATUS[c.status] || esc(c.status)}" aria-pressed="${i === 0}" aria-label="${esc(c.label)}: ${STATUS[c.status] || esc(c.status)}"></button>`).join('');
  return `<article class="b-card">
    <div class="b-h" style="margin-bottom:12px"><h2 class="b-t">${n.pass} of ${checks.length} checks passed</h2><span class="b-s">Point at a cell</span></div>
    ${checks.length ? `<div class="b-chks">${cells}</div>
    <p class="b-chk-d" data-chk-detail><b>${esc(first.label)} · ${STATUS[first.status] || esc(first.status)}</b><span>${esc(first.note)}</span></p>` : '<p class="b-none">No checks ran.</p>'}
  </article>`;
}

function lengthCard(post) {
  const a = anatomy(post);
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const from = i * 50;
    return `<i class="${[from < a.chars ? 'on' : '', from >= 900 && from < 2100 ? 'zone' : ''].filter(Boolean).join(' ')}"></i>`;
  }).join('');
  const sweet = a.chars >= 900 && a.chars <= 2100;
  return `<article class="b-card">
    <div class="b-h" style="margin-bottom:8px"><h2 class="b-t">Length</h2><span class="b-s">${sweet ? 'In the sweet spot' : a.chars < 900 ? 'On the short side' : 'On the long side'}</span></div>
    <div class="b-len-n"><b class="b-num">${count(a.chars)}</b><span class="b-s">of 3,000 characters</span></div>
    <div class="b-ticks" aria-hidden="true">${ticks}</div>
    <div class="b-ticks-k b-mono" aria-hidden="true"><span style="left:0">0</span><span style="left:30%">900</span><span style="left:70%">2,100</span><span style="left:100%">3,000</span></div>
    <p class="b-len-f">${fmt(a.words)} words · ${a.secs}s to read · ${fmt(a.paras)} paragraphs · ${fmt(a.tags)} hashtags</p>
  </article>`;
}

/* ---------- 02 The post ---------- */

function analysisCard(analysis) {
  const { paras, tryThis } = splitAnalysis(analysis);
  return `<article class="b-card b-read">
    <div class="b-h"><h2 class="b-t">Analysis</h2><span class="b-s">What works and the weakest spot</span></div>
    <div class="b-body b-scroll">
      ${paras.length ? paras.map((p) => `<p>${inline(p)}</p>`).join('') : '<p class="b-none">No analysis written for this draft yet.</p>'}
      <div class="p-try"><h3>One change worth making</h3><p>${tryThis ? inline(tryThis) : 'No changes suggested. The draft is ready when you are.'}</p></div>
    </div>
  </article>`;
}

/* ---------- 03 How far could it go? ---------- */

function reachCard({ account, estimate }) {
  const posts = recentOf(account);
  const imp = posts.map((p) => p.impressions).filter(Number.isFinite);
  const typ = medianOf(imp);
  const best = imp.length ? Math.max(...imp) : NaN;
  const r = estimate?.reactions;
  const rate = estimate?.engagementRate != null ? estimate.engagementRate * 100 : NaN;
  const side = `<div class="b-side">
      <div><span>Reactions and comments</span><b>${r ? range(r.low, r.high) : fmt(NaN)}</b></div>
      <div><span>Engagement rate</span><b>${Number.isFinite(rate) ? `${count(rate, 1)}%` : fmt(NaN)}</b></div>
      <div><span>Followers, ${account ? `${fmt(account.connections)} connections` : 'no stats yet'}</span><b>${count(account?.followers)}</b></div>
    </div>`;
  // Three plain bars on one scale: your typical post, your best post, this post's likely range.
  let cmp = '<div></div>';
  if (estimate) {
    const top = Math.max(estimate.high, Number.isFinite(best) ? best : 0) * 1.05;
    const pc = (v) => ((v / top) * 100).toFixed(1);
    const bar = (cls, label, from, to, value, tick) => `<div class="${cls}"><span>${label}</span><span class="b-track"><i style="left:${pc(from)}%;width:${(pc(to) - pc(from)).toFixed(1)}%"></i>${tick != null ? `<s style="left:${pc(tick)}%"></s>` : ''}</span><b>${value}</b></div>`;
    cmp = `<div class="b-cmp">
        ${Number.isFinite(typ) ? bar('', 'Your typical post', 0, typ, fmt(typ)) : ''}
        ${Number.isFinite(best) ? bar('best', 'Your best post', 0, best, fmt(best)) : ''}
        ${bar('now', 'This post, likely', estimate.low, estimate.high, `${fmt(estimate.low)} to ${fmt(estimate.high)}`, mid(estimate.low, estimate.high))}
      </div>`;
  }
  return `<article class="b-card b-dark b-reach">
      <div class="b-reach-n">
        <span class="b-s">Expected impressions</span>
        <b class="b-num">${estimate ? range(estimate.low, estimate.high) : fmt(NaN)}</b>
        <span class="b-s" style="display:flex;gap:6px">${estimate ? `${delta(mid(estimate.low, estimate.high), typ)}${Number.isFinite(typ) ? `vs. ${fmt(typ)} typical` : 'Estimate'}` : 'No account stats yet'}</span>
      </div>
      ${cmp}
      ${side}
    </article>`;
}

function chartData({ account, estimate }) {
  const posts = recentOf(account);
  if (!posts.length) return null;
  const imp = posts.map((p) => (Number.isFinite(p.impressions) ? p.impressions : null));
  const rate = posts.map((p) => (p.impressions > 0 ? Math.round((engagementOf(p) / p.impressions) * 1000) / 10 : null));
  const series = {};
  if (imp.some((v) => v != null)) series.imp = { label: 'Daily impressions over each post\'s first week', values: imp, est: estimate ? [estimate.low, estimate.high] : null };
  series.eng = { label: 'Daily reactions and comments over each post\'s first week', values: posts.map(engagementOf), est: estimate?.reactions ? [estimate.reactions.low, estimate.reactions.high] : null };
  if (rate.some((v) => v != null)) {
    const r = estimate?.engagementRate != null ? Math.round(estimate.engagementRate * 1000) / 10 : null;
    series.rate = { label: 'Engagement rate on each post', unit: '%', values: rate, est: r != null ? [r, r] : null };
  }
  return { labels: posts.map((p, i) => String(p.label || `Post ${i + 1}`)), series };
}

function chartCard({ account, estimate }) {
  const data = chartData({ account, estimate });
  if (!data) {
    return `<article class="b-card"><div class="b-h"><h2 class="b-t">Recent posts</h2></div>
      <p class="b-none">No recent posts to compare yet. Set <b>stats_profile</b> to your LinkedIn profile and lndraft will read your followers, connections and recent posts before the preview.</p></article>`;
  }
  const metrics = ['imp', 'eng', 'rate'].filter((k) => data.series[k]);
  const names = { imp: 'Impressions', eng: 'Reactions', rate: 'Engagement' };
  const hasEst = Object.values(data.series).some((s) => s.est);
  const days = `<div class="b-days">${DECAY.map(() => `<div class="b-day">${'<i></i>'.repeat(ROWS)}</div>`).join('')}</div>`;
  const cols = data.labels.map((_, i) => `<div class="p-col" data-i="${i}"><span class="b-tip"></span>${days}</div>`);
  if (hasEst) cols.push(`<div class="p-col post"><span class="b-tip"></span>${days}</div>`);
  const xl = data.labels.map((l) => `<span title="${esc(l)}">${esc(l)}</span>`).concat(hasEst ? ['<span class="post">This post</span>'] : []);
  const note = `Each post's total is spread over its first week with a typical LinkedIn decay, and the audience split is assumed. ${estimate ? BASIS[estimate.basis] || '' : ''}`;
  return `<article class="b-card">
    <div class="b-h"><div><h2 class="b-t">Next to your recent posts, day by day</h2><div class="b-s" data-chart-label>${esc(data.series[metrics[0]].label)}</div></div>
      <div class="b-tabs" role="group" aria-label="Chart metric">${metrics.map((k, i) => `<button type="button" data-metric="${k}" aria-pressed="${i === 0}">${names[k]}</button>`).join('')}</div></div>
    <div class="b-chart">
      <div class="b-y b-mono">${[0, 1, 2, 3, 4].map((k) => `<span style="bottom:${k * 25}%"></span>`).join('')}</div>
      <div class="b-plot">${cols.join('')}</div>
      <div class="b-x">${xl.join('')}</div>
    </div>
    <div class="b-keys">
      <span><i style="background:${GRAPH[1]}"></i>Followers</span><span><i style="background:#acafa6"></i>Their network</span><span><i style="background:${GRAPH[2]}"></i>Beyond</span>
      <span><i style="background:var(--g1)"></i>Your best</span>${hasEst ? '<span><i style="background:var(--lime2)"></i>This post</span>' : ''}
      <span class="info" title="${esc(note)}">${icon('info', 14)}</span>
    </div>
    <script type="application/json" id="p-chart-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>
  </article>`;
}

// How engagement splits across reactions, comments and reposts: a segmented donut and a legend.
function mixBody(posts) {
  const parts = [['Reactions', GRAPH[0], posts.reduce((t, p) => t + (p.reactions || 0), 0)],
    ['Comments', GRAPH[1], posts.reduce((t, p) => t + (p.comments || 0), 0)],
    ['Reposts', GRAPH[2], posts.reduce((t, p) => t + (p.reposts || 0), 0)]];
  const total = parts.reduce((t, [, , v]) => t + v, 0);
  if (!total) return '<p class="b-none">No reactions or comments recorded yet.</p>';
  const c = 2 * Math.PI * 40;
  let at = 0;
  const arcs = parts.map(([, color, v], i) => {
    const len = Math.max(0, (c * v) / total - 3);
    const out = v ? arc(40, len, c, -at, color, i * 140) : '';
    at += (c * v) / total;
    return out;
  }).join('');
  return `<div class="b-mix">
      <div class="b-donut"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" stroke="var(--cell)"/>${arcs}</svg><b><span>${count(total)}</span><small>interactions</small></b></div>
      <ul class="b-legend">${parts.map(([name, color, v]) => `<li><span><i style="background:${color}"></i>${name}</span><b>${fmt(v)}</b><span>${Math.round((v / total) * 100)}%</span></li>`).join('')}</ul>
    </div>`;
}

function mixCard(posts) {
  return `<article class="b-card b-mixcard"><div class="b-h"><h2 class="b-t">Engagement mix</h2><span class="b-s">Last ${posts.length} posts</span></div>${mixBody(posts)}</article>`;
}

function audienceSlide(estimate) {
  if (!estimate) return '<div class="b-cap">Who could see it</div><p class="b-none">Add account stats to see who this post could reach.</p>';
  const m = mid(estimate.low, estimate.high);
  const parts = SPLIT.map((s) => m * s);
  const tones = [LIMES[4], LIMES[3], LIMES[2]];
  return `<div class="b-cap">Who could see it, of about ${fmt(m)} impressions (an assumed split)</div>
    <ul class="b-aud">${parts.map((v, i) => `<li><span>${AUDIENCE[i]}</span><b>${fmt(v)} <span class="b-s">${Math.round(SPLIT[i] * 100)}%</span></b><span class="b-lane" aria-hidden="true">${lane(v, parts[0], 28, tones[i])}</span></li>`).join('')}</ul>`;
}

// When LinkedIn posts tend to be seen, by weekday and time. A common pattern, not the user's own data.
const SLOTS = ['8am', '10am', '12pm', '2pm', '4pm', '6pm'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WHEN = [
  [0.55, 0.85, 0.9, 0.8, 0.5, 0.15, 0.12],
  [0.62, 1, 0.95, 0.9, 0.55, 0.18, 0.15],
  [0.5, 0.8, 0.85, 0.75, 0.45, 0.15, 0.14],
  [0.4, 0.6, 0.6, 0.55, 0.3, 0.12, 0.12],
  [0.32, 0.45, 0.45, 0.4, 0.2, 0.1, 0.1],
  [0.2, 0.25, 0.25, 0.22, 0.12, 0.08, 0.1],
];
function timingSlide() {
  const ramp = ['#eeefe9', ...LIMES.slice(0, 4)];
  const cells = WHEN.map((row, r) => `<span class="h b-mono">${SLOTS[r]}</span>${row.map((v, c) => `<i class="${v === 1 ? 'top' : ''}" style="background:${ramp[Math.min(4, Math.floor(v * 4.999))]}" title="${DAYS[c]} ${SLOTS[r]}"></i>`).join('')}`).join('');
  return `<div class="b-cap">Best: Tuesday to Thursday mornings (a common LinkedIn pattern)</div>
    <div class="b-heat" aria-label="Best times to post: Tuesday to Thursday mornings"><span></span>${DAYS.map((d) => `<span class="b-mono">${d}</span>`).join('')}${cells}</div>`;
}

function topSlide(posts) {
  if (!posts.length) return '<div class="b-cap">Top posts</div><p class="b-none">No recent posts yet.</p>';
  const byImp = posts.some((p) => Number.isFinite(p.impressions));
  const metric = (p) => (byImp ? p.impressions : engagementOf(p)) || 0;
  const ranked = [...posts].sort((a, b) => metric(b) - metric(a)).slice(0, 5);
  const topValue = Math.max(1, ...ranked.map(metric));
  return `<div class="b-cap">Your top posts by ${byImp ? 'impressions' : 'reactions and comments'}</div>
    <ol class="b-rank">${ranked.map((p, i) => `<li><span class="no b-mono">${i + 1}</span><b title="${esc(p.label || 'Post')}">${esc(p.label || 'Post')}</b><span class="b-lane" aria-hidden="true">${lane(metric(p), topValue, 12, i ? GRAPH[1] : GRAPH[0])}</span><span class="v">${fmt(metric(p))}</span></li>`).join('')}</ol>`;
}

// Impressions per recent post as a smooth area line, then a dashed hop to this post's likely range.
function trendSlide({ account, estimate }) {
  const posts = recentOf(account);
  const byImp = posts.some((p) => Number.isFinite(p.impressions));
  const vals = posts.map((p) => (byImp ? p.impressions : engagementOf(p))).filter(Number.isFinite);
  if (vals.length < 2) return '<div class="b-cap">Trend</div><p class="b-none">Two or more recent posts draw the trend.</p>';
  const est = byImp ? (estimate ? [estimate.low, estimate.high] : null) : (estimate?.reactions ? [estimate.reactions.low, estimate.reactions.high] : null);
  const top = niceTop(Math.max(...vals, est ? est[1] : 0) * 1.15);
  const n = vals.length + (est ? 1 : 0);
  const X = (i) => 3 + (i / (n - 1)) * 94;
  const Y = (v) => 100 - (v / top) * 100;
  const pts = vals.map((v, i) => [X(i), Y(v)]);
  const k = (p) => p.map((c) => c.toFixed(2)).join(',');
  let d = `M${k(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[i + 2] || p2;
    d += ` C${k([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${k([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${k(p2)}`;
  }
  const last = pts[pts.length - 1];
  const area = `${d} L${last[0].toFixed(2)},100 L${pts[0][0].toFixed(2)},100 Z`;
  const md = medianOf(vals);
  const em = est ? mid(est[0], est[1]) : null;
  const at = (x, y) => `left:${x.toFixed(2)}%;bottom:${(100 - y).toFixed(2)}%`;
  const bestI = vals.indexOf(Math.max(...vals));
  const marks = pts.map((p) => `<span class="b-pt" style="${at(p[0], p[1])}"></span>`).join('')
    + `<span class="b-vl" style="${at(pts[bestI][0], pts[bestI][1])}">${fmt(vals[bestI])}</span>`
    + (est ? `<span class="b-band" style="${at(X(n - 1), Y(est[0]))};height:${(((est[1] - est[0]) / top) * 100).toFixed(2)}%"></span>`
      + `<span class="b-pt est" style="${at(X(n - 1), Y(em))}"></span>`
      + `<span class="b-vl est" style="${at(X(n - 1), Y(est[1]))}">${fmt(est[0])} to ${fmt(est[1])}</span>` : '');
  return `<div class="b-cap">${byImp ? 'Impressions' : 'Reactions and comments'} per post, oldest to this one</div>
    <div class="b-line">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="b-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5a89f" stop-opacity=".35"/><stop offset="1" stop-color="#a5a89f" stop-opacity="0"/></linearGradient></defs>
        <line class="med" x1="0" x2="100" y1="${Y(md).toFixed(2)}" y2="${Y(md).toFixed(2)}" vector-effect="non-scaling-stroke"/>
        <path class="area" d="${area}"/>
        <path class="stroke" d="${d}" vector-effect="non-scaling-stroke"/>
        ${est ? `<path class="proj" d="M${k(last)} L${X(n - 1).toFixed(2)},${Y(em).toFixed(2)}" vector-effect="non-scaling-stroke"/>` : ''}
      </svg>
      ${marks}
    </div>
    <div class="b-line-x b-mono"><span>Oldest</span><span>Median ${fmt(md)}</span><span>${est ? 'This post' : 'Latest'}</span></div>`;
}

function insightCard({ account, estimate }) {
  const posts = recentOf(account);
  // Mix only joins the deck when its own card is hidden (mid-size screens); the deck skips hidden tabs.
  const slides = [['Mix', `<div class="b-cap">Engagement mix across your last ${posts.length} posts</div>${mixBody(posts)}`, 'b-narrow'], ['Audience', audienceSlide(estimate)], ['Timing', timingSlide()], ['Top posts', topSlide(posts)], ['Trend', trendSlide({ account, estimate })]];
  return `<article class="b-card b-insight" data-deck>
    <div class="b-h"><div class="b-tabs" role="group" aria-label="Insights">${slides.map(([name, , cls], i) => `<button type="button"${cls ? ` class="${cls}"` : ''} data-to="${i}" aria-pressed="${i === 1}">${name}</button>`).join('')}</div>${stepper(slides.length - 1)}</div>
    <div class="b-slides">${slides.map(([name, html], i) => `<div class="b-slide" data-slide${i === 1 ? '' : ' hidden'} aria-label="${name}">${html}</div>`).join('')}</div>
  </article>`;
}

// The whole page: one board read left to right. Without insights, just the post.
export function page({ feed, insights = null, title = '', post = '' }) {
  if (!insights) return `<div class="app solo"><main class="b-board" style="grid-template-columns:minmax(0,584px);justify-content:center"><div class="b-feed">${feed}</div></main></div>`;
  const { account = null, analysis = '', checks = [], signals = null, estimate = null } = insights;
  const v = verdictFor(checks, signals?.score ?? 0);
  const dated = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(title);
  const name = dated ? dated[2] : title || 'Draft';
  const when = dated ? new Date(`${dated[1]}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const source = account ? (account.sample ? 'Sample data' : `Stats from ${account.source || 'LinkedIn'}`) : 'No account stats yet';
  const fine = `${v.sub} ${source}. Estimates combine your own numbers with common LinkedIn patterns. Daily curves, the audience split and the best times are modelled. None of it is LinkedIn's internal data.`;
  return `<div class="app">
  <header class="p-top">
    <span class="b-logo" aria-hidden="true">in</span>
    <div class="b-draft" title="LinkedIn draft"><b>${esc(name)}</b>${when ? `<span>${esc(when)}</span>` : ''}</div>
    <div class="b-top-r">
      <span class="b-src" title="${esc(fine)}">${icon('info', 14)}${esc(source)}, estimates</span>
      <span class="b-status" title="${esc(v.sub)}"><i class="b-dot ${v.kind}" aria-hidden="true"></i>${esc(v.text)}</span>
      <button class="b-icon" type="button" data-replay title="Replay animation (R)" aria-label="Replay animation">${icon('replay', 15)}</button>
    </div>
  </header>
  <main class="b-board">
    <section class="b-col b-left" aria-label="Is it ready?">
      ${kicker('01', 'Is it ready?')}
      ${scoreCard(signals, checks)}
      ${checksCard(checks)}
      ${lengthCard(post)}
    </section>
    <section class="b-col b-mid" aria-label="The post">
      ${kicker('02', 'The post', 'As it will look in the feed')}
      <div class="b-feed">${feed}</div>
      ${analysisCard(analysis)}
    </section>
    <section class="b-col b-right" aria-label="How far could it go?">
      ${kicker('03', 'How far could it go?')}
      ${reachCard({ account, estimate })}
      ${chartCard({ account, estimate })}
      <div class="b-pair">
        ${mixCard(recentOf(account))}
        ${insightCard({ account, estimate })}
      </div>
    </section>
  </main>
</div>`;
}
