/* ============ STM — Save the Moula ============ */
const APP_VERSION = '1.6.1';
const SCHEMA = 2;

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const r2 = n => Math.round((+n || 0) * 100) / 100;
const sum = (arr, f = x => x) => r2(arr.reduce((a, x) => a + (+f(x) || 0), 0));
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function parseAmount(v) {
  if (typeof v === 'number') return r2(v);
  const s = String(v ?? '').replace(/[\s\u202f\u00a0€]/g, '').replace(',', '.');
  if (s === '' || s === '-' ) return NaN;
  const n = parseFloat(s);
  return isFinite(n) ? r2(n) : NaN;
}
const NF = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const NF0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const NFn = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
function money(n, { sign = false, whole = false } = {}) {
  n = r2(n);
  const s = (whole ? NF0 : NF).format(Math.abs(n)).replace(/\u202f/g, '\u00a0');
  if (n < 0) return '−' + s;
  if (sign && n > 0) return '+' + s;
  return s;
}
const plainNum = n => (n === null || n === undefined || isNaN(n)) ? '' : String(r2(n)).replace('.', ',');
function kShort(n) {
  const a = Math.abs(n);
  if (a >= 1000) return NFn.format(r2(n / 1000)).replace(/,(\d)\d$/, ',$1') + ' k';
  return NFn.format(Math.round(n));
}

