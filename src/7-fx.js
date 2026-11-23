/* ============ mouvement et continuité ============
   Règle : rien n'apparaît sans venir du geste qui l'a provoqué.
   - Une feuille sort de l'élément touché et y retourne en se fermant.
   - Onglets, segments, mois, étapes : l'ancien contenu part, le nouveau arrive, dans le sens du geste.
   - Après un enregistrement, les éléments se déplacent au lieu de sauter ; ce qui a changé s'éclaire.
   - Les montants roulent chiffre par chiffre.
   Inspirations (réécrites ici, sans dépendance) : Vaul (feuilles), NumberFlow (odomètre),
   formkit auto-animate (FLIP des listes), Material « container transform », Robinhood (scrub). */

const EASE = 'cubic-bezier(.32,.72,0,1)';
const motionOK = () => !reduceMotion();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* Élastique façon iOS : la résistance augmente avec la distance. */
const rubber = (d, dim, k = .55) => (1 - 1 / (d * k / dim + 1)) * dim;

/* ---------- origine du geste ---------- */
const ORIGIN_ATTRS = ['act', 'type', 'id', 'ym', 'd', 'fn', 'kind', 'tab', 'hold', 'start'];
const origin = { el: null, t: 0, r: null };
function setOrigin(el) { origin.el = el; origin.t = performance.now(); origin.r = el.getBoundingClientRect(); }
function originKey(el) {
  return ORIGIN_ATTRS.filter(a => el.dataset[a] !== undefined).map(a => `[data-${a}="${CSS.escape(el.dataset[a])}"]`).join('');
}
function takeOrigin() {
  const el = origin.el; origin.el = null;
  if (!el || performance.now() - origin.t > 1500 || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 10 || r.height < 10 || r.bottom < 0 || r.top > innerHeight) return null;
  const cs = getComputedStyle(el);
  let bg = cs.backgroundColor;
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.documentElement).getPropertyValue('--s1').trim() || '#141416';
  return { el, r, key: originKey(el), radius: parseFloat(cs.borderTopLeftRadius) || 16, bg };
}
/* Retrouve l'élément d'origine après un nouveau rendu (même clé), visible à l'écran. */
function findOrigin(key, exclude) {
  if (!key) return null;
  let found = null;
  try { found = $$(key).find(e => !(exclude && exclude.contains(e)) && !e.closest('.fx-ghost')); } catch (e) { return null; }
  if (!found) return null;
  const r = rectWithoutRecede(found);
  if (r.width < 10 || r.height < 10 || r.bottom < 0 || r.top > innerHeight) return null;
  return { el: found, r };
}
/* Mesure un élément à sa place finale quand l'arrière-plan revient de son retrait (sans attendre la transition). */
function rectWithoutRecede(el) {
  const app = $('.app'), r = el.getBoundingClientRect();
  if (!app.contains(el)) return r;
  const A = app.getBoundingClientRect(), sx = A.width / app.offsetWidth, sy = A.height / app.offsetHeight;
  if (Math.abs(sx - 1) < .002 && Math.abs(sy - 1) < .002 && Math.abs(A.top - (app.offsetTop - scrollY)) < .5) return r;
  const left = app.offsetLeft - scrollX + (r.left - A.left) / sx, top = app.offsetTop - scrollY + (r.top - A.top) / sy;
  return { left, top, width: r.width / sx, height: r.height / sy, right: left + r.width / sx, bottom: top + r.height / sy };
}

/* ---------- feuilles : arrière-plan en retrait ---------- */
function recede(on) {
  const h = document.documentElement, app = $('.app');
  if (on) app.style.transformOrigin = `50% ${scrollY}px`;
  h.style.removeProperty('--rp');
  h.classList.toggle('receded', on && motionOK());
}
function stackChanged() {
  sheetStack.forEach((e, i) => e.sh.classList.toggle('under', i < sheetStack.length - 1));
}

