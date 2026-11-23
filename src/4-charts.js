/* ---------- charts (SVG, no dependencies) ---------- */
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
function barPath(x, yTop, w, h, r = 4) {
  if (h <= 0.5) return '';
  r = Math.min(r, w / 2, h); const yb = yTop + h;
  return `M${x},${yb}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yb}Z`;
}
const MLETTER = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const G = { W: 338, H: 180, pl: 34, pr: 6, pt: 8, pb: 22 };
function gridSVG(max) {
  const ih = G.H - G.pt - G.pb;
  return [0, .5, 1].map(k => { const y = G.pt + ih - k * ih; return `<line x1="${G.pl}" x2="${G.W - G.pr}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,${k === 0 ? .14 : .06})" stroke-width="1"/><text x="${G.pl - 6}" y="${y + 3.5}" text-anchor="end">${kShort(max * k)}</text>`; }).join('');
}
function xLabels(data) {
  const gw = (G.W - G.pl - G.pr) / 12;
  return data.map((d, i) => `<text x="${G.pl + gw * i + gw / 2}" y="${G.H - 6}" text-anchor="middle" ${d.ym === ymNow() ? 'style="fill:var(--t1);font-weight:700"' : ''}>${MLETTER[ymParts(d.ym)[1] - 1]}</text>`).join('');
}
function hits(n) {
  const gw = (G.W - G.pl - G.pr) / 12;
  return `<rect class="sel" x="0" y="${G.pt - 4}" width="${gw}" height="${G.H - G.pt - G.pb + 4}" rx="7" fill="rgba(255,255,255,.06)" opacity="0"/>` +
    Array.from({ length: n }, (_, i) => `<rect data-hit="${i}" x="${G.pl + gw * i}" y="0" width="${gw}" height="${G.H}" fill="transparent"/>`).join('');
}
const defaultIndex = data => { const i = data.findIndex(d => d.ym === ymNow()); return i >= 0 ? i : (data[0].ym > ymNow() ? 0 : 11); };
const card = (id, title, inner, legend = '', tip = true) => `<div class="chart-card" data-chart="${id}"><div class="chart-head"><h3 class="chart-title">${esc(title)}</h3></div>${legend}${tip ? '<div class="tip" data-tip></div>' : ''}${inner}</div>`;
const noData = (id, title) => card(id, title, '<p class="muted small" style="margin:4px 2px 2px">Pas encore de données sur cette période.</p>', '', false);

const CHARTS = {};
const TIPS = {};
CHARTS.bars = data => {
  const mx = Math.max(...data.map(d => Math.max(d.inc, d.out)));
  if (!mx) return noData('bars', WIDGET_NAMES.bars);
  const max = niceMax(mx), ih = G.H - G.pt - G.pb, gw = (G.W - G.pl - G.pr) / 12, bw = Math.min(10, (gw - 7) / 2);
  const y = v => G.pt + ih - v / max * ih;
  const bars = data.map((d, i) => {
    const x0 = G.pl + gw * i + (gw - (2 * bw + 2)) / 2;
    const op = d.future ? ' opacity=".4"' : '';
    return `<path d="${barPath(x0, y(d.inc), bw, ih + G.pt - y(d.inc))}" fill="var(--in)"${op}/><path d="${barPath(x0 + bw + 2, y(d.out), bw, ih + G.pt - y(d.out))}" fill="var(--out)"${op}/>`;
  }).join('');
  const anyFuture = data.some(d => d.future);
  const legend = `<div class="legend"><span><i class="sw" style="--c:var(--in)"></i>Revenus</span><span><i class="sw" style="--c:var(--out)"></i>Charges</span>${anyFuture ? `<span><i class="sw faded" style="--c:var(--t2)"></i>Prévu</span>` : ''}</div>`;
  return card('bars', WIDGET_NAMES.bars, `<div class="chart"><svg viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="Revenus et charges par mois">${gridSVG(max)}${hits(12)}${bars}${xLabels(data)}</svg></div>`, legend);
};
TIPS.bars = (data, i) => { const d = data[i]; return `<span class="tip-m">${ymLabel(d.ym)}${d.future ? ', prévu' : ''}</span><span>Revenus <b>${money(d.inc)}</b></span><span>Charges <b>${money(d.out)}</b></span><span>Solde <b>${money(r2(d.inc - d.out), { sign: true })}</b></span>`; };