/* ---------- dates ---------- */
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const pad = n => String(n).padStart(2, '0');
const ymOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const ymNow = () => ymOf(new Date());
const ymParts = ym => ym.split('-').map(Number);
function ymAdd(ym, n) {
  let [y, m] = ymParts(ym); m += n;
  y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  return `${y}-${pad(m)}`;
}
const ymMonth = ym => MONTHS[ymParts(ym)[1] - 1];
const ymLabel = ym => `${cap(ymMonth(ym))} ${ymParts(ym)[0]}`;
const deMonth = ym => /^[aeiouéè]/i.test(ymMonth(ym)) ? `d'${ymMonth(ym)}` : `de ${ymMonth(ym)}`;
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const isoDate = iso => new Date(iso + 'T12:00:00');
const fmtDate = iso => isoDate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateS = iso => { const d = isoDate(iso); const s = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); return d.getFullYear() !== new Date().getFullYear() ? `${s} ${d.getFullYear()}` : s; };
const daysUntil = iso => Math.round((isoDate(iso) - isoDate(todayISO())) / 864e5);
function isoAddDays(iso, n) { const d = isoDate(iso); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function isoAddMonths(iso, n) { const d = isoDate(iso); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function relDays(iso) {
  const d = daysUntil(iso);
  if (d === 0) return "aujourd'hui";
  if (d === 1) return 'demain';
  if (d === -1) return 'hier';
  if (d < 0) return `il y a ${-d} j`;
  return `dans ${d} j`;
}

/* ---------- palette & categories ---------- */
const SLOT = [null, '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
const GREY = '#7d7d86';
const DEFAULT_CATS = {
  in: [['salaire', 'Salaire', 'briefcase'], ['garde', 'Garde', 'users'], ['aides', 'Aides', 'landmark'], ['primes', 'Primes', 'star'], ['autres-in', 'Autres', 'dots']],
  out: [['logement', 'Logement', 'home'], ['transports', 'Transports', 'train'], ['abonnements', 'Abonnements', 'repeat'], ['telecom', 'Télécom', 'phone'], ['assurances', 'Assurances', 'shield'], ['sante', 'Santé', 'heart'], ['banque', 'Banque', 'card'], ['etudes', 'Études', 'book'], ['loisirs', 'Loisirs', 'sparkle'], ['shopping', 'Shopping', 'bag'], ['voyages', 'Voyages', 'plane'], ['cadeaux', 'Cadeaux', 'gift'], ['autres-out', 'Autres', 'dots']]
};
const DEFAULT_WIDGETS = [
  { id: 'bars', on: true }, { id: 'cats', on: true }, { id: 'incomes', on: true },
  { id: 'savings', on: true }, { id: 'donut', on: false }, { id: 'placements', on: false }
];
const WIDGET_NAMES = { bars: 'Revenus et charges par mois', cats: 'Charges par catégorie', incomes: 'Revenus par source', savings: 'Épargne cumulée', donut: 'Répartition des charges', placements: 'Valeur des placements' };

function freshCats() {
  const mk = (list) => list.map(([id, name, icon], i) => ({ id, name, icon, slot: i < 8 ? i + 1 : 0, fixed: id.startsWith('autres') }));
  return { in: mk(DEFAULT_CATS.in), out: mk(DEFAULT_CATS.out) };
}
function freshState() {
  return {
    v: SCHEMA,
    settings: { pin: null, pinLock: null, calReady: false, calShortcutV: null, calHour: 9, calAuto: true, calClosing: true, calWeekly: true, calSig: null, lastCalSync: null, threshold: 50, workHours: 151.67, reviewSeen: [], yearStart: 9, lastBackup: null, widgets: DEFAULT_WIDGETS.map(w => ({ ...w })), created: todayISO() },
    cats: freshCats(),
    flows: [], oneoffs: [], months: {}, goals: [], placements: [], debts: [], contracts: [], balances: [], affordLog: []
  };
}
let state = freshState();

const catList = kind => state.cats[kind] || [];
function catById(kind, id) {
  if (id === '_debt') return { id: '_debt', name: 'Dettes', icon: 'handshake', slot: 0 };
  return catList(kind).find(c => c.id === id) || catList(kind).find(c => c.fixed) || { id, name: 'Autres', icon: 'dots', slot: 0 };
}
const catColor = c => (c && c.slot) ? SLOT[c.slot] : GREY;

/* ---------- storage (IndexedDB) ---------- */
const Store = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      if (!('indexedDB' in window)) return rej(new Error('no idb'));
      const r = indexedDB.open('stm', 1);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); if (!db.objectStoreNames.contains('files')) db.createObjectStore('files'); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  get(s, k) { return this.tx(s, 'readonly', st => st.get(k)); },
  put(s, k, v) { return this.tx(s, 'readwrite', st => st.put(v, k)); },
  del(s, k) { return this.tx(s, 'readwrite', st => st.delete(k)); },
  keys(s) { return this.tx(s, 'readonly', st => st.getAllKeys()); },
  clear(s) { return this.tx(s, 'readwrite', st => st.clear()); }
};
let saveTimer = null, persistAsked = false;
async function writeState() {
  try {
    if (Store.db) await Store.put('kv', 'state', JSON.parse(JSON.stringify(state)));
    else localStorage.setItem('stm-state', JSON.stringify(state));
  } catch (e) { toast("Enregistrement impossible sur cet appareil", 'close'); }
  if (!persistAsked && navigator.storage && navigator.storage.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeState, 200); }
/* Écriture immédiate, avant de quitter l'app (ouverture de Raccourcis). */
function saveNow() { clearTimeout(saveTimer); return writeState(); }
async function loadState() {
  let s = null;
  try { await Store.open(); s = await Store.get('kv', 'state'); } catch (e) { try { s = JSON.parse(localStorage.getItem('stm-state') || 'null'); } catch (_) {} }
  if (s && s.v) state = migrate(s);
}
function migrate(s) {
  const base = freshState();
  const out = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) } };
  out.cats = s.cats && s.cats.in ? s.cats : base.cats;
  const known = new Set(out.settings.widgets.map(w => w.id));
  DEFAULT_WIDGETS.forEach(w => { if (!known.has(w.id)) out.settings.widgets.push({ ...w }); });
  ['flows', 'oneoffs', 'goals', 'placements', 'debts', 'contracts', 'balances', 'affordLog'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  /* 1.4 : le jour de paiement devient une info du flux (il était dans le rappel). */
  out.flows.forEach(f => { if (f.remind && f.remind.day && !f.day) f.day = f.remind.day; if (f.remind) delete f.remind.day; });
  if (!out.months) out.months = {};
  delete out.settings.demo;
  /* Le raccourci de la 1.2 créait des événements « journée entière » : il faut le refaire. */
  if (out.settings.calReady && out.settings.calShortcutV !== CAL_SHORTCUT_V) { out.settings.calReady = false; out.settings.calNeedsUpdate = true; }
  if ((s.v || 1) < 2) migrateV1(out);
  out.v = SCHEMA;
  return out;
}
/* v1 -> v2 : employeur, fréquence et mois de paiement deviennent datés (dans hist),
   et la valeur initiale d'un placement saisie avant des versements du même mois
   passe au mois précédent pour garder le même total qu'avant. */
function migrateV1(st) {
  st.flows.forEach(f => {
    (f.hist || []).forEach(h => {
      if (h.employer === undefined) h.employer = f.kind === 'out' ? (f.employer || 0) : 0;
      if (h.freq === undefined) h.freq = f.freq || 'm';
      if (h.month === undefined) h.month = h.freq === 'm' ? null : (f.month || 1);
    });
    delete f.employer; delete f.freq; delete f.month;
  });
  st.placements.forEach(p => {
    if (p.plan === undefined) p.plan = 0;
    p.ops.forEach((o, i) => {
      if (o.kind !== 'value' || o.src === 'close') return;
      if (p.ops.some((x, j) => j > i && x.ym === o.ym && x.kind !== 'value')) o.ym = ymAdd(o.ym, -1);
    });
  });
}
const hasData = () => state.flows.length + state.oneoffs.length + state.goals.length + state.placements.length + state.debts.length + state.contracts.length > 0;

