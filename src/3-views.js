/* ---------- views ---------- */
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
function heroAmount(n) { const s = money(n); const i = s.lastIndexOf(','); return `${esc(s.slice(0, i))}<span class="dec">${esc(s.slice(i))}</span>`; }
const addBtn = (act, label, extra = '') => `<button class="icon-btn light" data-act="${act}" ${extra} aria-label="${esc(label)}">${icon('plus', 22, 2.2)}</button>`;
function itemRow({ act, attrs = '', ico, title, sub, amt, amtSmall, dim = false }) {
  return `<button class="item tap ${dim ? 'dim' : ''}" data-act="${act}" ${attrs}>${ico}<div class="item-main"><div class="item-title">${esc(title)}</div>${sub ? `<div class="item-sub">${esc(sub)}</div>` : ''}</div><div class="item-amt">${amt}${amtSmall || ''}</div></button>`;
}
function daysSince(iso) { return iso ? Math.round((Date.now() - new Date(iso).getTime()) / 864e5) : null; }
/* Écart entre le solde réel et la prévision : négatif = dépenses non suivies. */
function gapNote(gap, ym) {
  if (gap === null) return '';
  const label = gap < 0 ? 'Dépenses non suivies' : 'Mieux que prévu';
  return `<button class="note" data-act="closing" data-ym="${ym}" style="width:100%;text-align:left"><span class="ico">${icon('coins', 20)}</span><div class="note-text"><b>${label}</b>Écart entre ton solde réel et la prévision</div><b style="white-space:nowrap;font-size:17px">${money(gap, { sign: true })}</b></button>`;
}

