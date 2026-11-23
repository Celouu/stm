/* ---------- UI state ---------- */
const TABS = [
  { id: 'mois', label: 'Mois', icon: 'wallet' },
  { id: 'flux', label: 'Flux', icon: 'flux' },
  { id: 'epargne', label: 'Épargne', icon: 'target' },
  { id: 'annee', label: 'Année', icon: 'chart' }
];
/* fluxSeg : 'in' | 'out' | 'contrats' (les contrats vivent dans l'onglet Flux) */
const ui = { tab: 'mois', ym: ymNow(), fluxSeg: 'out', year: null, yearEdit: false, openCat: null, lastRest: null, heroDir: null };

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, ic = 'check') {
  const t = $('#toast');
  t.innerHTML = `${icon(ic, 18, 2.2)}<span>${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- sheets ---------- */
const sheetStack = [];
function openSheet({ title = '', body = '', foot = '', full = false, onClose, onMount, head = '' }) {
  const host = $('#sheets');
  const bd = document.createElement('div'); bd.className = 'backdrop';
  const sh = document.createElement('section'); sh.className = 'sheet' + (full ? ' full' : '');
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-label', title);
  sh.innerHTML = `<div class="sheet-grab"><div class="sheet-handle"></div></div>
    <header class="sheet-head"><h2 class="sheet-title">${esc(title)}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${icon('close', 20)}</button></header>
    ${head}<div class="sheet-body">${body}</div>${foot ? `<footer class="sheet-foot">${foot}</footer>` : ''}`;
  if (typeof lockEl !== 'undefined' && lockEl) { bd.style.zIndex = 110; sh.style.zIndex = 111; }
  const o = takeOrigin();
  host.append(bd, sh);
  const entry = { bd, sh, onClose, origin: o };
  sheetStack.push(entry);
  document.documentElement.classList.add('locked');
  if (sheetStack.length === 1) recede(true);
  stackChanged();
  bd.addEventListener('click', () => closeSheet());
  enableDrag(sh);
  wireControls(sh);
  if (onMount) onMount(sh);
  sheetOpenFx(entry);
  const nav = $('#navbar'); if (nav) nav.classList.add('hide');
  return sh;
}
function closeSheet(all = false) {
  const entry = sheetStack.pop();
  if (!entry) return;
  const { bd, sh, onClose } = entry;
  if (!sheetStack.length) { document.documentElement.classList.remove('locked'); recede(false); $('#navbar') && $('#navbar').classList.remove('hide'); }
  stackChanged();
  sheetCloseFx(entry, () => { bd.remove(); sh.remove(); });
  if (onClose) onClose();
  if (all && sheetStack.length) closeSheet(true);
}
const topSheet = () => sheetStack.length ? sheetStack[sheetStack.length - 1].sh : null;
/* Contenu d'une feuille : sans direction, ce qui change se déplace et s'éclaire ;
   avec une direction (étapes), l'ancien contenu part et le nouveau arrive. */
function setSheetBody(sh, html, dir = 0) {
  const b = $('.sheet-body', sh), h0 = sh.offsetHeight;
  const apply = () => { const st = b.scrollTop; b.innerHTML = html; b.scrollTop = dir ? 0 : st; wireControls(b); odoAfter(b); };
  if (dir) { withSwap(dir, [b], apply, { dist: 64 }); sheetResize(sh, h0); return; }
  const snap = fxSnap(b);
  apply(); fxPlay(b, snap); sheetResize(sh, h0);
}
function enableDrag(sh) { sheetDrag(sh); }
/* Feuille de choix : renvoie la valeur du bouton touché, ou null si fermée.
   `message` est inséré tel quel : l'appelant échappe ce qui vient de l'utilisateur. */
function choiceSheet({ title, message, choices, extra = [] }) {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (done) return; done = true; res(v); };
    const btn = (c, block = false) => `<button class="btn ${c.cls || 'btn-ghost'}${block ? ' btn-block' : ''}" data-c="${esc(c.v)}"${block ? ' style="margin-top:10px"' : ''}>${esc(c.label)}</button>`;
    const sh = openSheet({
      title, body: `<p class="muted" style="margin:4px 4px 8px;font-size:16px">${message}</p>${extra.map(c => btn(c, true)).join('')}`,
      foot: choices.map(c => btn(c)).join(''),
      onClose: () => finish(null)
    });
    $$('[data-c]', sh).forEach(b => b.addEventListener('click', () => { finish(b.dataset.c); closeSheet(); }));
  });
}
async function confirmSheet(message, okLabel = 'Confirmer', danger = false, title = 'Confirmer') {
  const v = await choiceSheet({ title, message, choices: [{ v: '0', label: 'Annuler' }, { v: '1', label: okLabel, cls: danger ? 'btn-danger' : 'btn-primary' }] });
  return v === '1';
}

/* ---------- small controls ---------- */
function seg(name, options, value) {
  const i = Math.max(0, options.findIndex(o => o[0] === value));
  return `<div class="seg" data-seg="${name}" data-value="${esc(value)}" style="--n:${options.length};--i:${i}"><span class="seg-ind"></span>${options.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`).join('')}</div>`;
}
function chipsCats(name, kind, value) {
  return `<div class="chips" data-chips="${name}" data-value="${esc(value)}">${catList(kind).map(c => `<button type="button" class="chip" data-v="${c.id}" aria-pressed="${c.id === value}"><span class="dotc" style="--c:${catColor(c)}"></span>${esc(c.name)}</button>`).join('')}</div>`;
}
function wireControls(root) {
  $$('.seg', root).forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    const btns = $$('button[data-v]', s); const i = btns.indexOf(b);
    btns.forEach(x => x.setAttribute('aria-pressed', x === b));
    s.style.setProperty('--i', i); s.dataset.value = b.dataset.v;
    s.dispatchEvent(new CustomEvent('segchange', { bubbles: true, detail: { name: s.dataset.seg, value: b.dataset.v } }));
  }));
  $$('[data-chips]', root).forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    $$('button[data-v]', s).forEach(x => x.setAttribute('aria-pressed', x === b));
    s.dataset.value = b.dataset.v;
  }));
  $$('.switch', root).forEach(s => { if (!s.dataset.wired) { s.dataset.wired = 1; s.addEventListener('click', () => s.setAttribute('aria-checked', s.getAttribute('aria-checked') !== 'true')); } });
}
const segVal = (root, name) => { const s = $(`[data-seg="${name}"]`, root); return s ? s.dataset.value : null; };
const chipVal = (root, name) => { const s = $(`[data-chips="${name}"]`, root); return s ? s.dataset.value : null; };
const fieldVal = (root, name) => { const el = $(`[name="${name}"]`, root); return el ? el.value.trim() : ''; };
/* `signed` : montant qui peut être négatif (un solde à découvert). Le pavé « decimal » de l'iPhone
   n'a pas de touche moins : un bouton ± dans le champ change le signe. */