/* ---------- calculations ---------- */
/* Un flux a un historique de « termes » datés : hist[{ from, amount, pause, employer, freq, month }].
   Chaque entrée s'applique à partir de son mois, jusqu'à la suivante. Modifier un terme
   à partir d'un mois ne réécrit donc jamais les mois précédents. */
const sortHist = f => f.hist.sort((a, b) => a.from < b.from ? -1 : a.from > b.from ? 1 : 0);
function histAt(f, ym) { let h = null; for (const e of f.hist) if (e.from <= ym) h = e; return h; }
const flowTerms = (f, ym = ymNow()) => histAt(f, ym) || f.hist[0] || { amount: 0, employer: 0, freq: 'm', month: null };
function occurs(t, ym) {
  if (t.freq === 'm') return true;
  const m = ymParts(ym)[1];
  if (t.freq === 'y') return m === t.month;
  return ((m - t.month) % 3 + 3) % 3 === 0;
}
function flowGross(f, ym) {
  if (f.end && ym >= f.end) return 0;
  const h = histAt(f, ym);
  if (!h || h.pause || !h.amount) return 0;
  return occurs(h, ym) ? h.amount : 0;
}
const netOf = (f, g, employer) => f.kind === 'out' ? r2(g * (1 - (employer || 0) / 100)) : g;
const employerAt = (f, ym) => f.kind === 'out' ? (flowTerms(f, ym).employer || 0) : 0;
const flowNet = (f, ym) => netOf(f, flowGross(f, ym), employerAt(f, ym));
function flowStatus(f, ym = ymNow()) {
  if (f.end && ym >= f.end) return 'ended';
  const h = histAt(f, ym);
  if (!h) return 'future';
  if (h.pause) return 'paused';
  return 'active';
}
function flowCurrentAmount(f, ym = ymNow()) {
  const h = histAt(f, ym) || f.hist[0];
  if (h && !h.pause) return h.amount;
  for (let i = f.hist.length - 1; i >= 0; i--) if (!f.hist[i].pause && f.hist[i].amount) return f.hist[i].amount;
  return 0;
}
const freqDiv = t => t.freq === 'm' ? 1 : t.freq === 'q' ? 3 : 12;
function flowMonthlyEq(f, ym = ymNow()) {
  if (flowStatus(f, ym) !== 'active') return 0;
  const h = histAt(f, ym);
  return r2(netOf(f, h.amount, h.employer) / freqDiv(h));
}
function freqLabel(t) {
  if (t.freq === 'm') return 'Mensuel';
  if (t.freq === 'y') return `Annuel, ${MONTHS[t.month - 1]}`;
  return `Trimestriel, dès ${MONTHS[t.month - 1]}`;
}
const isClosed = ym => !!(state.months[ym] && state.months[ym].closed);
const closedMonths = () => Object.keys(state.months).filter(isClosed).sort();
const flowInClosedMonths = f => closedMonths().some(m => flowGross(f, m) > 0);

const goalSaved = g => sum(g.moves, m => m.amount);
const sortByYm = arr => arr.sort((a, b) => a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : 0);
/* Ordre chronologique ; dans un même mois, la valorisation passe en dernier :
   c'est la valeur en fin de mois, versements du mois compris. */
const opsSorted = p => p.ops.slice().sort((a, b) => a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : (a.kind === 'value') - (b.kind === 'value'));
function placementValueAt(p, ym = '9999-12') {
  let val = 0;
  for (const o of opsSorted(p)) {
    if (o.ym > ym) break;
    if (o.kind === 'value') val = o.amount;
    else if (o.kind === 'withdraw') val -= o.amount;
    else val += o.amount;
  }
  return r2(val);
}
function placementBreakdown(p) {
  const by = k => sum(p.ops.filter(o => o.kind === k), o => o.amount);
  const me = by('deposit'), abond = by('abond'), third = by('third'), out = by('withdraw');
  const value = placementValueAt(p);
  /* Si l'historique commence par une valorisation (placement déjà existant à la création),
     ce montant de départ sert de base : ce n'est pas une plus-value. */
  const first = opsSorted(p)[0];
  const start = first && first.kind === 'value' ? first.amount : 0;
  return { me, abond, third, out, value, start, gain: r2(value - (start + me + abond + third - out)) };
}
const debtLeft = d => r2(d.amount - sum(d.moves, m => m.amount));

