// Tests des calculs : node test/unit.js (aucune dépendance).
// Charge src/1-core.js dans un contexte isolé et vérifie les fonctions pures.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/1-core.js'), 'utf8'), ctx, { filename: '1-core.js' });
const run = code => vm.runInContext(code, ctx);

let failed = 0, passed = 0;
function test(name, fn) {
  try { run('state = freshState(); state.settings.created = "2026-01-01"; state.settings.calWeekly = false;'); fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  ÉCHEC  ' + name + '\n        ' + e.message); }
}
function eq(actual, expected, label = '') {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label} attendu ${b}, obtenu ${a}`);
}
const set = (k, v) => { ctx.__v = v; run(`state.${k} = __v;`); };
const flow = (kind, amount, terms = {}, extra = {}) => ({ id: Math.random().toString(36).slice(2), kind, name: 'x', cat: 'autres-out', due: null, end: null,
  hist: [{ from: '2026-01', amount, pause: false, employer: 0, freq: 'm', month: null, ...terms }], ...extra });

console.log('Calculs STM');

test('montants saisis à la française', () => {
  eq(run(`parseAmount('1 234,50 €')`), 1234.5);
  eq(run(`parseAmount('12,5')`), 12.5);
  eq(Number.isNaN(run(`parseAmount('')`)), true);
});

test('placement : rouvrir une clôture ne compte pas le versement deux fois', () => {
  const p = { ops: [{ ym: '2026-09', kind: 'value', amount: 1400 }, { ym: '2026-10', kind: 'deposit', amount: 100, src: 'close' }, { ym: '2026-10', kind: 'value', amount: 1500, src: 'close' }] };
  ctx.__p = p;
  eq(run('placementValueAt(__p)'), 1500, '1re clôture');
  run(`__p.ops = __p.ops.filter(o => !(o.ym === '2026-10' && o.kind === 'deposit')); __p.ops.push({ ym: '2026-10', kind: 'deposit', amount: 100, src: 'close' });`);
  eq(run('placementValueAt(__p)'), 1500, 'après réouverture');
});

test('placement : un versement rétroactif avant une valorisation ne change pas la valeur', () => {
  ctx.__p = { ops: [{ ym: '2026-10', kind: 'value', amount: 1500 }, { ym: '2026-09', kind: 'deposit', amount: 50 }] };
  eq(run('placementValueAt(__p)'), 1500);
  eq(run(`placementValueAt(__p, '2026-09')`), 50);
});

test('placement : versements et retraits après la dernière valorisation', () => {
  ctx.__p = { ops: [{ ym: '2026-09', kind: 'value', amount: 1000 }, { ym: '2026-10', kind: 'deposit', amount: 100 }, { ym: '2026-10', kind: 'abond', amount: 40 }, { ym: '2026-11', kind: 'withdraw', amount: 30 }] };
  eq(run('placementValueAt(__p)'), 1110);
  eq(run('placementBreakdown(__p).gain'), 0, 'la valeur de départ n’est pas une plus-value');
  run(`__p.ops.push({ ym: '2026-12', kind: 'value', amount: 1200 })`);
  eq(run('placementBreakdown(__p).gain'), 90);
});

test('flux trimestriel et annuel', () => {
  ctx.__f = flow('out', 30, { freq: 'q', month: 2 });
  eq(['2026-02', '2026-03', '2026-05', '2026-11'].map(m => run(`flowGross(__f, '${m}')`)), [30, 0, 30, 30]);
  ctx.__f = flow('out', 120, { freq: 'y', month: 9 });
  eq([run(`flowGross(__f, '2026-09')`), run(`flowGross(__f, '2026-10')`), run('flowMonthlyEq(__f, "2026-10")')], [120, 0, 10]);
});

test('pause et résiliation', () => {
  const f = flow('out', 20);
  f.hist.push({ from: '2026-04', amount: 20, pause: true, employer: 0, freq: 'm', month: null });
  f.hist.push({ from: '2026-06', amount: 25, pause: false, employer: 0, freq: 'm', month: null });
  f.end = '2026-09'; ctx.__f = f;
  eq(['2026-03', '2026-04', '2026-06', '2026-09'].map(m => run(`flowGross(__f, '${m}')`)), [20, 0, 25, 0]);
});

test('part employeur datée : la changer ne réécrit pas les mois passés', () => {
  const f = flow('out', 100, { employer: 90 });
  f.hist.push({ from: '2026-09', amount: 100, pause: false, employer: 50, freq: 'm', month: null });
  ctx.__f = f;
  eq([run(`flowNet(__f, '2026-08')`), run(`flowNet(__f, '2026-09')`)], [10, 50]);
});

test('reste à vivre du mois', () => {
  set('flows', [flow('in', 1500), flow('out', 600), flow('out', 80, { employer: 50 })]);
  set('oneoffs', [{ id: 'o', kind: 'out', label: 'x', amount: 120, date: '2026-03-14', cat: 'voyages' }]);
  set('goals', [{ id: 'g', name: 'x', target: 1000, plan: 100, moves: [{ ym: '2026-03', amount: 100 }] }]);
  const s = run(`monthSummary('2026-03')`);
  eq([s.totIn, s.totOut, s.savings, s.rest], [1500, 760, 100, 640]);
});

test('épargne prévue : objectifs et versements prévus sur les placements', () => {
  set('goals', [{ id: 'g', name: 'x', target: 1000, plan: 100, moves: [] }]);
  set('placements', [{ id: 'p', name: 'PEE', plan: 50, ops: [] }]);
  eq(run(`savingsPlanned('2099-01')`), 150);
});

test('clôtures : tous les mois en retard sont proposés, dans l’ordre', () => {
  set('flows', [flow('in', 1000)]);
  set('months', { '2026-02': { closed: 'x' } });
  eq(run(`pendingClosings('2026-05')`), ['2026-01', '2026-03', '2026-04']);
  set('months', {});
  run(`state.settings.created = '2026-03-10'`);
  eq(run(`pendingClosings('2026-05')`), ['2026-03', '2026-04'], 'pas avant la création');
});

test('écart avec le solde réel', () => {
  set('flows', [flow('in', 1500), flow('out', 900)]);
  set('placements', [{ id: 'p', name: 'PEE', plan: 0, ops: [{ ym: '2026-03', kind: 'deposit', amount: 100 }] }]);
  set('months', { '2026-02': { closed: 'x', balance: 2000 }, '2026-03': { closed: 'x', balance: 2300 } });
  // attendu : +1500 −900 −100 = +500 ; réel : +300 → 200 € non suivis
  eq(run(`expectedDelta('2026-03')`), 500);
  eq(run(`monthGap('2026-03')`), -200);
  eq(run(`monthGap('2026-02')`), null, 'sans solde du mois précédent');
});

test('flux présent dans un mois clôturé', () => {
  ctx.__f = flow('out', 10);
  set('months', { '2026-02': { closed: 'x' } });
  eq(run('flowInClosedMonths(__f)'), true);
  ctx.__f = flow('out', 10, { freq: 'y', month: 7 });
  eq(run('flowInClosedMonths(__f)'), false);
});

test('préavis', () => {
  eq(run(`noticeDate({ endCommit: '2026-03-31', noticeN: 1, noticeU: 'm' })`), '2026-02-28');
  eq(run(`noticeDate({ endCommit: '2026-03-31', noticeN: 15, noticeU: 'd' })`), '2026-03-16');
});

test('migration v1 : termes copiés dans l’historique', () => {
  const v1 = { v: 1, settings: { demo: true }, flows: [{ id: 'a', kind: 'out', name: 'x', cat: 'x', freq: 'y', month: 9, employer: 50, hist: [{ from: '2026-01', amount: 120 }, { from: '2026-06', amount: 130, pause: true }] }],
    placements: [{ id: 'p', name: 'x', ops: [{ ym: '2026-10', kind: 'value', amount: 1000 }, { ym: '2026-10', kind: 'deposit', amount: 100 }] }] };
  ctx.__s = v1;
  const out = run('migrate(__s)');
  eq(out.v, 2);
  eq(out.settings.demo, undefined, 'mode exemple retiré');
  eq(out.flows[0].hist.map(h => [h.freq, h.month, h.employer]), [['y', 9, 50], ['y', 9, 50]]);
  eq(out.flows[0].freq, undefined);
  ctx.__p = out.placements[0];
  eq(run('placementValueAt(__p)'), 1100, 'même valeur qu’en v1');
});

test('calendrier : rappels envoyés au raccourci', () => {
  set('contracts', [{ id: 'c', name: 'Box', org: 'FAI', endCommit: '2027-03-31', noticeN: 1, noticeU: 'm' }]);
  set('flows', [flow('out', 10, {}, { name: 'Essai', due: '2026-12-15' }), flow('out', 10, {}, { name: 'Ancien', due: '2026-12-20', end: '2026-06' })]);
  run(`state.settings.calWeekly = true`);
  const ev = run(`calendarEvents('2026-11-23')`).filter(e => e.title !== 'Point solde STM');
  const sundays = run(`calendarEvents('2026-11-23')`).filter(e => e.title === 'Point solde STM');
  eq([sundays.length, sundays[0].date, sundays[1].date, sundays[0].alert], [12, '2026-11-29', '2026-12-06', 'event'], 'point solde chaque dimanche');
  const titles = ev.map(e => e.title);
  eq(titles.includes('Résilier Box (préavis)'), true, 'préavis');
  eq(ev.find(e => e.title === 'Résilier Box (préavis)').days, 97, 'jours jusqu’au 28 février');
  eq(ev.find(e => e.title === 'Résilier Box (préavis)').alert, 'week');
  eq(ev.find(e => e.title === 'Fin d’engagement : Box' || e.title === "Fin d'engagement : Box").alert, 'day');
  eq(titles.includes('Échéance : Essai'), true, 'échéance');
  eq(titles.includes('Échéance : Ancien'), false, 'pas de rappel pour un flux résilié');
  eq(ev.filter(e => e.title.startsWith('Clôturer')).length, 12, 'clôtures sur 12 mois');
  eq(ev[0].title, 'Clôturer novembre dans STM', 'trié par date');
  eq([ev[0].date, ev[0].alert], ['2026-12-01', 'event'], 'clôture le 1er, alerte à l’heure');
  run(`state.settings.calClosing = false`);
  eq(run(`calendarEvents('2026-11-23')`).some(e => e.title.startsWith('Clôturer')), false, 'rappel de clôture désactivable');
});

test('calendrier : URL du raccourci et détection des changements', () => {
  set('contracts', [{ id: 'c', name: 'Box', endCommit: '2027-03-31', noticeN: 0 }]);
  const url = run(`calendarURL('2026-11-23')`);
  eq(url.startsWith('shortcuts://run-shortcut?name=STM%20Calendrier&input=text&text='), true);
  const payload = JSON.parse(decodeURIComponent(url.split('&text=')[1]));
  eq(Object.keys(payload.events[0]), ['days', 'hour', 'title', 'notes', 'alert']);
  eq(payload.events[0].hour, 9, 'heure par défaut');
  run(`state.settings.calReady = true; state.settings.calSig = calSig()`);
  eq(run('calPending()'), false);
  run(`state.contracts[0].endCommit = '2027-04-30'`);
  eq(run('calPending()'), true, 'changement de date détecté');
});

test('rappels de dépenses : chaque occurrence du flux, jour ajusté au mois', () => {
  const loyer = flow('out', 540, {}, { name: 'Loyer', day: 31, remind: { on: true, alert: 'day' } });
  loyer.hist.push({ from: '2027-03', amount: 560, pause: false, employer: 0, freq: 'm', month: null });
  loyer.hist.push({ from: '2027-05', amount: 560, pause: true, employer: 0, freq: 'm', month: null });
  const assur = flow('out', 120, { freq: 'y', month: 2 }, { name: 'Assurance', day: 10, remind: { on: true, alert: 'week' } });
  const sans = flow('out', 10, {}, { name: 'Sans rappel', remind: null });
  set('flows', [loyer, assur, sans]);
  run(`state.settings.calClosing = false; state.settings.calHour = 8`);
  const ev = run(`calendarEvents('2026-11-23')`);
  const l = ev.filter(e => e.title.startsWith('Loyer'));
  eq(l.map(e => e.date), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'], 'dates (pause à partir de mai)');
  eq(l[0].title, 'Loyer : 540,00 €');
  eq(l[4].title, 'Loyer : 560,00 €', 'montant daté');
  eq([l[0].alert, l[0].hour, l[0].notes], ['day', 8, 'Prélèvement prévu']);
  eq(ev.filter(e => e.title.startsWith('Assurance')).map(e => [e.date, e.alert]), [['2027-02-10', 'week']], 'annuel : une seule occurrence');
  eq(ev.some(e => e.title.startsWith('Sans rappel')), false);
});

test('rappel d’une grosse dépense prévue', () => {
  set('oneoffs', [{ id: 'a', kind: 'out', label: 'Billets', amount: 120, date: '2027-01-10', cat: 'voyages', remind: { on: true, alert: 'week' } },
                  { id: 'b', kind: 'out', label: 'Passée', amount: 80, date: '2026-10-10', cat: 'voyages', remind: { on: true, alert: 'day' } }]);
  run(`state.settings.calClosing = false`);
  eq(run(`calendarEvents('2026-11-23')`).filter(e => !e.title.startsWith('Ton bilan')).map(e => [e.title, e.alert]), [['Billets : 120,00 €', 'week']]);
});

test('migration : un raccourci de la 1.2 doit être refait', () => {
  ctx.__s = { v: 2, settings: { calReady: true }, flows: [] };
  const out = run('migrate(__s)');
  eq([out.settings.calReady, out.settings.calNeedsUpdate], [false, true]);
});

const salaire = (day = 28) => flow('in', 1500, {}, { name: 'Salaire', day });
test('point solde : libre et marge par jour jusqu’à la paie', () => {
  set('flows', [salaire(28), flow('in', 300, {}, { name: 'Garde', day: 5 }), flow('out', 540, {}, { name: 'Loyer', day: 5 }),
    flow('out', 10, {}, { name: 'Musique', day: 24 }), flow('out', 80, { employer: 50 }, { name: 'Transport', day: 26 }), flow('out', 9, {}, { name: 'Sans jour' })]);
  set('oneoffs', [{ id: 'a', kind: 'out', label: 'Billets', amount: 120, date: '2026-11-25', cat: 'voyages' }]);
  set('balances', [{ date: '2026-11-23', amount: 800 }]);
  const p = run(`pulse('2026-11-23')`);
  eq([p.pay.date, p.pay.flow.name], ['2026-11-28', 'Salaire']);
  eq(p.items.map(x => [x.name, x.amount]), [['Sans jour', -9], ['Musique', -10], ['Billets', -120], ['Transport', -40]]);
  eq([p.free, p.days, p.perDay, p.undated], [621, 5, 124.2, 1]);
});

test('point solde : un solde ancien compte ce qui est passé depuis', () => {
  set('flows', [salaire(28), flow('out', 10, {}, { name: 'Musique', day: 20 })]);
  set('balances', [{ date: '2026-11-18', amount: 500 }]);
  const p = run(`pulse('2026-11-23')`);
  eq([p.items.map(x => x.name), p.free, p.days], [['Musique'], 490, 5]);
});

test('point solde : paie le mois suivant, et sans revenu daté', () => {
  set('flows', [salaire(5), flow('out', 540, {}, { name: 'Loyer', day: 1 })]);
  set('balances', [{ date: '2026-11-23', amount: 1000 }]);
  let p = run(`pulse('2026-11-23')`);
  eq([p.pay.date, p.items.map(x => [x.date, x.name]), p.free, p.days], ['2026-12-05', [['2026-12-01', 'Loyer']], 460, 12]);
  set('flows', [flow('in', 1500, {}, { name: 'Salaire' }), flow('out', 540, {}, { name: 'Loyer', day: 30 })]);
  p = run(`pulse('2026-11-23')`);
  eq([p.pay.date, p.pay.flow, p.ignored], ['2026-12-01', null, ['Salaire']], 'fin du mois, revenu sans jour ignoré');
});

test('point solde : épargne prévue du mois pas encore faite', () => {
  set('flows', [salaire(28)]);
  set('goals', [{ id: 'g', name: 'Permis', target: 1000, plan: 100, moves: [] }]);
  set('balances', [{ date: '2026-11-23', amount: 600 }]);
  eq(run(`pulse('2026-11-23')`).free, 500);
  run(`state.goals[0].moves.push({ ym: '2026-11', amount: 100 })`);
  eq(run(`pulse('2026-11-23')`).free, 600, 'épargne déjà faite');
});

test('je peux me le permettre ?', () => {
  set('flows', [salaire(28), flow('out', 500, {}, { name: 'Loyer', day: 5 })]);
  set('goals', [{ id: 'g', name: 'Permis', target: 1000, plan: 100, moves: [] }]);
  set('balances', [{ date: '2026-11-23', amount: 300 }]);
  let r = run(`afford(80, '2026-11-23')`);
  eq([r.ok, r.freeAfter, r.perDayAfter], [true, 120, 24]);
  r = run(`afford(250, '2026-11-23')`);
  eq([r.ok, r.freeAfter, r.goals], [false, -50, [{ name: 'Permis', weeks: 11 }]]);
  set('balances', []);
  r = run(`afford(250, '2026-11-23')`);
  eq([r.pulse, r.restBefore, r.ok], [null, 900, true], 'sans solde : reste à vivre du mois');
});

test('solde proposé à la clôture', () => {
  set('balances', [{ date: '2026-10-10', amount: 1 }, { date: '2026-10-29', amount: 2 }, { date: '2026-11-02', amount: 3 }, { date: '2026-11-09', amount: 4 }]);
  eq([run(`closingBalanceHint('2026-10')`), run(`closingBalanceHint('2026-11')`)], [3, null]);
});

test('migration : le jour du rappel devient le jour de paiement', () => {
  ctx.__s = { v: 2, settings: {}, flows: [{ id: 'a', kind: 'out', name: 'x', hist: [], remind: { on: true, day: 5, alert: 'day' } }] };
  const out = run('migrate(__s)');
  eq([out.flows[0].day, out.flows[0].remind], [5, { on: true, alert: 'day' }]);
  eq(Array.isArray(out.balances), true);
});

test('prix en heures de travail', () => {
  set('flows', [flow('in', 1213.36, {}, { name: 'Salaire', cat: 'salaire' }), flow('in', 300, {}, { name: 'Garde', cat: 'garde' })]);
  eq(Math.round(run(`hourlyRate('2026-11')`) * 100) / 100, 8, '1213,36 € / 151,67 h');
  eq([run(`workMinutes(4, hourlyRate('2026-11'))`), run(`workMinutes(80, hourlyRate('2026-11'))`), run(`workMinutes(120, hourlyRate('2026-11'))`)], [30, 600, 900]);
  eq([run('fmtWork(30)'), run('fmtWork(65)'), run('fmtWork(600)'), run('fmtWork(900)')], ['30 min', '1 h 05', '1,4 jour de travail', '2,1 jours de travail']);
  run(`state.settings.workHours = 100`);
  eq(Math.round(run(`hourlyRate('2026-11')`) * 100) / 100, 12.13, 'heures réglables');
  set('flows', [flow('in', 900, {}, { name: 'Bourse', cat: 'aides' })]);
  eq(Math.round(run(`hourlyRate('2026-11')`)), 9, 'sans « Salaire » : le plus gros revenu');
});

test('jours d’avance', () => {
  set('flows', [flow('in', 1500), flow('out', 900)]);
  set('balances', [{ date: '2026-11-23', amount: 600 }]);
  eq(run(`daysAhead(latestBalance(), '2026-11-23')`), 20, 'sans historique : charges prévues (900 €/mois)');
  set('months', { '2026-09': { closed: 'x', balance: 1000 }, '2026-10': { closed: 'x', balance: 1100 } });
  eq(Math.round(run(`avgDailySpend('2026-11-23')`) * 30.44), 1150, 'sept. 900, oct. 900 + 500 non suivis');
  eq(run(`daysAhead(latestBalance(), '2026-11-23')`), 15);
});

test('bilan de l’année d’alternance', () => {
  const h = a => [{ from: '2026-09', amount: a, pause: false, employer: 0, freq: 'm', month: null }];
  set('flows', [flow('in', 1000, {}, { name: 'Salaire', cat: 'salaire', hist: h(1000) }), flow('out', 300, {}, { name: 'Loyer', cat: 'logement', hist: h(300) }),
    flow('out', 15, {}, { name: 'Musique', cat: 'abonnements', hist: h(15) })]);
  set('oneoffs', [{ id: 'a', kind: 'out', label: 'Vélo', amount: 400, date: '2026-10-12', cat: 'shopping' }, { id: 'b', kind: 'out', label: 'Hors année', amount: 900, date: '2026-08-12', cat: 'shopping' }]);
  set('goals', [{ id: 'g', name: 'Permis', target: 100, plan: 50, moves: [{ ym: '2026-09', amount: 50 }, { ym: '2026-10', amount: 50 }] }]);
  set('months', { '2026-09': { closed: 'x', balance: 500 }, '2026-10': { closed: 'x', balance: 600 } });
  set('balances', [{ date: '2026-09-28', amount: 500 }, { date: '2026-11-20', amount: 900 }]);
  set('affordLog', [{ date: '2026-10-01', amount: 60, bought: false }, { date: '2026-10-02', amount: 20, bought: true }]);
  const r = run(`yearReview('2026-09', '2026-11-23')`);
  eq([r.label, r.complete, r.months], ['2026–27', false, 3]);
  eq([r.inc, r.out, r.saved], [3000, 1345, 100]);
  eq(r.top, { ym: '2026-10', out: 715 }, 'mois le plus cher');
  eq([r.big.label, r.big.amount], ['Vélo', 400], 'plus gros achat de l’année seulement');
  eq([r.subs.total, r.goalsReached], [45, ['Permis']]);
  eq(r.gap, { total: -185, months: 1 }, 'octobre : +100 réels contre +285 prévus (l’épargne des objectifs reste sur les comptes)');
  eq([r.checkins, r.asks], [2, { count: 2, skipped: 1, skippedAmount: 60 }]);
  eq(r.ahead, { from: 48, to: 45 }, 'avance : 500 € à 315 €/mois, puis 900 € à 607,50 €/mois');
});

test('bilan proposé en août et en septembre', () => {
  set('flows', [flow('in', 1000)]);
  eq([run(`reviewDue('2027-08-10')`), run(`reviewDue('2027-09-03')`), run(`reviewDue('2027-07-10')`)], ['2026-09', '2026-09', null]);
  run(`state.settings.reviewSeen = ['2026-09']`);
  eq(run(`reviewDue('2027-09-03')`), null, 'déjà vu');
});

console.log(`\n${passed} réussis, ${failed} en échec`);
process.exit(failed ? 1 : 0);
