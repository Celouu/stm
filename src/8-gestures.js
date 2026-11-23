/* ============ gestes ============ */

/* ---------- courbe du solde jusqu'à la paie ----------
   Projection jour par jour depuis le dernier point solde : chaque prélèvement fait une marche.
   Les charges sans jour sont comptées dès le départ (prudence, comme pulse()).
   La ligne pointillée suit ta marge par jour : dépensée chaque jour, elle arrive à 0 le jour de la paie. */
function projection(p) {
  const today = todayISO(), start = isoMin(p.bal.date, today), end = p.pay.date;
  const n = Math.max(1, daysBetween(start, end));
  const ti = clamp(daysBetween(start, today), 0, n);
  const ops = Array.from({ length: n + 1 }, () => []);
  p.items.forEach(x => ops[x.date ? clamp(daysBetween(start, x.date), 0, n) : 0].push(x));
  let v = p.bal.amount;
  const days = [];
  for (let i = 0; i <= n; i++) {
    const v0 = v; v = r2(v + sum(ops[i], x => x.amount));
    const k = Math.max(0, i - ti);
    days.push({ i, date: isoAddDays(start, i), v0, v, ops: ops[i], s0: r2(v0 - p.perDay * k), s: r2(v - p.perDay * k) });
  }
  return { start, end, n, ti, days, pay: p.pay, perDay: p.perDay, free: p.free };
}
function curveSVG(pr, { big = false } = {}) {
  const W = 340, Hh = big ? 176 : 78;
  const [pt, pr_, pb, pl] = big ? [12, 10, 24, 10] : [8, 4, 6, 4];
  const vals = pr.days.flatMap(d => [d.v0, d.v, d.s0, d.s]).concat([0]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi - lo < 1) hi = lo + 1;
  const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  const X = i => pl + (W - pl - pr_) * i / pr.n, Y = v => pt + (Hh - pt - pb) * (hi - v) / (hi - lo);
  let line = `M${X(0)},${Y(pr.days[0].v0)}`, spend = '';
  pr.days.forEach(d => {
    line += `V${Y(d.v)}`; if (d.i < pr.n) line += `H${X(d.i + 1)}`;
    if (d.i >= pr.ti) { spend += `${spend ? 'L' : 'M'}${X(d.i)},${Y(d.i === pr.ti ? d.v : d.s0)}L${X(d.i)},${Y(d.s)}`; }
  });
  const area = `${line}V${Hh - pb}H${X(0)}Z`;
  const y0 = Y(0), neg = pr.days.some(d => d.v < 0);
  const id = 'c' + Math.random().toString(36).slice(2, 7);
  const dots = pr.days.filter(d => d.ops.some(o => o.date)).map(d => {
    const tot = sum(d.ops.filter(o => o.date), o => o.amount);
    return `<circle cx="${X(d.i)}" cy="${Y(d.v)}" r="${big ? 3.2 : 2.4}" fill="${tot < 0 ? 'var(--out)' : 'var(--in)'}" stroke="var(--s1)" stroke-width="1.5"/>`;
  }).join('');
  const lbl = big ? `<text x="${X(0)}" y="${Hh - 6}">${esc(fmtDateS(pr.start))}</text>
    <text x="${X(pr.n)}" y="${Hh - 6}" text-anchor="end">Paie ${esc(fmtDateS(pr.end))}</text>
    ${pr.ti > 0 && pr.ti < pr.n ? `<text x="${X(pr.ti)}" y="${Hh - 6}" text-anchor="middle">Auj.</text>` : ''}
    ${lo < 0 && hi > 0 ? `<text x="${W - pr_}" y="${y0 - 4}" text-anchor="end">0</text>` : ''}` : '';
  return `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-hidden="true" style="aspect-ratio:${W}/${Hh}">
    <defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}n"><rect x="0" y="${y0}" width="${W}" height="${Math.max(0, Hh - y0)}"/></clipPath></defs>
    ${lo < 0 && hi > 0 ? `<line x1="${pl}" x2="${W - pr_}" y1="${y0}" y2="${y0}" stroke="var(--t3)" stroke-dasharray="2 4" stroke-width="1"/>` : ''}
    ${pr.ti > 0 && pr.ti < pr.n ? `<line x1="${X(pr.ti)}" x2="${X(pr.ti)}" y1="${pt}" y2="${Hh - pb}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>` : ''}
    <path d="${area}" fill="url(#${id}g)"/>
    <path d="${spend}" fill="none" stroke="var(--t3)" stroke-width="1.4" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>
    <path class="pc-line" d="${line}" fill="none" stroke="var(--t1)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    ${neg ? `<path d="${line}" fill="none" stroke="var(--danger)" stroke-width="2.2" stroke-linejoin="round" clip-path="url(#${id}n)" vector-effect="non-scaling-stroke"/>` : ''}
    ${dots}${lbl}
    <g class="pc-cur" style="opacity:0"><line x1="0" x2="0" y1="${pt - 4}" y2="${Hh - pb}" stroke="var(--t1)" stroke-width="1" vector-effect="non-scaling-stroke"/><circle r="${big ? 5 : 4}" fill="var(--t1)" stroke="#000" stroke-width="2"/></g>
  </svg>`.replace(/\n\s*/g, '');
  /* La géométrie sert au scrub. */
}
function curveGeom(pr, big) {
  const W = 340, Hh = big ? 176 : 78;
  const [pt, pr_, pb, pl] = big ? [12, 10, 24, 10] : [8, 4, 6, 4];
  const vals = pr.days.flatMap(d => [d.v0, d.v, d.s0, d.s]).concat([0]);
  let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 1) hi = lo + 1;
  const pad = (hi - lo) * .08; lo -= pad; hi += pad;
  return { W, Hh, X: i => pl + (W - pl - pr_) * i / pr.n, Y: v => pt + (Hh - pt - pb) * (hi - v) / (hi - lo), I: x => clamp(Math.round((x - pl) / (W - pl - pr_) * pr.n), 0, pr.n) };
}
/* Scrub au doigt : glisser horizontalement sur la courbe (le défilement vertical reste possible). */
function wireScrub(wrap, pr, big, onDay) {
  const svg = $('svg', wrap), cur = $('.pc-cur', svg), g = curveGeom(pr, big);
  let active = false, moved = false, x0 = 0, last = -1;
  const at = clientX => { const r = svg.getBoundingClientRect(); return g.I((clientX - r.left) / r.width * g.W); };
  const show = i => {
    if (i === last) return; last = i;
    const d = pr.days[i], cx = g.X(i), cy = g.Y(d.v);
    cur.style.opacity = 1;
    cur.firstChild.setAttribute('x1', cx); cur.firstChild.setAttribute('x2', cx);
    cur.lastChild.setAttribute('cx', cx); cur.lastChild.setAttribute('cy', cy);
    onDay(d);
  };
  const hide = () => { if (!active) return; active = false; last = -1; cur.style.opacity = 0; onDay(null); };
  wrap.addEventListener('pointerdown', e => { active = true; moved = false; x0 = e.clientX; show(at(e.clientX)); });
  wrap.addEventListener('pointermove', e => { if (!active) return; if (Math.abs(e.clientX - x0) > 4) moved = true; show(at(e.clientX)); });
  wrap.addEventListener('pointerup', () => setTimeout(hide, moved ? 0 : 450));
  wrap.addEventListener('pointercancel', hide);
  wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
  /* Un scrub n'ouvre pas la fiche ; un simple toucher, si. */
  wrap.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
}
const opsLine = ops => {
  const named = ops.filter(o => o.date || o.undated || o.saving);
  if (!named.length) return 'Aucun mouvement prévu';
  const t = named.slice(0, 2).map(o => `${esc(o.name)} <b>${money(o.amount, { sign: true })}</b>`).join(' · ');
  return named.length > 2 ? `${t} · +${named.length - 2}` : t;
};
const dayLabel = d => d.date === todayISO() ? "Aujourd'hui" : fmtDateS(d.date);

/* ---------- carte « Reste à vivre » : elle suit le doigt ----------
   Pression : légère inclinaison et reflet sous le doigt. Glisser : la carte part dans le sens du geste,
   le mois suivant arrive de l'autre côté. */
function wireHero(hero) {
  if (!hero || !motionOK()) return;
  let s = null;
  const pose = (dx, px, py, k = 1) => {
    const W = hero.offsetWidth, tx = dx >= 0 ? rubber(dx, W * .9, .9) : -rubber(-dx, W * .9, .9);
    const ry = ((px - .5) * 9 + tx / W * 18) * k, rx = (.5 - py) * 7 * k;
    hero.style.transform = `perspective(900px) translateX(${tx}px) rotateY(${ry}deg) rotateX(${rx}deg) scale(${1 - .015 * k})`;
    hero.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); hero.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  };
  const rel = e => { const r = hero.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
  const release = () => {
    hero.classList.remove('touching');
    hero.style.transition = `transform .6s ${EASE}`; hero.style.transform = '';
    setTimeout(() => { hero.style.transition = ''; }, 620);
  };
  hero.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const [px, py] = rel(e);
    s = { x0: e.clientX, y0: e.clientY, dx: 0, samples: [[e.clientX, e.timeStamp]], id: e.pointerId };
    hero.classList.add('touching'); hero.style.transition = 'transform .25s ease-out'; pose(0, px, py);
    setTimeout(() => { if (s) hero.style.transition = 'none'; }, 250);
  });
  hero.addEventListener('pointermove', e => {
    if (!s) return;
    const [px, py] = rel(e);
    s.dx = e.clientX - s.x0;
    s.samples.push([e.clientX, e.timeStamp]); if (s.samples.length > 5) s.samples.shift();
    if (Math.abs(s.dx) > 6) hero.style.transition = 'none';
    pose(s.dx, px, py);
  });
  const end = cancel => {
    if (!s) return;
    const [a, b] = [s.samples[0], s.samples[s.samples.length - 1]];
    const v = b[1] - a[1] > 0 ? (b[0] - a[0]) / (b[1] - a[1]) : 0, dx = s.dx; s = null;
    const W = hero.offsetWidth;
    if (!cancel && (Math.abs(dx) > W * .26 || (Math.abs(v) > .45 && Math.abs(dx) > 24))) shiftMonth(dx < 0 ? 1 : -1, Math.abs(v));
    else release();
  };
  hero.addEventListener('pointerup', () => end(false));
  hero.addEventListener('pointercancel', () => end(true));
}
/* Changement de mois : la carte sort dans le sens du geste, l'autre entre en face ; le reste glisse aussi. */
function shiftMonth(d, velocity = 0) {
  const W = ($('#hero') || {}).offsetWidth || 360;
  const outDur = clamp(380 - velocity * 120, 200, 380);
  withSwap(d, ['#hero', '#moisBody'], () => { ui.ym = ymAdd(ui.ym, d); render(false, { swap: true }); }, {
    from: {
      '#hero': {
        out: [{ opacity: 1 }, { opacity: .5, offset: .6 }, { transform: `perspective(900px) translateX(${-d * W * 1.08}px) rotateY(${-d * 16}deg) scale(.96)`, opacity: 0 }], outDur,
        in: [{ transform: `perspective(900px) translateX(${d * W * .55}px) rotateY(${-d * 12}deg) scale(.96)`, opacity: 0 }, { transform: 'none', opacity: 1 }], inDur: 620
      }
    }
  });
}

/* ---------- maintenir pour confirmer ----------
   « Je l'achète » se remplit pendant qu'on appuie : relâcher avant la fin annule. */
const HOLD_MS = 900;
const holdBtn = (fn, label) => `<button class="btn btn-primary hold" data-hold="${fn}" type="button"><span class="hold-lbl">${esc(label)}</span><span class="hold-fill" aria-hidden="true"><span>${esc(label)}</span></span></button>`;
function wireHold(sh, fn) {
  const b = $(`[data-hold="${fn}"]`, sh); if (!b) return;
  let t = null, done = false, t0 = 0;
  const label = $('.hold-lbl', b).textContent;
  const setLbl = txt => { $('.hold-lbl', b).textContent = txt; $('.hold-fill span', b).textContent = txt; };
  const start = () => {
    if (done || t) return;
    t0 = performance.now(); b.classList.add('holding');
    t = setTimeout(() => {
      t = null; done = true; b.classList.add('done');
      $('.hold-fill span', b).innerHTML = `${icon('check', 18, 2.6)}<span>C'est noté</span>`;
      setTimeout(() => sh._actions && sh._actions[fn] && sh._actions[fn](b), 380);
    }, HOLD_MS);
  };
  const stop = () => {
    if (!t) return;
    clearTimeout(t); t = null; b.classList.remove('holding');
    if (performance.now() - t0 < HOLD_MS * .6) { setLbl('Maintiens appuyé'); clearTimeout(b._lt); b._lt = setTimeout(() => setLbl(label), 1400); }
  };
  b.addEventListener('pointerdown', e => { e.preventDefault(); start(); });
  b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
  b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
  b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stop(); });
  b.addEventListener('contextmenu', e => e.preventDefault());
}