/* L'élément d'origine « devient » la feuille : il s'efface pendant qu'elle grandit, réapparaît quand elle y revient. */
function lift(el) { if (!el) return; el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140 }); el.classList.add('fx-lifted'); }
function unlift(el) { if (!el || !el.classList.contains('fx-lifted')) return; el.classList.remove('fx-lifted'); el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' }); }
/* Ouverture : la feuille sort de l'élément touché (container transform). */
function sheetOpenFx(entry) {
  const { sh, bd } = entry, o = entry.origin;
  if (!motionOK()) { sh.classList.add('show'); bd.classList.add('show'); return; }
  if (!o) {
    requestAnimationFrame(() => requestAnimationFrame(() => { bd.classList.add('show'); sh.classList.add('show'); }));
    return;
  }
  sh.style.transition = 'none'; sh.classList.add('show'); bd.classList.add('show');
  const R = sh.getBoundingClientRect();
  sh.style.transition = '';
  const sx = o.r.width / R.width, sy = o.r.height / R.height;
  const from = `translate(${o.r.left - R.left}px,${o.r.top - R.top}px) scale(${sx},${sy})`;
  const rad = o.radius;
  sh.style.transformOrigin = '0 0';
  const D = 560;
  const a = sh.animate([
    { transform: from, borderRadius: `${rad / sx}px / ${rad / sy}px`, backgroundColor: o.bg, boxShadow: '0 0 0 rgba(0,0,0,0)' },
    { transform: 'none', borderRadius: '28px 28px 0 0 / 28px 28px 0 0', backgroundColor: getComputedStyle(sh).backgroundColor }
  ], { duration: D, easing: EASE });
  a.onfinish = () => { sh.style.transformOrigin = ''; };
  [...sh.children].forEach(c => c.animate([{ opacity: 0 }, { opacity: 0, offset: .28 }, { opacity: 1 }], { duration: D, easing: 'ease-out' }));
  bd.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
  lift(o.el);
  entry.lifted = o.el;
}
/* Fermeture : retour dans l'élément d'origine s'il est à l'écran, sinon vers le bas (ou dans le sens du lancer). */
function sheetCloseFx(entry, done) {
  const { sh, bd } = entry;
  const drop = () => { unlift(entry.lifted); entry.lifted = null; };
  if (!motionOK()) { sh.classList.remove('show'); bd.classList.remove('show'); drop(); setTimeout(done, 40); return; }
  const fling = entry.fling;
  if (!fling && entry.origin && !entry.deferred) { entry.deferred = true; requestAnimationFrame(() => sheetCloseFx(entry, done)); return; }
  const target = !fling && entry.origin ? findOrigin(entry.origin.key, sh) : null;
  if (target) {
    const R = sh.getBoundingClientRect();
    const r = rectWithoutRecede(target.el);
    const sx = r.width / R.width, sy = r.height / R.height, rad = entry.origin.radius;
    if (entry.lifted && entry.lifted !== target.el) { entry.lifted.classList.remove('fx-lifted'); entry.lifted = null; }
    if (!target.el.classList.contains('fx-lifted')) target.el.classList.add('fx-lifted');
    entry.lifted = target.el;
    sh.style.transformOrigin = '0 0';
    const D = 460;
    const a = sh.animate([
      { transform: getComputedStyle(sh).transform === 'none' ? 'none' : getComputedStyle(sh).transform, borderRadius: '28px 28px 0 0 / 28px 28px 0 0' },
      { transform: `translate(${r.left - R.left}px,${r.top - R.top}px) scale(${sx},${sy})`, borderRadius: `${rad / sx}px / ${rad / sy}px`, backgroundColor: entry.origin.bg }
    ], { duration: D, easing: EASE, fill: 'forwards' });
    [...sh.children].forEach(c => c.animate([{ opacity: 1 }, { opacity: 0, offset: .45 }, { opacity: 0 }], { duration: D, fill: 'forwards' }));
    sh.animate([{ opacity: 1 }, { opacity: 1, offset: .7 }, { opacity: 0 }], { duration: D, fill: 'forwards' });
    bd.classList.remove('show');
    setTimeout(drop, D * .66);
    a.onfinish = done;
    return;
  }
  drop();
  if (fling) {
    /* Continue le geste à la vitesse du doigt. */
    const cur = new DOMMatrix(getComputedStyle(sh).transform).m42 || 0;
    const left = sh.offsetHeight + 40 - cur;
    const dur = clamp(left / Math.max(fling.v, 1.1), 160, 380);
    sh.classList.remove('dragging');
    sh.style.transition = `transform ${dur}ms cubic-bezier(.2,.75,.3,1)`;
    sh.style.transform = `translateY(${sh.offsetHeight + 40}px)`;
    bd.style.transition = `opacity ${dur}ms`; bd.style.opacity = 0;
    setTimeout(done, dur + 30);
    return;
  }
  sh.classList.remove('show'); bd.classList.remove('show');
  setTimeout(done, 480);
}

/* Glisser pour fermer, depuis la poignée, l'en-tête ou le contenu quand il est en haut.
   Vitesse prise en compte, élastique vers le haut, arrière-plan qui suit le doigt. */
function sheetDrag(sh) {
  const body = $('.sheet-body', sh);
  let s = null;
  const entryOf = () => sheetStack.find(e => e.sh === sh);
  const H = () => sh.offsetHeight;
  const apply = d => {
    const v = d >= 0 ? d : -rubber(-d, 80);
    sh.style.transform = `translateY(${v}px)`;
    const p = clamp(1 - Math.max(0, d) / H(), 0, 1);
    const e = entryOf(); if (e) e.bd.style.opacity = p;
    if (sheetStack.length === 1) document.documentElement.style.setProperty('--rp', p);
  };
  const begin = (y, t) => {
    s.drag = true; sh.classList.add('dragging'); document.documentElement.classList.add('sheet-drag');
    s.y0 = y; s.samples = [[y, t]];
    if (document.activeElement && sh.contains(document.activeElement)) document.activeElement.blur();
  };
  const move = (y, t) => {
    s.samples.push([y, t]); if (s.samples.length > 6) s.samples.shift();
    s.dy = y - s.y0; apply(s.dy);
  };
  const end = () => {
    if (!s || !s.drag) { s = null; return; }
    const [a, b] = [s.samples[0], s.samples[s.samples.length - 1]];
    const v = b[1] - a[1] > 0 ? (b[0] - a[0]) / (b[1] - a[1]) : 0;
    const dy = s.dy || 0; s = null;
    document.documentElement.classList.remove('sheet-drag');
    const e = entryOf();
    if (e && (dy > H() * .32 || (v > .5 && dy > 12))) { e.fling = { v: Math.max(v, 1) }; closeSheet(); return; }
    sh.classList.remove('dragging');
    sh.style.transition = `transform .55s ${EASE}`; sh.style.transform = '';
    if (e) { e.bd.style.transition = 'opacity .4s'; e.bd.style.opacity = ''; }
    document.documentElement.style.removeProperty('--rp');
    setTimeout(() => { sh.style.transition = ''; if (e) e.bd.style.transition = ''; }, 560);
  };
  const skip = t => t.closest('[data-scrub],.swipe,input,textarea,select,.seg,.chips');
  /* Tactile : poignée, en-tête, ou contenu défilé tout en haut. */
  sh.addEventListener('touchstart', e => {
    if (e.touches.length > 1 || skip(e.target) && !e.target.closest('.sheet-grab,.sheet-head')) { s = null; return; }
    const t = e.touches[0];
    s = { x0: t.clientX, y0: t.clientY, top: body.scrollTop <= 0, head: !!e.target.closest('.sheet-grab,.sheet-head'), drag: false, decided: false };
  }, { passive: true });
  sh.addEventListener('touchmove', e => {
    if (!s) return;
    const t = e.touches[0], dx = t.clientX - s.x0, dy = t.clientY - s.y0;
    if (!s.decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.decided = true;
      if (Math.abs(dx) > Math.abs(dy) || !(s.head || (s.top && body.scrollTop <= 0 && dy > 0))) { s = null; return; }
      begin(t.clientY, e.timeStamp);
    }
    e.preventDefault(); move(t.clientY, e.timeStamp);
  }, { passive: false });
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', end);
  /* Souris : poignée et en-tête. */
  const grab = $('.sheet-grab', sh), head = $('.sheet-head', sh);
  [grab, head].forEach(el => {
    el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.target.closest('button')) return; s = { decided: true }; begin(e.clientY, e.timeStamp); el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => { if (s && s.drag && e.pointerType === 'mouse') move(e.clientY, e.timeStamp); });
    el.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') end(); });
  });
}