const moneyField = (name, value, ph = '0', cls = '', signed = false) => `<div class="money ${cls}${signed ? ' signed' : ''}">${signed ? `<button type="button" class="money-sign" data-sign aria-label="Montant négatif" aria-pressed="${value < 0}">${icon('pm', 20, 2.2)}</button>` : ''}<input class="input" name="${name}" inputmode="decimal" autocomplete="off" placeholder="${ph}" value="${esc(plainNum(value))}"></div>`;
document.addEventListener('mousedown', e => { if (e.target.closest('[data-sign]')) e.preventDefault(); });  // le champ garde le clavier
document.addEventListener('click', e => {
  const b = e.target.closest('[data-sign]'); if (!b) return;
  const inp = $('input', b.parentElement), v = inp.value.trim();
  inp.value = v.startsWith('-') ? v.slice(1) : '-' + v;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.focus();
});
document.addEventListener('input', e => {
  const m = e.target.closest && e.target.closest('.money.signed');
  if (m) $('[data-sign]', m).setAttribute('aria-pressed', e.target.value.trim().startsWith('-'));
});
const monthOptions = sel => MONTHS.map((m, i) => `<option value="${i + 1}" ${i + 1 === sel ? 'selected' : ''}>${cap(m)}</option>`).join('');
function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function requireField(root, name, test, msg) {
  const el = $(`[name="${name}"]`, root);
  if (test) return true;
  if (el) { shake(el.closest('.money') || el); el.focus({ preventScroll: false }); }
  toast(msg, 'close');
  return false;
}

/* ---------- render ---------- */
function renderTabbar() {
  const bar = $('#tabbar');
  if (!bar.dataset.built) {
    bar.dataset.built = 1;
    bar.insertAdjacentHTML('beforeend', TABS.map(t => `<button class="tab" data-act="tab" data-tab="${t.id}" role="tab">${icon(t.icon, 23)}<span>${t.label}</span></button>`).join(''));
  }
  const i = TABS.findIndex(t => t.id === ui.tab);
  $('#tabInd').style.setProperty('--i', i);
  $$('.tab', bar).forEach(b => b.setAttribute('aria-selected', b.dataset.tab === ui.tab));
}
/* Rendu de l'écran. Par défaut, les éléments qui restent se déplacent et ce qui change s'éclaire.
   `swap` : l'appelant fait glisser l'ancien contenu (onglet, mois, segment), pas de FLIP. */
function render(anim = false, { swap = false } = {}) {
  const v = $('#view');
  const snap = !anim && !swap ? fxSnap(v) : null, segs = segSnap(v);
  v.innerHTML = VIEWS[ui.tab]();
  wireControls(v);
  if (anim && !reduceMotion()) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
  renderTabbar();
  AFTER[ui.tab] && AFTER[ui.tab]();
  segPlay(v, segs);
  odoAfter(v);
  if (snap) fxPlay(v, snap);
  navSet();
  /* Un rendu complet (démarrage, import, effacement) n'est pas un objectif atteint. */
  if (anim) reachedSet = null;
  goalsCheck();
}
function refresh() { render(false); const sh = topSheet(); if (sh && sh._refresh) sh._refresh(); }
/* Onglets : le contenu glisse dans le sens de l'onglet touché. */
function go(tab) {
  if (tab === ui.tab) { window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); return; }
  const dir = Math.sign(TABS.findIndex(t => t.id === tab) - TABS.findIndex(t => t.id === ui.tab));
  withSwap(dir, ['#view'], () => { ui.tab = tab; window.scrollTo(0, 0); render(false, { swap: true }); }, { dist: 44 });
}