const placementFlow = (ym, kind) => sum(state.placements, p => sum(p.ops.filter(o => o.ym === ym && o.kind === kind), o => o.amount));
function savingsActual(ym) {
  let s = 0;
  state.goals.forEach(g => g.moves.forEach(m => { if (m.ym === ym) s += m.amount; }));
  return r2(s + placementFlow(ym, 'deposit'));
}
function savingsPlanned(ym) {
  const goals = sum(state.goals.filter(g => goalSaved(g) < g.target && (!g.deadline || ym <= g.deadline) && (!g.start || ym >= g.start)), g => g.plan || 0);
  return r2(goals + sum(state.placements, p => p.plan || 0));
}
function monthSummary(ym) {
  const inc = [], out = [];
  state.flows.forEach(f => {
    const g = flowGross(f, ym); if (!g) return;
    const emp = employerAt(f, ym);
    (f.kind === 'in' ? inc : out).push({ type: 'flow', id: f.id, name: f.name, cat: f.cat, amount: netOf(f, g, emp), gross: g, employer: emp });
  });
  state.oneoffs.forEach(o => { if (o.date.slice(0, 7) === ym) (o.kind === 'in' ? inc : out).push({ type: 'oneoff', id: o.id, name: o.label, cat: o.cat, amount: o.amount }); });
  state.debts.forEach(d => d.moves.forEach(m => {
    if (m.ym === ym) (d.dir === 'owe' ? out : inc).push({ type: 'debt', id: d.id, name: d.dir === 'owe' ? `Remboursement à ${d.who}` : `Remboursement de ${d.who}`, cat: '_debt', amount: m.amount });
  }));
  inc.sort((a, b) => b.amount - a.amount); out.sort((a, b) => b.amount - a.amount);
  const closed = isClosed(ym);
  const actual = savingsActual(ym);
  const planned = !closed && actual === 0 && ym >= ymNow();
  const savings = planned ? savingsPlanned(ym) : actual;
  const totIn = sum(inc, x => x.amount), totOut = sum(out, x => x.amount);
  return { ym, inc, out, totIn, totOut, savings, savingsIsPlan: planned, rest: r2(totIn - totOut - savings), closed };
}
/* Solde réel : total des comptes et livrets (hors placements) saisi à la clôture.
   Variation attendue = revenus − charges − versements sur placements + retraits de placements.
   L'écart avec la variation réelle = ce qui n'est pas suivi (petites dépenses surtout). */
function expectedDelta(ym) {
  const s = monthSummary(ym);
  return r2(s.totIn - s.totOut - placementFlow(ym, 'deposit') + placementFlow(ym, 'withdraw'));
}
function gapFor(ym, balance) {
  const prev = state.months[ymAdd(ym, -1)];
  if (balance === null || balance === undefined || isNaN(balance) || !prev || prev.balance === null || prev.balance === undefined) return null;
  return r2(balance - prev.balance - expectedDelta(ym));
}
const monthGap = ym => isClosed(ym) ? gapFor(ym, state.months[ym].balance) : null;
function yearStartOf(ym) {
  const [y, m] = ymParts(ym); const s = state.settings.yearStart || 9;
  return `${m >= s ? y : y - 1}-${pad(s)}`;
}
const yearMonths = start => Array.from({ length: 12 }, (_, i) => ymAdd(start, i));
function yearLabel(start) { const [y, m] = ymParts(start); return m === 1 ? `${y}` : `${y}–${String(y + 1).slice(2)}`; }
function netWorth() {
  const plc = sum(state.placements, p => placementValueAt(p));
  const goals = sum(state.goals, g => goalSaved(g));
  const owe = sum(state.debts.filter(d => d.dir === 'owe'), d => Math.max(0, debtLeft(d)));
  const owed = sum(state.debts.filter(d => d.dir === 'owed'), d => Math.max(0, debtLeft(d)));
  return { plc, goals, owe, owed, net: r2(plc + goals - owe + owed) };
}
function noticeDate(c) {
  if (!c.endCommit) return null;
  const n = +c.noticeN || 0;
  if (!n) return null;
  return c.noticeU === 'm' ? isoAddMonths(c.endCommit, -n) : isoAddDays(c.endCommit, -n);
}
function upcoming(days = 60) {
  const list = [];
  state.flows.forEach(f => {
    if (f.due && flowStatus(f) !== 'ended') { const d = daysUntil(f.due); if (d >= -3 && d <= days) list.push({ date: f.due, title: f.name, sub: 'Échéance', open: ['flow', f.id] }); }
  });
  state.contracts.forEach(c => {
    const nd = noticeDate(c);
    if (nd) { const d = daysUntil(nd); if (d >= -3 && d <= days) list.push({ date: nd, title: c.name, sub: 'Résilier avant le', open: ['contract', c.id] }); }
    if (c.endCommit) { const d = daysUntil(c.endCommit); if (d >= -3 && d <= days) list.push({ date: c.endCommit, title: c.name, sub: "Fin d'engagement", open: ['contract', c.id] }); }
  });
  return list.sort((a, b) => a.date < b.date ? -1 : 1);
}
function firstDataYm() {
  let m = null;
  const take = ym => { if (ym && (!m || ym < m)) m = ym; };
  state.flows.forEach(f => f.hist.forEach(h => take(h.from)));
  state.oneoffs.forEach(o => take(o.date.slice(0, 7)));
  return m;
}
/* Tous les mois passés non clôturés, du plus ancien au plus récent. */
function pendingClosings(now = ymNow()) {
  const first = firstDataYm();
  if (!first) return [];
  const created = state.settings.created ? state.settings.created.slice(0, 7) : first;
  const out = [];
  for (let m = first > created ? first : created; m < now; m = ymAdd(m, 1)) if (!isClosed(m)) out.push(m);
  return out;
}