function linePaths(pts, split) {
  const p = (arr) => arr.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('');
  const past = pts.slice(0, split + 1), fut = pts.slice(split);
  return { past: past.length > 1 ? p(past) : '', fut: fut.length > 1 ? p(fut) : '', pastPts: past };
}
function lineChart(id, title, data, values, color, tipFn, { area = true } = {}) {
  const valid = values.filter(v => v !== null);
  if (!valid.length || Math.max(...valid.map(Math.abs)) === 0) return noData(id, title);
  const max = niceMax(Math.max(...valid)), ih = G.H - G.pt - G.pb, gw = (G.W - G.pl - G.pr) / 12;
  const pts = values.map((v, i) => v === null ? null : [G.pl + gw * i + gw / 2, G.pt + ih - Math.max(0, v) / max * ih]).filter(Boolean);
  const nowIdx = data.findIndex(d => d.ym === ymNow());
  const split = nowIdx < 0 ? (data[0].ym > ymNow() ? 0 : pts.length - 1) : Math.min(nowIdx, pts.length - 1);
  const { past, fut, pastPts } = linePaths(pts, split);
  const gid = 'g' + id;
  const areaPath = area && pastPts.length > 1 ? `${past}L${pastPts[pastPts.length - 1][0]},${G.pt + ih}L${pastPts[0][0]},${G.pt + ih}Z` : '';
  const svg = `<svg viewBox="0 0 ${G.W} ${G.H}" role="img" aria-label="${esc(title)}"><defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${gridSVG(max)}${hits(12)}<line class="xhair" x1="0" x2="0" y1="${G.pt}" y2="${G.pt + ih}" stroke="rgba(255,255,255,.25)" stroke-width="1" opacity="0"/>
    ${areaPath ? `<path d="${areaPath}" fill="url(#${gid})"/>` : ''}
    ${past ? `<path d="${past}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    ${fut ? `<path d="${fut}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round" opacity=".7"/>` : ''}
    <circle class="dot" r="5" cx="0" cy="0" fill="${color}" stroke="var(--s1)" stroke-width="2" opacity="0"/>
    ${xLabels(data)}</svg>`;
  CHART_PTS[id] = values.map((v, i) => v === null ? null : [G.pl + gw * i + gw / 2, G.pt + ih - Math.max(0, v) / max * ih]);
  TIPS[id] = tipFn;
  const legend = fut ? `<div class="legend"><span><i class="sw" style="--c:${color}"></i>Réel</span><span><i class="sw faded" style="--c:${color}"></i>Prévu, en pointillé</span></div>` : '';
  return card(id, title, `<div class="chart">${svg}</div>`, legend);
}
const CHART_PTS = {};
CHARTS.savings = data => {
  let c = 0; const cum = data.map(d => (c = r2(c + d.sav)));
  return lineChart('savings', WIDGET_NAMES.savings, data, cum, '#c98500', (d, i) => `<span class="tip-m">${ymLabel(data[i].ym)}${data[i].future ? ', prévu' : ''}</span><span>Cumul <b>${money(cum[i])}</b></span><span>Ce mois <b>${money(data[i].sav)}</b></span>`);
};
CHARTS.placements = data => {
  if (!state.placements.length) return noData('placements', WIDGET_NAMES.placements);
  const vals = data.map(d => d.ym > ymNow() ? null : sum(state.placements, p => placementValueAt(p, d.ym)));
  return lineChart('placements', WIDGET_NAMES.placements, data, vals, '#9085e9', (d, i) => `<span class="tip-m">${ymLabel(data[i].ym)}</span><span>Valeur <b>${money(vals[i] || 0)}</b></span>`, { area: true });
};

function aggregate(data, kind, by) {
  const map = new Map();
  data.forEach(d => (kind === 'in' ? d.s.inc : d.s.out).forEach(x => {
    const key = by === 'cat' ? x.cat : x.name;
    if (!map.has(key)) map.set(key, { key, total: 0, items: new Map() });
    const g = map.get(key); g.total = r2(g.total + x.amount);
    g.items.set(x.name, r2((g.items.get(x.name) || 0) + x.amount));
  }));
  return [...map.values()].sort((a, b) => b.total - a.total);
}
function hbars(id, title, groups, color, kind, expandable) {
  if (!groups.length) return noData(id, title);
  const max = groups[0].total;
  const rows = groups.map(g => {
    const name = kind === 'cat' ? catById('out', g.key).name : g.key;
    const open = expandable && ui.openCat === g.key;
    return `<button class="hb-row" ${expandable ? `data-act="openCat" data-k="${esc(g.key)}" aria-expanded="${open}"` : 'tabindex="-1"'}><div class="hb-top"><span>${esc(name)}</span><span>${money(g.total, { whole: true })}</span></div><div class="hb-track"><i style="width:${Math.max(1.5, g.total / max * 100)}%;--c:${color}"></i></div></button>
      ${open ? `<div class="hb-items">${[...g.items.entries()].sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div><span>${esc(n)}</span><span>${money(v)}</span></div>`).join('')}</div>` : ''}`;
  }).join('');
  return card(id, title, `<div class="hb">${rows}</div>`, '', false);
}
CHARTS.cats = data => hbars('cats', WIDGET_NAMES.cats, aggregate(data, 'out', 'cat'), 'var(--out)', 'cat', true);
CHARTS.incomes = data => hbars('incomes', WIDGET_NAMES.incomes, aggregate(data, 'in', 'name'), 'var(--in)', 'name', false);
CHARTS.donut = data => {
  const groups = aggregate(data, 'out', 'cat');
  const total = sum(groups, g => g.total);
  if (!total) return noData('donut', WIDGET_NAMES.donut);
  const segs = []; let other = 0;
  groups.forEach(g => { const c = catById('out', g.key); if (c.slot && segs.length < 6) segs.push({ name: c.name, v: g.total, color: SLOT[c.slot] }); else other = r2(other + g.total); });
  if (other) segs.push({ name: 'Autres', v: other, color: GREY });
  const R = 52, C = 2 * Math.PI * R, gap = segs.length > 1 ? 2.2 : 0; let off = 0;
  const arcs = segs.map(s => { const len = s.v / total * C; const a = `<circle cx="66" cy="66" r="${R}" fill="none" stroke="${s.color}" stroke-width="20" stroke-dasharray="${Math.max(0.1, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 66 66)"/>`; off += len; return a; }).join('');
  const svg = `<svg viewBox="0 0 132 132" role="img" aria-label="Répartition des charges">${arcs}<text x="66" y="63" text-anchor="middle" style="font-size:17px;font-weight:700;fill:var(--t1);font-stretch:85%">${esc(money(total, { whole: true }))}</text><text x="66" y="80" text-anchor="middle" style="font-size:10.5px;fill:var(--t2)">sur l'année</text></svg>`;
  const legend = `<div class="donut-legend">${segs.map(s => `<div><i class="sw" style="--c:${s.color}"></i><span>${esc(s.name)}</span><b>${Math.round(s.v / total * 100)} %</b></div>`).join('')}</div>`;
  return card('donut', WIDGET_NAMES.donut, `<div class="donut-wrap chart">${svg}${legend}</div>`, '', false);
};