/* ---------- lignes balayables (onglet Flux) ----------
   Balayer vers la gauche : En pause / Reprendre et Résilier. Balayer loin : action principale directe. */
let swipeOpen = null;
function wireSwipes(root) {
  $$('.swipe', root).forEach(row => {
    const item = $('.item', row), acts = $('.swipe-acts', row);
    let s = null, x = 0, justSwiped = false;
    const max = () => acts.offsetWidth;
    const set = (v, anim) => {
      x = v; item.style.transition = anim ? `transform .5s ${EASE}` : 'none';
      item.style.transform = v ? `translateX(${v}px)` : '';
      const W = row.offsetWidth;
      row.classList.toggle('armed', v < -W * .62);
      acts.style.setProperty('--reveal', clamp(-v / max(), 0, 1.6));
    };
    row._close = () => set(0, true);
    row.addEventListener('pointerdown', e => {
      if (e.target.closest('.swipe-acts')) return;
      if (swipeOpen && swipeOpen !== row) { swipeOpen._close(); swipeOpen = null; }
      s = { x0: e.clientX, y0: e.clientY, base: x, decided: false, h: false, samples: [[e.clientX, e.timeStamp]] };
    });
    row.addEventListener('pointermove', e => {
      if (!s) return;
      const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
      if (!s.decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        s.decided = true; s.h = Math.abs(dx) > Math.abs(dy);
        if (!s.h) { s = null; return; }
        row.setPointerCapture(e.pointerId);
      }
      s.samples.push([e.clientX, e.timeStamp]); if (s.samples.length > 5) s.samples.shift();
      let v = s.base + dx;
      if (v > 0) v = rubber(v, 60);
      set(v, false);
    });
    const end = () => {
      if (!s) return;
      const st = s; s = null;
      if (!st.decided) { if (x) { justSwiped = true; set(0, true); swipeOpen = null; } return; }
      justSwiped = true;
      const [a, b] = [st.samples[0], st.samples[st.samples.length - 1]];
      const vel = b[1] - a[1] > 0 ? (b[0] - a[0]) / (b[1] - a[1]) : 0;
      if (row.classList.contains('armed')) { const first = $('.sw-act', acts); set(-row.offsetWidth, true); setTimeout(() => first.click(), 160); return; }
      if (x < -max() / 2 || vel < -.4) { set(-max(), true); swipeOpen = row; }
      else { set(0, true); if (swipeOpen === row) swipeOpen = null; }
    };
    row.addEventListener('pointerup', end); row.addEventListener('pointercancel', end);
    row.addEventListener('click', e => { if (justSwiped && !e.target.closest('.swipe-acts')) { e.stopPropagation(); e.preventDefault(); } justSwiped = false; }, true);
  });
}
document.addEventListener('pointerdown', e => { if (swipeOpen && !swipeOpen.contains(e.target)) { swipeOpen._close(); swipeOpen = null; } }, true);
ICONS.pause = 'M8 5v14M16 5v14';
ICONS.play = 'M7 4.5v15l12-7.5z';
ACTIONS.swPause = el => {
  const f = state.flows.find(x => x.id === el.dataset.id); if (!f) return;
  const ym = ymNow(), st = flowStatus(f, ym), t = { ...flowTerms(f, ym) }; delete t.from;
  upsertHist(f, ym, { ...t, amount: t.amount || flowCurrentAmount(f), pause: st === 'active' });
  save(); swipeOpen = null; render(false); toast(st === 'active' ? `${f.name} en pause` : `${f.name} reprend`, st === 'active' ? 'pause' : 'play'); calMaybeSync();
};
ACTIONS.swEnd = async el => {
  const f = state.flows.find(x => x.id === el.dataset.id); if (!f) return;
  const ym = ymNow();
  const v = await choiceSheet({ title: `Résilier ${f.name} ?`, message: 'Le flux reste dans les mois passés.', choices: [{ v: 'next', label: `Dès ${ymMonth(ymAdd(ym, 1))}` }, { v: 'now', label: `Dès ${ymMonth(ym)}`, cls: 'btn-danger' }] });
  if (!v) { if (swipeOpen) { swipeOpen._close(); swipeOpen = null; } return; }
  f.end = v === 'now' ? ym : ymAdd(ym, 1);
  save(); swipeOpen = null; render(false); toast('Flux résilié', 'trash'); calMaybeSync();
};