/* ---------- point solde : combien je peux dépenser d'ici la paie ----------
   Un seul chiffre saisi (le solde du compte). STM ajoute ce qui doit encore passer
   jusqu'à la prochaine paie : prélèvements et versements datés (jour de paiement des flux),
   grosses dépenses prévues, épargne prévue du mois pas encore faite. */
const lastDayOf = ym => { const [y, m] = ymParts(ym); return new Date(y, m, 0).getDate(); };
const isoMin = (a, b) => a < b ? a : b;
const daysBetween = (a, b) => Math.round((isoDate(b) - isoDate(a)) / 864e5);
const occDate = (f, ym) => `${ym}-${pad(Math.min(f.day, lastDayOf(ym)))}`;
/* Dates de paiement d'un flux strictement entre `from` et `to`. */
function occurrencesBetween(f, from, to) {
  const out = [];
  if (!f.day) return out;
  for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = ymAdd(ym, 1)) {
    const d = occDate(f, ym);
    if (d > from && d < to && flowGross(f, ym) > 0) out.push({ date: d, ym });
  }
  return out;
}
/* Prochaine paie : le plus gros revenu daté, à sa prochaine date après aujourd'hui.
   Sans revenu daté : le 1er du mois suivant. */
function nextPayday(today = todayISO()) {
  let best = null;
  state.flows.filter(f => f.kind === 'in' && f.day).forEach(f => {
    const occ = occurrencesBetween(f, today, isoAddMonths(today, 14))[0];
    if (!occ) return;
    const amt = flowGross(f, occ.ym);
    if (!best || amt > best.amount || (amt === best.amount && occ.date < best.date)) best = { date: occ.date, flow: f, amount: amt };
  });
  return best || { date: `${ymAdd(today.slice(0, 7), 1)}-01`, flow: null, amount: 0 };
}
const latestBalance = () => state.balances.length ? state.balances[state.balances.length - 1] : null;
function pulse(today = todayISO(), bal = latestBalance()) {
  if (!bal) return null;
  const pay = nextPayday(today), from = isoMin(bal.date, today), ym = today.slice(0, 7);
  const items = [], ignored = [];
  state.flows.forEach(f => {
    if (!f.day) {
      /* Sans jour de paiement : une charge du mois est comptée comme encore à passer (prudent),
         un revenu est ignoré. */
      const net = flowNet(f, ym);
      if (net && f.kind === 'out') items.push({ date: null, name: f.name, amount: -net, undated: true });
      else if (net) ignored.push(f.name);
      return;
    }
    occurrencesBetween(f, from, pay.date).forEach(o => {
      const net = flowNet(f, o.ym);
      items.push({ date: o.date, name: f.name, amount: f.kind === 'in' ? net : -net });
    });
  });
  state.oneoffs.forEach(o => { if (o.date > from && o.date < pay.date) items.push({ date: o.date, name: o.label, amount: o.kind === 'in' ? o.amount : -o.amount }); });
  if (!isClosed(ym) && savingsActual(ym) === 0) { const plan = savingsPlanned(ym); if (plan) items.push({ date: null, name: 'Épargne prévue', amount: -plan, saving: true }); }
  items.sort((a, b) => (a.date || '0') < (b.date || '0') ? -1 : 1);
  const free = r2(bal.amount + sum(items, x => x.amount));
  const days = Math.max(1, daysBetween(today, pay.date));
  return { bal, pay, items, ignored, free, days, perDay: r2(free / days), undated: items.filter(x => x.undated).length,
    toPay: r2(-sum(items.filter(x => x.amount < 0), x => x.amount)), toGet: sum(items.filter(x => x.amount > 0), x => x.amount) };
}
/* Simulation d'achat. Sans solde : impact sur le reste à vivre du mois. */
function afford(amount, today = todayISO()) {
  const p = pulse(today), ym = today.slice(0, 7), s = monthSummary(ym);
  const goals = state.goals.filter(g => g.plan > 0 && goalSaved(g) < g.target)
    .map(g => ({ name: g.name, weeks: Math.max(1, Math.ceil(amount / g.plan * 4.345)) })).slice(0, 2);
  return {
    pulse: p,
    freeAfter: p ? r2(p.free - amount) : null,
    perDayAfter: p ? r2((p.free - amount) / p.days) : null,
    restBefore: s.rest, restAfter: r2(s.rest - amount),
    ok: p ? p.free - amount >= 0 : s.rest - amount >= 0,
    goals
  };
}
/* Solde pour pré-remplir la clôture : le dernier point fait entre le 24 du mois et le 3 du suivant. */
function closingBalanceHint(ym) {
  const lo = `${ym}-24`, hi = `${ymAdd(ym, 1)}-03`;
  const b = state.balances.filter(x => x.date >= lo && x.date <= hi).slice(-1)[0];
  return b ? b.amount : null;
}