function selectPoint(cardEl, i) {
  const id = cardEl.dataset.chart, data = ui.yearData;
  const gw = (G.W - G.pl - G.pr) / 12;
  const sel = $('.sel', cardEl); if (sel) { sel.setAttribute('x', G.pl + gw * i); sel.setAttribute('opacity', id === 'bars' ? 1 : 0); }
  const pts = CHART_PTS[id];
  if (pts) {
    const p = pts[i] || pts.filter(Boolean).slice(-1)[0];
    const dot = $('.dot', cardEl), xh = $('.xhair', cardEl);
    if (p && dot) { dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]); dot.setAttribute('opacity', 1); xh.setAttribute('x1', p[0]); xh.setAttribute('x2', p[0]); xh.setAttribute('opacity', 1); }
    if (!pts[i]) i = pts.reduce((a, q, k) => q ? k : a, 0);
  }
  const tip = $('[data-tip]', cardEl);
  if (tip && TIPS[id]) tip.innerHTML = TIPS[id](data, i);
}
function wireCharts() {
  $$('.chart-card[data-chart]').forEach(c => {
    if (!$('[data-tip]', c)) return;
    selectPoint(c, defaultIndex(ui.yearData));
    const svg = $('svg', c);
    const pick = e => { const h = e.target.closest('[data-hit]'); if (h) selectPoint(c, +h.dataset.hit); };
    svg.addEventListener('click', pick);
    svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) pick(e); });
  });
}