/* Jours d'avance, avec l'évolution depuis le point solde d'un autre jour. */
function aheadHTML() {
  const a = daysAhead(); if (a === null) return '';
  const prev = state.balances.slice().reverse().find(b => b.date !== latestBalance().date);
  const pa = prev ? daysAhead(prev) : null, d = pa === null ? 0 : a - pa;
  return `<span>Avance <b>${a} j</b>${d ? ` <span style="color:${d > 0 ? 'var(--ok)' : 'var(--danger)'}">${d > 0 ? '+' : '−'}${Math.abs(d)}</span>` : ''}</span>`;
}
/* Carte « Jusqu'à la paie » : le solde du moment, ce qui doit encore passer, la marge par jour. */
function pulseCard() {
  if (!state.flows.length) return '';
  const p = pulse();
  const head = p ? `<span class="sec-aside small">${p.bal.date === todayISO() ? "Solde d'aujourd'hui" : `Solde d'il y a ${daysBetween(p.bal.date, todayISO())} j`}</span>` : '';
  const affordBtn = `<button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="afford">Je peux me le permettre ?</button>`;
  if (!p || ui.balEdit) {
    const last = latestBalance();
    return `<section class="sec"><div class="sec-head"><h2 class="sec-title">Jusqu'à la paie</h2>${head}</div>
      <div class="bigstat"><span>Ton solde maintenant, tous comptes courants</span>
        <div class="row2" style="margin-top:10px;align-items:center">${moneyField('balNow', ui.balEdit && last ? last.amount : null, '0')}<button class="btn btn-primary" data-act="balSave">Calculer</button></div>
        ${last ? '' : `<p class="hint" style="margin:10px 2px 0">STM ajoute ce qui doit encore passer d'ici ta paie et te dit combien tu peux dépenser par jour.</p>`}</div>
      ${affordBtn}</section>`;
  }
  const until = `${fmtDateS(p.pay.date)}${p.pay.flow ? ` (${esc(p.pay.flow.name)})` : ''}`;
  return `<section class="sec"><div class="sec-head"><h2 class="sec-title">Jusqu'à la paie</h2>${head}</div>
    <button class="bigstat pc" data-act="pulseOpen" style="width:100%;text-align:left;display:block">
      <span class="pc-lbl" data-def="Par jour jusqu'au ${esc(until)}">Par jour jusqu'au ${until}</span><b class="pc-val" style="${p.free < 0 ? 'color:var(--danger)' : ''}">${odoHTML(p.perDay, { id: 'perDay' })}</b>
      <div class="pc-chart" data-scrub>${curveSVG(projection(p))}</div>
      <div class="pc-foot"><div class="split pc-split"><span>Libre <b>${odoHTML(p.free, { id: 'free' })}</b></span><span>À passer <b>${money(-p.toPay)}</b></span>${p.toGet ? `<span>À recevoir <b>${money(p.toGet, { sign: true })}</b></span>` : ''}${aheadHTML()}</div>
      <div class="split pc-ops" aria-hidden="true"></div></div>
      ${p.undated ? `<p class="hint" style="margin:10px 0 0">${p.undated} charge${p.undated > 1 ? 's' : ''} sans jour de paiement, comptée${p.undated > 1 ? 's' : ''} par prudence.</p>` : ''}
    </button>
    <div class="row2" style="margin-top:10px"><button class="btn btn-ghost" data-act="balEdit">Mettre à jour</button><button class="btn btn-primary" data-act="afford">Je peux ?</button></div></section>`;
}
const VIEWS = {};
VIEWS.mois = () => {
  const s = monthSummary(ui.ym);
  const pending = pendingClosings();
  const notes = [];
  if (!isStandalone()) notes.push(`<div class="note"><span class="ico">${icon('install', 20)}</span><div class="note-text"><b>Installe STM sur ton écran d'accueil</b>Sinon Safari peut effacer tes données.</div><button class="btn btn-ghost btn-sm" data-act="installHelp">Comment</button></div>`);
  const rev = reviewDue();
  if (rev) notes.push(`<div class="note"><span class="ico">${icon('sparkle', 20)}</span><div class="note-text"><b>Ton bilan ${yearLabel(rev)} est prêt</b>Ton année d'alternance en quelques écrans.</div><button class="btn btn-ghost btn-sm" data-act="review" data-start="${rev}">Voir</button></div>`);
  if (state.settings.calNeedsUpdate) notes.push(`<div class="note"><span class="ico">${icon('calendar', 20)}</span><div class="note-text"><b>Raccourci calendrier à refaire</b>Les rappels ont maintenant une heure précise.</div><button class="btn btn-ghost btn-sm" data-act="calSetup">Voir</button></div>`);
  if (calPending()) notes.push(`<div class="note"><span class="ico">${icon('calendar', 20)}</span><div class="note-text"><b>Calendrier à mettre à jour</b>Tes rappels ont changé depuis la dernière synchro.</div><button class="btn btn-ghost btn-sm" data-act="calSync">Synchroniser</button></div>`);
  if (hasData()) {
    const d = daysSince(state.settings.lastBackup);
    if (d === null || d > 30) notes.push(`<div class="note"><span class="ico">${icon('backup', 20)}</span><div class="note-text"><b>Sauvegarde</b>${d === null ? 'Aucune copie de tes données pour l’instant.' : `Dernière copie il y a ${d} jours.`}</div><button class="btn btn-ghost btn-sm" data-act="backup">Exporter</button></div>`);
  }
  let cta = '';
  if (pending.length) {
    const more = pending.length > 1 ? `<span style="opacity:.6;font-weight:500">, ${pending.length - 1} autre${pending.length > 2 ? 's' : ''} en retard</span>` : '';
    cta = `<button class="btn btn-primary btn-block cta" data-act="closing" data-ym="${pending[0]}"><span>Clôturer ${ymMonth(pending[0])}${pending[0].slice(0, 4) !== ymNow().slice(0, 4) ? ' ' + pending[0].slice(0, 4) : ''}${more}</span></button>`;
  } else if (ui.ym <= ymNow() && !s.closed && hasData()) cta = `<button class="btn btn-ghost btn-block cta" data-act="closing" data-ym="${ui.ym}">Clôturer ${ymMonth(ui.ym)}</button>`;

  const empty = !state.flows.length && !state.oneoffs.length;
  const up = upcoming(60);
  const rowsFor = (list, kind) => list.map(x => {
    const sub = x.type === 'oneoff' ? `${catById(kind, x.cat).name}, ponctuel` : x.type === 'debt' ? 'Dette' : catById(kind, x.cat).name + (x.employer ? `, employeur ${x.employer} %` : '');
    const attrs = `data-type="${x.type}" data-id="${x.id}"`;
    return itemRow({ act: 'openItem', attrs, ico: catIcon(kind, x.cat), title: x.name, sub, amt: (kind === 'in' ? '+' : '−') + money(x.amount), amtSmall: x.employer ? `<small>${money(x.gross)}</small>` : '' });
  }).join('');

  return `
  <div class="topbar"><span class="wordmark">STM</span><button class="icon-btn" data-act="settings" aria-label="Réglages">${icon('settings', 21)}</button></div>
  ${heroHTML(s)}
  <div id="moisBody">
  ${gapNote(monthGap(ui.ym), ui.ym)}
  ${cta}
  ${ui.ym === ymNow() ? pulseCard() : ''}
  ${notes.join('')}
  ${empty ? `<div class="empty" style="margin-top:22px"><h3>Commence par tes flux</h3><p>Salaire, aides, loyer, abonnements : ajoute ce qui revient chaque mois.</p><button class="btn btn-primary" data-act="addFlow">Ajouter un flux</button></div>` : ''}
  ${up.length ? `<section class="sec"><div class="sec-head"><h2 class="sec-title">À venir</h2></div><div class="group">${up.map(u => itemRow({ act: 'openItem', attrs: `data-type="${u.open[0]}" data-id="${u.open[1]}"`, ico: `<span class="ico sq">${icon('calendar', 19)}</span>`, title: u.title, sub: `${u.sub} ${fmtDateS(u.date)}`, amt: `<span class="muted small">${relDays(u.date)}</span>` })).join('')}</div></section>` : ''}
  ${!empty ? `
  <section class="sec"><div class="sec-head"><h2 class="sec-title">Revenus</h2><span class="sec-aside">${money(s.totIn)}</span></div>
    ${s.inc.length ? `<div class="group">${rowsFor(s.inc, 'in')}</div>` : `<div class="empty"><p style="margin:0">Aucun revenu ce mois-ci.</p></div>`}</section>
  <section class="sec"><div class="sec-head"><h2 class="sec-title">Charges</h2><span class="sec-aside">${money(s.totOut)}</span></div>
    <div class="group">${rowsFor(s.out, 'out')}<button class="item tap" data-act="addOneoff" data-ym="${ui.ym}"><span class="ico" style="--c:#ffffff">${icon('plus', 19, 2)}</span><div class="item-main"><div class="item-title">Ajouter une grosse dépense</div></div></button></div></section>` : ''}
  </div>
  `;
};
function heroHTML(s) {
  return `<section class="hero ${s.rest < 0 ? 'neg' : ''}" id="hero" aria-label="Reste à vivre, ${ymLabel(s.ym)}">
    <div class="hero-top"><div class="hero-month">${ymLabel(s.ym)}${s.closed ? `<button class="badge" data-act="closing" data-ym="${s.ym}">${icon('check', 14, 2.6)}Clôturé</button>` : ''}</div>
      <div class="hero-nav"><button data-act="month" data-d="-1" aria-label="Mois précédent">${icon('chevL', 18, 2.2)}</button><button data-act="month" data-d="1" aria-label="Mois suivant">${icon('chevR', 18, 2.2)}</button></div></div>
    <div class="hero-body">
      <div class="hero-label">Reste à vivre</div>
      <div class="hero-amount" id="heroAmt" data-v="${s.rest}">${odoHTML(s.rest, { id: 'rest', dec: true })}</div>
      <div class="hero-stats">
        <div class="hero-stat"><span>Revenus</span><b>${odoHTML(s.totIn, { id: 'hIn' })}</b></div>
        <div class="hero-stat"><span>Charges</span><b>${odoHTML(s.totOut, { id: 'hOut' })}</b></div>
        <div class="hero-stat"><span>${s.savingsIsPlan ? 'Épargne prévue' : 'Épargne'}</span><b>${odoHTML(s.savings, { id: 'hSav' })}</b></div>
      </div>
    </div><i class="hero-glare" aria-hidden="true"></i></section>`;
}

function contractRow(c) {
  const nd = noticeDate(c);
  let when = 'Sans engagement';
  if (nd && daysUntil(nd) >= 0) when = `Résilier avant le ${fmtDateS(nd)}`;
  else if (c.endCommit && daysUntil(c.endCommit) >= 0) when = `Engagé jusqu'au ${fmtDateS(c.endCommit)}`;
  else if (c.endCommit) when = 'Engagement terminé';
  const f = c.flow && state.flows.find(x => x.id === c.flow);
  let amt = '';
  if (f) { const t = flowTerms(f); const m = flowMonthlyEq(f) || r2(netOf(f, flowCurrentAmount(f), t.employer) / freqDiv(t)); amt = `${money(m)}<small class="plain">par mois</small>`; }
  const docs = (c.files || []).length;
  return itemRow({ act: 'openItem', attrs: `data-type="contract" data-id="${c.id}"`, ico: `<span class="ico sq">${icon('file', 19)}</span>`, title: c.name, sub: [c.org, when, docs ? `${docs} doc.` : ''].filter(Boolean).join(', '), amt });
}
function contractsHTML() {
  const cs = state.contracts.slice().sort((a, b) => (noticeDate(a) || a.endCommit || '9') < (noticeDate(b) || b.endCommit || '9') ? -1 : 1);
  return cs.length
    ? `<div class="group" style="margin-top:14px">${cs.map(contractRow).join('')}</div>`
    : `<div class="empty" style="margin-top:18px"><h3>Tes contrats au même endroit</h3><p>Mutuelle, assurance, box, forfait : engagement, préavis et documents.</p><button class="btn btn-primary" data-act="addContract">Ajouter un contrat</button></div>`;
}

VIEWS.flux = () => {
  const segHTML = seg('fluxSeg', [['in', 'Revenus'], ['out', 'Charges'], ['contrats', 'Contrats']], ui.fluxSeg);
  if (ui.fluxSeg === 'contrats') return `
  <div class="title-row"><h1 class="title">Flux</h1>${addBtn('addContract', 'Ajouter un contrat')}</div>
  ${segHTML}<div id="fluxBody">${contractsHTML()}</div>`;
  const kind = ui.fluxSeg, ym = ymNow();
  const flows = state.flows.filter(f => f.kind === kind);
  const live = flows.filter(f => flowStatus(f) !== 'ended');
  const ended = flows.filter(f => flowStatus(f) === 'ended');
  const perMonth = sum(live, f => flowMonthlyEq(f));
  const yr = yearMonths(yearStartOf(ym));
  const perYear = sum(flows, f => sum(yr, m => flowNet(f, m)));
  const row = f => {
    const st = flowStatus(f), t = flowTerms(f);
    const amt = flowCurrentAmount(f);
    const bits = [freqLabel(t)];
    if (f.kind === 'out' && t.employer) bits.push(`employeur ${t.employer} %`);
    if (st === 'paused') bits.push('en pause');
    if (st === 'future') bits.push(`dès ${ymMonth(f.hist[0].from)}`);
    if (st === 'ended') bits.push(`résilié en ${ymMonth(f.end)}`);
    if (f.day && st !== 'ended') bits.push(`le ${f.day === 1 ? '1er' : f.day}`);
    if (f.due && st !== 'ended') bits.push(`échéance ${fmtDateS(f.due)}`);
    const rowHTML = itemRow({ act: 'openItem', attrs: `data-type="flow" data-id="${f.id}"`, ico: catIcon(kind, f.cat), title: f.name, sub: cap(bits.join(', ')), amt: money(netOf(f, amt, t.employer)), amtSmall: f.kind === 'out' && t.employer ? `<small>${money(amt)}</small>` : '', dim: st !== 'active' });
    if (st !== 'active' && st !== 'paused') return rowHTML;
    /* Balayer vers la gauche : pause / reprise et résiliation, sans ouvrir la fiche. */
    return `<div class="swipe"><div class="swipe-acts"><button class="sw-act" data-act="swPause" data-id="${f.id}" aria-label="${st === 'active' ? 'Mettre en pause' : 'Reprendre'}">${icon(st === 'active' ? 'pause' : 'play', 20, 2)}<span>${st === 'active' ? 'Pause' : 'Reprendre'}</span></button><button class="sw-act danger" data-act="swEnd" data-id="${f.id}">${icon('close', 20, 2)}<span>Résilier</span></button></div>${rowHTML}</div>`;
  };
  const groups = catList(kind).map(c => ({ c, list: live.filter(f => f.cat === c.id) })).filter(g => g.list.length);
  const orphan = live.filter(f => !catList(kind).some(c => c.id === f.cat));
  if (orphan.length) groups.push({ c: catById(kind, 'x'), list: orphan });
  return `
  <div class="title-row"><h1 class="title">Flux</h1>${addBtn('addFlow', 'Ajouter un flux')}</div>
  ${segHTML}<div id="fluxBody">
  <div class="tiles" style="margin-top:14px"><div class="tile"><span>Par mois</span><b>${money(perMonth)}</b></div><div class="tile"><span>Sur l'année ${yearLabel(yr[0])}</span><b>${money(perYear, { whole: true })}</b></div></div>
  ${!flows.length ? `<div class="empty" style="margin-top:18px"><h3>${kind === 'in' ? 'Aucun revenu' : 'Aucune charge'}</h3><p>${kind === 'in' ? 'Salaire, aides, primes…' : 'Loyer, transports, abonnements…'}</p><button class="btn btn-primary" data-act="addFlow">Ajouter</button></div>` : ''}
  ${groups.map(g => `<div class="cat-head"><span>${esc(g.c.name)}</span><span>${money(sum(g.list, f => flowMonthlyEq(f)))} / mois</span></div><div class="group">${g.list.map(row).join('')}</div>`).join('')}
  ${ended.length ? `<div class="sec"><button class="toggle-group" data-act="toggleEnded" aria-expanded="${!!ui.showEnded}"><span class="sec-title" style="font-size:17px">Résiliés (${ended.length})</span>${icon('chevD', 20)}</button><div class="collapse ${ui.showEnded ? 'open' : ''}"><div><div class="group">${ended.map(row).join('')}</div></div></div></div>` : ''}</div>
  `;
};

VIEWS.epargne = () => {
  const nw = netWorth();
  const goals = state.goals.map(g => {
    const saved = goalSaved(g), pct = g.target ? Math.min(100, saved / g.target * 100) : 0;
    let right = '';
    if (saved >= g.target) right = 'Atteint';
    else if (g.deadline) right = `Pour ${ymMonth(g.deadline)} ${ymParts(g.deadline)[0]}`;
    else if (g.plan > 0) { const n = Math.ceil((g.target - saved) / g.plan); const at = ymAdd(ymNow(), n); right = `Atteint en ${ymMonth(at)} ${ymParts(at)[0]}`; }
    return `<button class="goal" data-act="openItem" data-type="goal" data-id="${g.id}">
      <div class="goal-top"><span class="goal-name">${esc(g.name)}</span><span><b>${money(saved, { whole: saved >= 1000 })}</b><span class="muted"> / ${money(g.target, { whole: true })}</span></span></div>
      <div class="bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%;--c:var(--save)"></i></div>
      <div class="goal-meta"><span>${g.plan ? `${money(g.plan)} par mois` : ''}</span><span>${right}</span></div></button>`;
  }).join('');
  const plc = state.placements.map(p => {
    const b = placementBreakdown(p);
    const linked = state.debts.filter(d => d.placement === p.id && d.dir === 'owe');
    const net = linked.length ? r2(b.value - sum(linked, d => Math.max(0, debtLeft(d)))) : null;
    const sub = `Plus-value ${money(b.gain, { sign: true })}` + (net !== null ? `, net de dette ${money(net)}` : '') + (p.plan ? `, ${money(p.plan)} par mois` : '');
    return itemRow({ act: 'openItem', attrs: `data-type="placement" data-id="${p.id}"`, ico: `<span class="ico" style="--c:var(--plc)">${icon('coins', 19)}</span>`, title: p.name, sub, amt: money(b.value) });
  }).join('');
  const debts = state.debts.map(d => {
    const left = debtLeft(d), paid = r2(d.amount - left);
    return itemRow({ act: 'openItem', attrs: `data-type="debt" data-id="${d.id}"`, ico: `<span class="ico" style="--c:${d.dir === 'owe' ? 'var(--out)' : 'var(--in)'}">${icon('handshake', 19)}</span>`, title: d.dir === 'owe' ? `Je dois à ${d.who}` : `${d.who} me doit`, sub: left <= 0 ? 'Soldé' : `Remboursé ${money(paid)} sur ${money(d.amount)}`, amt: money(Math.max(0, left)), dim: left <= 0 });
  }).join('');
  return `
  <div class="title-row"><h1 class="title">Épargne</h1>${addBtn('addSaving', 'Ajouter')}</div>
  <div class="bigstat"><span>Patrimoine net</span><b>${money(nw.net)}</b>
    <div class="split"><span>Placements <b>${money(nw.plc)}</b></span><span>Objectifs <b>${money(nw.goals)}</b></span>${nw.owe ? `<span>Dettes <b>−${money(nw.owe)}</b></span>` : ''}${nw.owed ? `<span>On te doit <b>${money(nw.owed)}</b></span>` : ''}</div></div>
  <section class="sec"><div class="sec-head"><h2 class="sec-title">Objectifs</h2>${state.goals.length ? `<button class="link-btn" data-act="addGoal">Ajouter</button>` : ''}</div>
    ${goals ? `<div class="stack">${goals}</div>` : `<div class="empty"><p>Fixe-toi un montant à atteindre, avec ou sans date.</p><button class="btn btn-primary" data-act="addGoal">Créer un objectif</button></div>`}</section>
  <section class="sec"><div class="sec-head"><h2 class="sec-title">Placements</h2>${state.placements.length ? `<button class="link-btn" data-act="addPlacement">Ajouter</button>` : ''}</div>
    ${plc ? `<div class="group">${plc}</div>` : `<div class="empty"><p>PEE, PEA, livret : suis la valeur, tes versements et l'abondement.</p><button class="btn btn-ghost" data-act="addPlacement">Ajouter un placement</button></div>`}</section>
  <section class="sec"><div class="sec-head"><h2 class="sec-title">Dettes</h2>${state.debts.length ? `<button class="link-btn" data-act="addDebt">Ajouter</button>` : ''}</div>
    ${debts ? `<div class="group">${debts}</div>` : `<div class="empty"><p>Argent que tu dois ou qu'on te doit.</p><button class="btn btn-ghost" data-act="addDebt">Ajouter une dette</button></div>`}</section>
  `;
};

VIEWS.annee = () => {
  if (!ui.year) ui.year = yearStartOf(ymNow());
  const months = yearMonths(ui.year);
  const data = months.map(ym => { const s = monthSummary(ym); return { ym, inc: s.totIn, out: s.totOut, sav: s.savings, future: ym > ymNow(), s }; });
  const tot = { inc: sum(data, d => d.inc), out: sum(data, d => d.out), sav: sum(data, d => d.sav) };
  tot.rest = r2(tot.inc - tot.out - tot.sav);
  const gaps = months.map(monthGap).filter(g => g !== null);
  ui.yearData = data;
  const ws = state.settings.widgets;
  const edit = ui.yearEdit;
  const widgetsHTML = edit
    ? `<div class="group widget-edit">${ws.map((w, i) => `<div class="setting"><span class="grow">${esc(WIDGET_NAMES[w.id])}</span><button class="icon-btn" data-act="wMove" data-i="${i}" data-d="-1" aria-label="Monter" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${icon('up', 18)}</button><button class="icon-btn" data-act="wMove" data-i="${i}" data-d="1" aria-label="Descendre" ${i === ws.length - 1 ? 'disabled style="opacity:.3"' : ''}>${icon('down', 18)}</button><button class="switch" role="switch" data-act="wToggle" data-i="${i}" aria-checked="${w.on}" aria-label="Afficher ${esc(WIDGET_NAMES[w.id])}"></button></div>`).join('')}</div>`
    : `<div class="stack">${ws.filter(w => w.on).map(w => CHARTS[w.id](data)).join('')}</div>`;
  return `
  <div class="title-row"><h1 class="title">Année</h1><div style="display:flex;gap:16px">${edit ? '' : `<button class="link-btn" data-act="review" data-start="${ui.year}">Bilan</button>`}<button class="link-btn" data-act="yearEdit">${edit ? 'Terminé' : 'Modifier'}</button></div></div>
  <div style="display:flex;align-items:center;gap:10px;margin:-6px 0 16px">
    <button class="icon-btn" data-act="year" data-d="-1" aria-label="Année précédente">${icon('chevL', 18, 2.2)}</button>
    <span style="font-size:20px;font-weight:700;font-stretch:88%;min-width:92px;text-align:center">${yearLabel(ui.year)}</span>
    <button class="icon-btn" data-act="year" data-d="1" aria-label="Année suivante">${icon('chevR', 18, 2.2)}</button>
    <span class="muted small" style="margin-left:auto">${cap(MONTHS_S[ymParts(months[0])[1] - 1])} à ${MONTHS_S[ymParts(months[11])[1] - 1]}</span>
  </div>
  <div class="tiles">
    <div class="tile"><span><i class="mk" style="background:var(--in)"></i>Revenus</span><b>${money(tot.inc, { whole: true })}</b></div>
    <div class="tile"><span><i class="mk" style="background:var(--out)"></i>Charges</span><b>${money(tot.out, { whole: true })}</b></div>
    <div class="tile"><span><i class="mk" style="background:var(--save)"></i>Épargne</span><b>${money(tot.sav, { whole: true })}</b></div>
    <div class="tile"><span>Reste à vivre</span><b>${money(tot.rest, { whole: true })}</b></div>
    ${gaps.length ? `<div class="tile"><span>Écart avec le réel</span><b>${money(sum(gaps), { whole: true, sign: true })}</b></div><div class="tile"><span>Mois comparés</span><b>${gaps.length}</b></div>` : ''}
  </div>
  <div style="margin-top:12px">${widgetsHTML}</div>
  `;
};

/* ---------- after-render hooks ---------- */
const AFTER = {};
AFTER.mois = () => {
  wireHero($('#hero'));
  const card = $('#view .bigstat.pc'), p = card && pulse();
  if (card && p) {
    const pr = projection(p), lbl = $('.pc-lbl', card), val = $('.pc-val .odo', card), split = $('.pc-split', card), ops = $('.pc-ops', card);
    wireScrub($('.pc-chart', card), pr, false, d => {
      card.classList.toggle('scrubbing', !!d);
      /* Le bas de la carte garde sa hauteur : les mouvements du jour se superposent au résumé. */
      if (!d) { lbl.textContent = lbl.dataset.def; odoSet(val, p.perDay); return; }
      lbl.textContent = `${dayLabel(d)} · solde prévu`; odoSet(val, d.v);
      ops.innerHTML = `<span>${opsLine(d.ops)}</span>`;
    });
  }
};
AFTER.flux = () => {
  const s = $('[data-seg="fluxSeg"]');
  /* Segment touché : la liste glisse vers la gauche ou la droite selon sa position. */
  s && s.addEventListener('segchange', e => {
    const order = ['in', 'out', 'contrats'], dir = Math.sign(order.indexOf(e.detail.value) - order.indexOf(ui.fluxSeg));
    ui.fluxSeg = e.detail.value;
    withSwap(dir, ['#fluxBody'], () => render(false, { swap: true }), { dist: 48 });
  });
  wireSwipes($('#view'));
};
AFTER.annee = () => wireCharts();