/* ---------- prix en heures de travail ----------
   Taux horaire = revenus « Salaire » du mois ÷ heures payées par mois (151,67 h = 35 h/semaine
   par défaut ; en alternance, les heures d'école sont payées aussi). Une journée = 7 h. */
function hourlyRate(ym = ymNow()) {
  const hours = +state.settings.workHours || 151.67;
  const ins = state.flows.filter(f => f.kind === 'in' && flowStatus(f, ym) === 'active');
  let pay = ins.filter(f => f.cat === 'salaire');
  if (!pay.length && ins.length) pay = [ins.reduce((a, b) => flowMonthlyEq(b, ym) > flowMonthlyEq(a, ym) ? b : a)];
  const monthly = sum(pay, f => flowMonthlyEq(f, ym));
  return monthly > 0 ? monthly / hours : null;
}
const workMinutes = (amount, rate = hourlyRate()) => rate && amount > 0 ? Math.max(1, Math.round(amount / rate * 60)) : null;
function fmtWork(mins) {
  if (!mins) return '';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 7) return m ? `${h} h ${pad(m)}` : `${h} h`;
  const d = Math.round(mins / 60 / 7 * 10) / 10;
  return `${NFn.format(d)} jour${d >= 2 ? 's' : ''} de travail`;
}

/* ---------- jours d'avance ----------
   Combien de jours ton solde couvrirait tes dépenses sans nouvelle rentrée.
   Dépense moyenne : 3 derniers mois clôturés (charges + dépenses non suivies),
   sinon les charges prévues du mois. */
function avgDailySpend(today = todayISO()) {
  const ym = today.slice(0, 7);
  const months = closedMonths().filter(m => m < ym).slice(-3);
  const monthly = months.length
    ? sum(months, m => { const g = monthGap(m); return monthSummary(m).totOut + (g !== null && g < 0 ? -g : 0); }) / months.length
    : monthSummary(ym).totOut;
  return monthly > 0 ? monthly / 30.44 : null;
}
function daysAhead(bal = latestBalance(), today = todayISO()) {
  const d = avgDailySpend(today);
  return bal && d ? Math.max(0, Math.floor(bal.amount / d)) : null;
}