/* ---------- plein écran (bilan) : zoom depuis le bouton ---------- */
function zoomIn(el, o) {
  if (!o || !motionOK()) return;
  const r = o.r, W = innerWidth, Hh = innerHeight;
  const clip = `inset(${r.top}px ${W - r.right}px ${Hh - r.bottom}px ${r.left}px round ${o.radius}px)`;
  el.animate([{ clipPath: clip }, { clipPath: 'inset(0 0 0 0 round 0px)' }], { duration: 560, easing: EASE });
  [...el.children].forEach(c => c.animate([{ opacity: 0 }, { opacity: 0, offset: .3 }, { opacity: 1 }], { duration: 560 }));
}
function zoomOut(el, o, done) {
  const t = o && motionOK() ? findOrigin(o.key, el) : null;
  if (!t) { el.classList.add('out'); setTimeout(done, 320); return; }
  const r = t.r, W = innerWidth, Hh = innerHeight;
  [...el.children].forEach(c => c.animate([{ opacity: 1 }, { opacity: 0, offset: .4 }, { opacity: 0 }], { duration: 460, fill: 'forwards' }));
  el.animate([{ clipPath: 'inset(0 0 0 0 round 0px)' }, { clipPath: `inset(${r.top}px ${W - r.right}px ${Hh - r.bottom}px ${r.left}px round ${o.radius}px)` }], { duration: 460, easing: EASE, fill: 'forwards' }).onfinish = done;
}