/* ---------- grand titre qui se replie dans une barre ---------- */
let navRaf = 0;
function navUpdate() {
  navRaf = 0;
  const nav = $('#navbar'); if (!nav) return;
  const big = ui.tab === 'mois' ? $('#hero') : $('#view .title');
  if (!big || sheetStack.length) return;
  /* Progression mesurée depuis la position de repos : rien ne s'affiche tant qu'on n'a pas défilé. */
  const r = big.getBoundingClientRect(), barH = nav.offsetHeight, top = r.top + scrollY;
  const start = ui.tab === 'mois' ? top + r.height - barH - 60 : Math.max(0, top + r.height * .3 - barH);
  const p = clamp((scrollY - start) / (ui.tab === 'mois' ? 50 : r.height * .6), 0, 1);
  nav.style.setProperty('--p', p.toFixed(3));
  nav.classList.toggle('on', p > .02);
  if (ui.tab !== 'mois') big.style.opacity = (1 - p * .9).toFixed(3);
}
function navSet() {
  const t = $('#navT'); if (!t) return;
  if (ui.tab === 'mois') { const s = monthSummary(ui.ym); t.innerHTML = `${esc(ymLabel(ui.ym))}<b>${odoHTML(s.rest, { id: 'navRest' })}</b>`; odoAfter(t); }
  else t.textContent = ({ flux: 'Flux', epargne: 'Épargne', annee: 'Année' })[ui.tab] || '';
  navUpdate();
}
addEventListener('scroll', () => { if (!navRaf) navRaf = requestAnimationFrame(navUpdate); }, { passive: true });
addEventListener('resize', () => { if (!navRaf) navRaf = requestAnimationFrame(navUpdate); });