/* ---------- bilan de l'année d'alternance ---------- */
function yearReview(start, today = todayISO()) {
  const now = today.slice(0, 7);
  const months = yearMonths(start).filter(m => m <= now);
  const last = yearMonths(start)[11];
  const data = months.map(ym => ({ ym, s: monthSummary(ym), gap: monthGap(ym) }));
  const inc = sum(data, d => d.s.totIn), out = sum(data, d => d.s.totOut), saved = sum(data, d => d.s.savingsIsPlan ? 0 : d.s.savings);
  const past = data.filter(d => d.ym < now || d.s.closed);
  const top = past.slice().sort((a, b) => b.s.totOut - a.s.totOut)[0] || null;
  const lo = `${start}-01`, hi = `${last}-31`;
  const big = state.oneoffs.filter(o => o.kind === 'out' && o.date >= lo && o.date <= hi && o.date <= today).sort((a, b) => b.amount - a.amount)[0] || null;
  const subs = sum(data, d => sum(d.s.out.filter(x => x.cat === 'abonnements'), x => x.amount));
  const gaps = data.filter(d => d.gap !== null);
  const bals = state.balances.filter(b => b.date >= lo && b.date <= hi);
  const asks = state.affordLog.filter(a => a.date >= lo && a.date <= hi);
  const skipped = asks.filter(a => !a.bought);
  return {
    start, label: yearLabel(start), complete: now > last, months: months.length,
    inc, out, saved, rest: r2(inc - out - saved),
    top: top && top.s.totOut ? { ym: top.ym, out: top.s.totOut } : null,
    big: big ? { label: big.label, amount: big.amount, ym: big.date.slice(0, 7), mins: workMinutes(big.amount) } : null,
    subs: subs ? { total: subs, mins: workMinutes(subs) } : null,
    goalsReached: state.goals.filter(g => goalSaved(g) >= g.target).map(g => g.name),
    gap: gaps.length ? { total: sum(gaps, d => d.gap), months: gaps.length } : null,
    ahead: bals.length >= 2 ? { from: daysAhead(bals[0], bals[0].date), to: daysAhead(bals[bals.length - 1], bals[bals.length - 1].date) } : null,
    checkins: bals.length,
    asks: asks.length ? { count: asks.length, skipped: skipped.length, skippedAmount: sum(skipped, a => a.amount) } : null
  };
}
/* Bilan à proposer sur l'écran Mois : en août (année en cours) et en septembre (année finie). */
function reviewDue(today = todayISO()) {
  const ym = today.slice(0, 7), endM = ymAdd(yearStartOf(ym), 11);
  const start = ym === endM ? yearStartOf(ym) : ym === yearStartOf(ym) ? ymAdd(yearStartOf(ym), -12) : null;
  if (!start || (state.settings.reviewSeen || []).includes(start)) return null;
  return firstDataYm() && firstDataYm() <= ymAdd(start, 11) ? start : null;
}

/* ---------- calendrier (via le raccourci iOS « STM Calendrier ») ----------
   Une web app n'a pas accès au Calendrier d'iOS. STM envoie donc la liste complète de ses
   rappels à un raccourci, qui vide le calendrier « STM » (événements à venir) et les recrée.
   Chaque rappel est un événement de 30 min à `hour` heures, `days` jours après aujourd'hui :
   le raccourci n'interprète aucun texte de date, quelle que soit la langue de l'iPhone.
   `alert` : 'event' (à l'heure du rappel), 'day' (la veille), 'week' (une semaine avant). */
const CAL_SHORTCUT = 'STM Calendrier';
const CAL_SHORTCUT_V = 2;
const CAL_HORIZON = 400;
const REMIND_ALERTS = [['event', 'Le jour J'], ['day', 'La veille'], ['week', '7 jours avant']];
function calendarEvents(today = todayISO()) {
  const ev = [], hour = state.settings.calHour ?? 9, now = today.slice(0, 7);
  const add = (date, title, notes, alert) => {
    const days = Math.round((isoDate(date) - isoDate(today)) / 864e5);
    if (days >= 1 && days <= CAL_HORIZON) ev.push({ date, days, hour, title, notes, alert });
  };
  state.contracts.forEach(c => {
    const nd = noticeDate(c);
    if (nd) add(nd, `Résilier ${c.name} (préavis)`, `Dernier jour pour résilier. Fin d'engagement le ${fmtDate(c.endCommit)}.`, 'week');
    if (c.endCommit) add(c.endCommit, `Fin d'engagement : ${c.name}`, c.org || '', nd ? 'day' : 'week');
  });
  state.flows.forEach(f => {
    if (f.due && flowStatus(f, now) !== 'ended') add(f.due, `Échéance : ${f.name}`, 'Échéance ou fin d’essai', 'week');
    /* Rappel de prélèvement (ou de versement) à chaque occurrence, sur 12 mois. */
    if (f.remind && f.remind.on && f.day) for (let i = 0; i <= 12; i++) {
      const ym = ymAdd(now, i), g = flowGross(f, ym);
      if (!g) continue;
      add(occDate(f, ym), f.kind === 'out' ? `${f.name} : ${money(g)}` : `${f.name} : +${money(g)}`, f.kind === 'out' ? 'Prélèvement prévu' : 'Versement prévu', f.remind.alert || 'day');
    }
  });
  state.oneoffs.forEach(o => { if (o.remind && o.remind.on) add(o.date, `${o.label} : ${o.kind === 'in' ? '+' : ''}${money(o.amount)}`, o.kind === 'in' ? 'Entrée prévue' : 'Dépense prévue', o.remind.alert || 'day'); });
  if (state.settings.calClosing !== false)
    for (let i = 0; i <= 12; i++) { const ym = ymAdd(now, i); add(`${ym}-01`, `Clôturer ${ymMonth(ymAdd(ym, -1))} dans STM`, '', 'event'); }
  /* Bilan de l'année d'alternance, le dernier jour de l'année. */
  const endM = ymAdd(yearStartOf(now), 11);
  add(`${endM}-${pad(lastDayOf(endM))}`, `Ton bilan ${yearLabel(yearStartOf(now))} est prêt dans STM`, '', 'event');
  /* Point solde du dimanche, sur 12 semaines (prolongé à chaque synchro). */
  if (state.settings.calWeekly !== false) {
    const first = 7 - isoDate(today).getDay();
    for (let w = 0; w < 12; w++) add(isoAddDays(today, first + 7 * w), 'Point solde STM', 'Ouvre STM, tape ton solde : 10 secondes.', 'event');
  }
  return ev.sort((a, b) => a.days - b.days || (a.title < b.title ? -1 : 1));
}
const calSig = (today = todayISO()) => JSON.stringify(calendarEvents(today).map(e => [e.date, e.hour, e.title, e.alert]));
const calPending = () => !!state.settings.calReady && calSig() !== state.settings.calSig;
function calendarURL(today = todayISO()) {
  const events = calendarEvents(today).map(({ days, hour, title, notes, alert }) => ({ days, hour, title, notes, alert }));
  return `shortcuts://run-shortcut?name=${encodeURIComponent(CAL_SHORTCUT)}&input=text&text=${encodeURIComponent(JSON.stringify({ app: 'STM', v: CAL_SHORTCUT_V, events }))}`;
}