/* ---------- glissement directionnel entre deux états ----------
   L'ancien contenu (une copie inerte) part d'un côté, le nouveau arrive de l'autre. */
function ghostOf(el) {
  const g = el.cloneNode(true);
  g.classList.add('fx-ghost'); g.setAttribute('aria-hidden', 'true'); g.removeAttribute('id');
  $$('[id]', g).forEach(x => x.removeAttribute('id'));
  $$('[name]', g).forEach(x => x.removeAttribute('name'));
  $$('[data-act]', g).forEach(x => x.removeAttribute('data-act'));
  $$('input,textarea,select,button', g).forEach(x => x.setAttribute('tabindex', '-1'));
  return g;
}
function withSwap(dir, scopes, mutate, { dist = 56, root = document, from = {} } = {}) {
  if (!motionOK() || !dir) { mutate(); return; }
  const sy0 = scrollY;
  const ghosts = scopes.map(sel => {
    const el = typeof sel === 'string' ? $(sel, root) : sel; if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.bottom < -20 || r.top > innerHeight + 20 || !r.width) return null;
    const host = el.offsetParent || document.body;
    const hr = host.getBoundingClientRect();
    const g = ghostOf(el);
    Object.assign(g.style, { position: 'absolute', left: (r.left - hr.left + host.scrollLeft - host.clientLeft) + 'px', top: (r.top - hr.top + host.scrollTop - host.clientTop) + 'px', width: r.width + 'px', height: r.height + 'px', margin: 0, pointerEvents: 'none', zIndex: 3 });
    g.style.overflow = 'hidden'; host.append(g); g.scrollTop = el.scrollTop;
    return { g, sel, host, top: parseFloat(g.style.top) };
  });
  mutate();
  const dy = scrollY - sy0;
  ghosts.forEach(x => {
    if (!x) return;
    if (dy && !x.host.closest('.sheet')) x.g.style.top = (x.top + dy) + 'px';
    const custom = from[x.sel];
    /* L'ancien s'efface vite (60 % du trajet) pour que les deux contenus se croisent sans se mélanger. */
    const out = custom && custom.out || [{ transform: x.g.style.transform || 'none', opacity: 1 }, { opacity: 0, offset: .6 }, { transform: `translateX(${-dir * dist}px)`, opacity: 0 }];
    x.g.animate(out, { duration: custom && custom.outDur || 260, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' }).onfinish = () => x.g.remove();
  });
  scopes.forEach(sel => {
    const el = typeof sel === 'string' ? $(sel, root) : sel; if (!el) return;
    const custom = from[sel];
    el.animate(custom && custom.in || [{ transform: `translateX(${dir * dist}px)`, opacity: 0 }, { opacity: 0, offset: .12 }, { transform: 'none', opacity: 1 }], { duration: custom && custom.inDur || 480, easing: EASE });
  });
}

/* ---------- FLIP : ce qui reste se déplace, ce qui arrive s'ouvre, ce qui change s'éclaire ---------- */
function fxKey(el) {
  if (el.dataset.k) return 'k:' + el.dataset.k;
  if (el.dataset.chart) return 'c:' + el.dataset.chart;
  if (el.dataset.id && el.dataset.type) return `${el.dataset.type}:${el.dataset.id}:${el.dataset.ym || ''}`;
  if (el.classList.contains('sec')) { const t = $('.sec-title', el); return t ? 's:' + t.textContent : null; }
  if (el.classList.contains('note')) { const t = $('b', el); return t ? 'n:' + t.textContent : null; }
  return null;
}
const FX_SEL = '[data-k],[data-chart],[data-type][data-id],.sec,.note,.bigstat,.tiles,.group,.empty,.cta';
function fxSnap(root) {
  const m = new Map();
  $$(FX_SEL, root).forEach(el => {
    if (el.closest('.fx-ghost')) return;
    const k = fxKey(el) || (el.classList.contains('bigstat') ? 'bigstat' : null);
    if (!k || m.has(k)) return;
    m.set(k, { r: el.getBoundingClientRect(), html: el.dataset.type || el.dataset.k ? strip(el.outerHTML) : null });
  });
  return m;
}
const strip = h => h.replace(/ style="[^"]*"/g, '').replace(/ class="[^"]*"/g, '');
function fxPlay(root, before) {
  if (!motionOK() || !before || !before.size) return;
  const seen = new Set();
  $$(FX_SEL, root).forEach(el => {
    if (el.closest('.fx-ghost')) return;
    const k = fxKey(el) || (el.classList.contains('bigstat') ? 'bigstat' : null);
    if (!k || seen.has(k)) return; seen.add(k);
    const r = el.getBoundingClientRect();
    if (r.bottom < -40 || r.top > innerHeight + 40) return;
    const b = before.get(k);
    /* L'ancêtre déjà animé emporte ses enfants : on ne double pas le mouvement. */
    const parentMoved = el.parentElement && el.parentElement.closest('[data-fx-moved]');
    if (b) {
      const dx = b.r.left - r.left, dy = b.r.top - r.top;
      if (!parentMoved && (Math.abs(dx) > .5 || Math.abs(dy) > .5)) {
        el.dataset.fxMoved = 1;
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 520, easing: EASE }).onfinish = () => delete el.dataset.fxMoved;
      }
      if (b.html !== null && b.html !== strip(el.outerHTML)) flash(el);
    } else if (!parentMoved && (el.dataset.type || el.dataset.k || el.classList.contains('note') || el.classList.contains('sec'))) {
      el.dataset.fxMoved = 1;
      el.animate([{ opacity: 0, transform: 'translateY(-6px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE }).onfinish = () => delete el.dataset.fxMoved;
      if (el.dataset.type || el.dataset.k) flash(el, 140);
    }
  });
  $$('[data-fx-moved]', root).forEach(el => setTimeout(() => delete el.dataset.fxMoved, 600));
}
function flash(el, delay = 0) {
  el.animate([{ boxShadow: 'inset 0 0 0 100vmax rgba(255,255,255,.10)' }, { boxShadow: 'inset 0 0 0 100vmax rgba(255,255,255,0)' }], { duration: 1100, delay, easing: 'ease-out' });
}
/* Hauteur d'une feuille qui change : elle s'étire au lieu de sauter. */
function sheetResize(sh, h0) {
  if (!motionOK() || sh.classList.contains('full') || sh.classList.contains('dragging')) return;
  const h1 = sh.offsetHeight;
  if (Math.abs(h1 - h0) < 2) return;
  sh.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 440, easing: EASE });
}