/* ---------- objectif atteint : confettis depuis le bouton qui l'a fait atteindre ---------- */
let reachedSet = null;
function goalsCheck() {
  const now = new Set(state.goals.filter(g => g.target > 0 && goalSaved(g) >= g.target).map(g => g.id));
  if (reachedSet && motionOK()) {
    const fresh = [...now].filter(id => !reachedSet.has(id));
    if (fresh.length && performance.now() - origin.t < 8000 && origin.r) {
      const r = origin.r;
      setTimeout(() => confetti(r.left + r.width / 2, r.top + r.height / 2), 420);
    }
  }
  reachedSet = now;
}
function confetti(x, y) {
  const c = document.createElement('canvas'), dpr = Math.min(2, devicePixelRatio || 1);
  c.className = 'confetti'; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.append(c);
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  const cols = ['#3987e5', '#c98500', '#9085e9', '#f4f4f5', '#5468ff', '#8b3dff'];
  const P = Array.from({ length: 90 }, () => {
    const a = -Math.PI / 2 + (Math.random() - .5) * Math.PI * .95, sp = 6 + Math.random() * 9;
    return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, w: 5 + Math.random() * 5, h: 8 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, f: Math.random() * 6, vf: .1 + Math.random() * .2, c: cols[Math.random() * cols.length | 0], round: Math.random() < .3 };
  });
  const t0 = performance.now();
  const tick = t => {
    const k = (t - t0) / 1900;
    g.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => {
      p.vx *= .985; p.vy = p.vy * .985 + .32; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.f += p.vf;
      g.save(); g.globalAlpha = clamp(1.4 - k * 1.4, 0, 1); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.f));
      g.fillStyle = p.c;
      if (p.round) { g.beginPath(); g.arc(0, 0, p.w / 2, 0, Math.PI * 2); g.fill(); } else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    });
    if (k < 1) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}