/* ---------- files ---------- */
async function shareOrDownload(file) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: file.name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}
function abToB64(buf) {
  const bytes = new Uint8Array(buf); let bin = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
}
function b64ToAb(b64) { const bin = atob(b64); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out.buffer; }
const fmtSize = b => b > 1048576 ? `${NFn.format(r2(b / 1048576))} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`;

/* ---------- crypto (PIN) ---------- */
async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  if (window.crypto && crypto.subtle) {
    const h = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261; for (const b of data) { h ^= b; h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16);
}

/* ---------- icons ---------- */
const ICONS = {
  home: 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z',
  train: 'M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM4 10h16M8 21l2-4M16 21l-2-4M8.5 13.5h.01M15.5 13.5h.01',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  phone: 'M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18h2',
  shield: 'M12 3l7.5 3v6c0 4.6-3.2 7.8-7.5 9-4.3-1.2-7.5-4.4-7.5-9V6z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
  card: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M7 15h3',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z',
  bag: 'M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9zM9 8V6.5a3 3 0 0 1 6 0V8',
  plane: 'M21 3 3 10.5l7 2.5 2.5 7z',
  gift: 'M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7h18v4H3zM12 7v14M12 7c-1.2-2.8-5-3.6-5-1.2C7 7.3 12 7 12 7zm0 0c1.2-2.8 5-3.6 5-1.2 0 1.5-5 1.2-5 1.2z',
  dots: 'M6 12h.01M12 12h.01M18 12h.01',
  briefcase: 'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2A6.5 6.5 0 0 1 21.5 20',
  landmark: 'M3 21h18M5 21v-9M19 21v-9M9.7 21v-9M14.3 21v-9M3 9.5 12 4l9 5.5z',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  handshake: 'M3 11l4-4 3 1 3-2 5 4 3 1M3 11l6 6 2-1 2 2 2-1 2 1 4-5M9 13l2 2M12 11l3 3',
  plus: 'M12 5v14M5 12h14',
  pm: 'M12 4v9M7.5 8.5h9M7.5 19h9',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6', chevD: 'M6 9l6 6 6-6',
  calendar: 'M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  share: 'M12 3v12M8 7l4-4 4 4M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13',
  lock: 'M6 11h12v9.5H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6L6 18',
  up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6',
  wallet: 'M4 7a2 2 0 0 1 2-2h11v3M4 7v11a2 2 0 0 0 2 2h14V8H6a2 2 0 0 1-2-1zM16.5 14h.01',
  flux: 'M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 12h.01',
  chart: 'M3 20.5h18M6 17V11M11 17V5M16 17v-8M21 17v-4',
  backup: 'M12 3v10M8 9l4 4 4-4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  upload: 'M12 15V4M8 8l4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  install: 'M12 3v12M8 7l4-4 4 4M7 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  open: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  coins: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5'
};
function icon(name, size = 22, sw = 1.8) {
  const d = ICONS[name] || ICONS.dots;
  const w = name === 'dots' ? 3 : sw;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}
function catIcon(kind, catId, size = 38) {
  const c = catById(kind, catId);
  const inner = ICONS[c.icon] ? icon(c.icon, 19) : `<span class="letter">${esc((c.name || '?').charAt(0).toUpperCase())}</span>`;
  return `<span class="ico" style="--c:${catColor(c)};width:${size}px;height:${size}px">${inner}</span>`;
}