/* ---------- segments : l'indicateur glisse même après un nouveau rendu ---------- */
function segSnap(root) { return Object.fromEntries($$('.seg[data-seg]', root).map(s => [s.dataset.seg, s.style.getPropertyValue('--i')])); }
function segPlay(root, before) {
  if (!motionOK()) return;
  $$('.seg[data-seg]', root).forEach(s => {
    const old = before[s.dataset.seg], now = s.style.getPropertyValue('--i');
    if (old === undefined || old === now) return;
    const ind = $('.seg-ind', s); ind.style.transition = 'none'; s.style.setProperty('--i', old);
    void ind.offsetWidth; ind.style.transition = ''; s.style.setProperty('--i', now);
  });
}

/* ---------- odomètre ----------
   Chaque chiffre est une colonne 0-9 qui roule. Les chiffres sont repérés par leur rang
   depuis la virgule : 9,50 → 10,50 fait rouler les unités et ouvre une dizaine. */
const odoMem = {};
function odoKeys(s) {
  const ci = s.lastIndexOf(','), intPart = ci >= 0 ? s.slice(0, ci) : s;
  const nInt = (intPart.match(/\d/g) || []).length;
  let a = 0, b = 0;
  return [...s].map((c, i) => /\d/.test(c) ? (ci < 0 || i < ci ? 'i' + (nInt - 1 - a++) : 'f' + b++) : null);
}
function odoInner(s, dec) {
  const ks = odoKeys(s), ci = s.lastIndexOf(',');
  let out = '';
  [...s].forEach((c, i) => {
    if (dec && i === ci) out += '<span class="dec">';
    if (ks[i]) out += `<span class="od" data-k="${ks[i]}"><span class="od-ph">${c}</span><span class="od-col" style="--d:${c}"></span></span>`;
    else out += `<span class="od-s">${c === ' ' || c === ' ' || c === ' ' ? '&nbsp;' : esc(c)}</span>`;
  });
  if (dec && ci >= 0) out += '</span>';
  return out;
}
function odoHTML(n, { id = '', fmt = money, dec = false, cls = '' } = {}) {
  const s = typeof n === 'string' ? n : fmt(n);
  return `<span class="odo ${cls}"${id ? ` data-odo="${id}"` : ''} data-s="${esc(s)}"${dec ? ' data-dec="1"' : ''}>${odoInner(s, dec)}</span>`;
}
/* Fait rouler les chiffres depuis l'ancienne valeur. */
function odoRoll(el, prev, prevW) {
  const s = el.dataset.s;
  if (!motionOK() || !prev || prev === s) return;
  const pk = odoKeys(prev), map = {};
  [...prev].forEach((c, i) => { if (pk[i]) map[pk[i]] = c; });
  const cols = [];
  $$('.od', el).forEach(o => {
    const col = o.lastChild, k = o.dataset.k;
    if (k in map) { col.style.transition = 'none'; const to = col.style.getPropertyValue('--d'); col.style.setProperty('--d', map[k]); cols.push([col, to]); }
    else o.animate([{ opacity: 0, transform: 'translateY(.35em) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE });
  });
  const w1 = el.getBoundingClientRect().width;
  if (prevW && Math.abs(prevW - w1) > .5) el.animate([{ width: prevW + 'px' }, { width: w1 + 'px' }], { duration: 620, easing: EASE });
  void el.offsetWidth;
  cols.forEach(([col, to]) => { col.style.transition = ''; col.style.setProperty('--d', to); });
}
/* Après un rendu : chaque odomètre nommé repart de sa dernière valeur affichée. */
function odoAfter(root) {
  $$('[data-odo]', root).forEach(el => {
    if (el.closest('.fx-ghost')) return;
    const id = el.dataset.odo, m = odoMem[id];
    odoRoll(el, m && m.s, m && m.w);
    odoMem[id] = { s: el.dataset.s, w: el.getBoundingClientRect().width };
  });
}
/* Mise à jour en place (scrub, saisie) : les colonnes repartent de leur position actuelle. */
function odoSet(el, n, fmt = money) {
  if (!el) return;
  const s = typeof n === 'string' ? n : fmt(n), prev = el.dataset.s;
  if (s === prev) return;
  const w0 = el.getBoundingClientRect().width;
  const same = prev && odoKeys(prev).join() === odoKeys(s).join() && prev.replace(/\d/g, '') === s.replace(/\d/g, '');
  el.dataset.s = s;
  if (same) {
    const ks = odoKeys(s), byK = {};
    [...s].forEach((c, i) => { if (ks[i]) byK[ks[i]] = c; });
    $$('.od', el).forEach(o => { const c = byK[o.dataset.k]; o.firstChild.textContent = c; o.lastChild.style.setProperty('--d', c); });
  } else {
    el.innerHTML = odoInner(s, el.dataset.dec === '1');
    odoRoll(el, prev, w0);
  }
  if (el.dataset.odo) odoMem[el.dataset.odo] = { s, w: el.getBoundingClientRect().width };
}
