/* ---------- monthly closing ---------- */
function openClosing(ym) {
  let step = 0;
  /* Mois déjà clôturé : on reprend ce qui a été saisi (0 compris). Sinon on propose le prévu. */
  const reopen = isClosed(ym);
  const prevBal = state.months[ymAdd(ym, -1)] ? state.months[ymAdd(ym, -1)].balance : null;
  const draft = { goals: {}, values: {}, touched: {}, deposits: {}, debts: {}, balance: reopen ? state.months[ym].balance ?? null : closingBalanceHint(ym) };
  state.goals.forEach(g => {
    const m = g.moves.find(x => x.ym === ym && x.src === 'close');
    const active = goalSaved(g) - (m ? m.amount : 0) < g.target && (!g.deadline || ym <= g.deadline);
    draft.goals[g.id] = m ? m.amount : (!reopen && active) ? (g.plan || 0) : 0;
  });
  state.placements.forEach(p => {
    const dep = p.ops.find(o => o.ym === ym && o.kind === 'deposit' && o.src === 'close');
    draft.deposits[p.id] = dep ? dep.amount : reopen ? 0 : (p.plan || 0);
    draft.values[p.id] = placementValueAt(p, ym);
  });
  const debtsHere = state.debts.filter(d => debtLeft(d) > 0 || d.moves.some(m => m.ym === ym));
  debtsHere.forEach(d => { const m = d.moves.find(x => x.ym === ym && x.src === 'close'); draft.debts[d.id] = m ? m.amount : 0; });

  const flowRow = (x, kind) => itemRow({ act: 'openItem', attrs: `data-type="${x.type}" data-id="${x.id}" data-ym="${ym}"`, ico: catIcon(kind, x.cat), title: x.name, sub: catById(kind, x.cat).name, amt: (kind === 'in' ? '+' : '−') + money(x.amount) });
  const steps = [
    () => {
      const s = monthSummary(ym);
      const fl = (list, k) => list.filter(x => x.type === 'flow').map(x => flowRow(x, k)).join('');
      return `<p class="step-lead">Touche une ligne pour corriger un montant à partir ${deMonth(ym)}.</p>
        <div class="sec-head"><h3 class="sec-title" style="font-size:17px">Revenus</h3><span class="sec-aside">${money(sum(s.inc.filter(x => x.type === 'flow'), x => x.amount))}</span></div>
        <div class="group">${fl(s.inc, 'in') || '<div class="item"><span class="muted">Aucun revenu récurrent</span></div>'}</div>
        <div class="sec-head" style="margin-top:22px"><h3 class="sec-title" style="font-size:17px">Charges</h3><span class="sec-aside">${money(sum(s.out.filter(x => x.type === 'flow'), x => x.amount))}</span></div>
        <div class="group">${fl(s.out, 'out') || '<div class="item"><span class="muted">Aucune charge récurrente</span></div>'}
        <button class="item tap" data-act="addFlow" data-kind="out"><span class="ico" style="--c:#fff">${icon('plus', 19, 2)}</span><div class="item-main"><div class="item-title">Ajouter un flux</div></div></button></div>`;
    },
    () => {
      const list = state.oneoffs.filter(o => o.date.slice(0, 7) === ym).sort((a, b) => b.amount - a.amount);
      return `<p class="step-lead">Dépenses et entrées exceptionnelles, à partir de ${money(state.settings.threshold, { whole: true })}.</p>
        <div class="group">${list.map(o => itemRow({ act: 'openItem', attrs: `data-type="oneoff" data-id="${o.id}"`, ico: catIcon(o.kind, o.cat), title: o.label, sub: fmtDateS(o.date), amt: (o.kind === 'in' ? '+' : '−') + money(o.amount) })).join('')}
        <button class="item tap" data-act="addOneoff" data-ym="${ym}"><span class="ico" style="--c:#fff">${icon('plus', 19, 2)}</span><div class="item-main"><div class="item-title">Ajouter</div></div></button></div>`;
    },
    () => {
      if (!state.goals.length && !state.placements.length && !debtsHere.length)
        return `<div class="empty"><h3>Rien à suivre ici</h3><p>Crée un objectif, un placement ou une dette depuis l'onglet Épargne.</p><button class="btn btn-ghost" data-act="addGoal">Créer un objectif</button></div>`;
      const goals = state.goals.map(g => `<div class="field"><span class="lbl">${esc(g.name)} <span style="color:var(--t3)">${money(goalSaved(g), { whole: true })} / ${money(g.target, { whole: true })}</span></span>${moneyField('g_' + g.id, draft.goals[g.id], '0', 'sm')}</div>`).join('');
      const plcs = state.placements.map(p => `<div class="field"><span class="lbl">${esc(p.name)}</span><div class="row2"><div><span class="lbl hint" style="margin:0 4px 6px">Valeur fin ${MONTHS_S[ymParts(ym)[1] - 1]}</span><div class="suffix" data-suffix="€"><input class="input" name="v_${p.id}" inputmode="decimal" value="${plainNum(draft.values[p.id])}"></div></div><div><span class="lbl hint" style="margin:0 4px 6px">Versement perso</span><div class="suffix" data-suffix="€"><input class="input" name="d_${p.id}" inputmode="decimal" value="${draft.deposits[p.id] ? plainNum(draft.deposits[p.id]) : ''}" placeholder="0"></div></div></div></div>`).join('');
      const debts = debtsHere.map(d => `<div class="field"><span class="lbl">${d.dir === 'owe' ? `Remboursé à ${esc(d.who)}` : `Reçu de ${esc(d.who)}`} <span style="color:var(--t3)">reste ${money(Math.max(0, debtLeft(d)))}</span></span>${moneyField('r_' + d.id, draft.debts[d.id] || null, '0', 'sm')}</div>`).join('');
      return `<p class="step-lead">Ce que tu as mis de côté en ${ymMonth(ym)}.</p>
        ${goals ? `<h3 class="sec-title" style="font-size:17px;margin:0 4px 12px">Objectifs</h3>${goals}` : ''}
        ${plcs ? `<h3 class="sec-title" style="font-size:17px;margin:20px 4px 12px">Placements</h3>${plcs}` : ''}
        ${debts ? `<h3 class="sec-title" style="font-size:17px;margin:20px 4px 12px">Dettes</h3>${debts}` : ''}`;
    },
    () => {
      const s = monthSummary(ym);
      return `<div class="hero ${s.rest < 0 ? 'neg' : ''}" style="min-height:0"><div class="hero-label">Reste à vivre ${deMonth(ym)}</div><div class="hero-amount">${heroAmount(s.rest)}</div>
        <div class="hero-stats"><div class="hero-stat"><span>Revenus</span><b>${money(s.totIn)}</b></div><div class="hero-stat"><span>Charges</span><b>${money(s.totOut)}</b></div><div class="hero-stat"><span>Épargne</span><b>${money(s.savings)}</b></div></div></div>
        <div class="field" style="margin-top:20px"><span class="lbl">Solde réel fin ${MONTHS_S[ymParts(ym)[1] - 1]} <span style="color:var(--t3)">comptes et livrets, hors placements</span></span>${moneyField('balance', draft.balance, 'Facultatif')}</div>
        <div data-gap>${gapLine()}</div>
        <p class="step-lead" style="margin-top:16px">Tu pourras la rouvrir depuis la carte du mois.</p>`;
    }
  ];
  const readBalance = () => { const el = $('[name="balance"]', topSheet()); if (!el) return draft.balance; const v = parseAmount(el.value); return isNaN(v) ? null : v; };
  const gapLine = () => {
    const g = gapFor(ym, draft.balance);
    if (g === null) return draft.balance !== null && (prevBal === null || prevBal === undefined) ? `<p class="hint" style="margin:0 4px">L'écart avec la prévision s'affichera dès le mois prochain.</p>` : '';
    return `<div class="tiles"><div class="tile"><span>${g < 0 ? 'Dépenses non suivies' : 'Mieux que prévu'}</span><b>${money(g, { sign: true })}</b></div><div class="tile"><span>Variation prévue</span><b>${money(expectedDelta(ym), { sign: true })}</b></div></div>`;
  };
  const commitSavings = () => {
    const sh = topSheet();
    state.goals.forEach(g => {
      const el = $(`[name="g_${g.id}"]`, sh); if (!el) return;
      const v = parseAmount(el.value) || 0;
      g.moves = g.moves.filter(m => !(m.ym === ym && m.src === 'close'));
      if (v) g.moves.push({ id: uid(), ym, amount: v, src: 'close' });
      draft.goals[g.id] = v;
    });
    state.placements.forEach(p => {
      const dEl = $(`[name="d_${p.id}"]`, sh), vEl = $(`[name="v_${p.id}"]`, sh); if (!dEl) return;
      const dep = parseAmount(dEl.value) || 0;
      p.ops = p.ops.filter(o => !(o.ym === ym && o.kind === 'deposit' && o.src === 'close'));
      if (dep) p.ops.push({ id: uid(), ym, kind: 'deposit', amount: dep, src: 'close' });
      draft.deposits[p.id] = dep;
      if (draft.touched[p.id]) {
        const v = parseAmount(vEl.value);
        p.ops = p.ops.filter(o => !(o.ym === ym && o.kind === 'value' && o.src === 'close'));
        if (!isNaN(v)) p.ops.push({ id: uid(), ym, kind: 'value', amount: v, src: 'close' });
        draft.values[p.id] = isNaN(v) ? placementValueAt(p, ym) : v;
      }
    });
    debtsHere.forEach(d => {
      const el = $(`[name="r_${d.id}"]`, sh); if (!el) return;
      const v = parseAmount(el.value) || 0;
      d.moves = d.moves.filter(m => !(m.ym === ym && m.src === 'close'));
      if (v) d.moves.push({ id: uid(), ym, amount: v, src: 'close' });
      draft.debts[d.id] = v;
    });
    save();
  };
  const sh = openSheet({ title: `Clôture ${deMonth(ym)}`, full: true, head: `<div class="steps">${'<i></i>'.repeat(4)}</div>`, body: '', foot: '<span></span>' });
  const paint = (dir = 0) => {
    $$('.steps i', sh).forEach((el, i) => el.classList.toggle('on', i <= step));
    setSheetBody(sh, steps[step](), dir);
    $('.sheet-body', sh).scrollTop = 0;
    $('.sheet-foot', sh).innerHTML = `${step ? `<button class="btn btn-ghost" data-act="sheet" data-fn="back">Retour</button>` : ''}<button class="btn btn-primary" data-act="sheet" data-fn="next">${step === 3 ? `Clôturer ${ymMonth(ym)}` : step === 0 ? 'Tout est bon' : 'Continuer'}</button>`;
  };
  sh.addEventListener('input', e => {
    const n = e.target.name || '';
    if (n.startsWith('v_')) draft.touched[n.slice(2)] = true;
    if (n === 'balance') { draft.balance = readBalance(); $('[data-gap]', sh).innerHTML = gapLine(); }
  });
  sh._refresh = () => { const st = $('.sheet-body', sh).scrollTop; setSheetBody(sh, steps[step]()); $('.sheet-body', sh).scrollTop = st; };
  sheetActions(sh, {
    back() { if (step === 2) commitSavings(); step = Math.max(0, step - 1); paint(-1); },
    next() {
      if (step === 2) commitSavings();
      if (step < 3) { step++; paint(1); return; }
      draft.balance = readBalance();
      state.months[ym] = { closed: new Date().toISOString(), balance: draft.balance };
      save(); closeSheet(); refresh(); toast(`${cap(ymMonth(ym))} clôturé`);
      const d = daysSince(state.settings.lastBackup);
      if (!(d === null || d > 25)) calMaybeSync();
      else setTimeout(async () => { if (await confirmSheet('Garde une copie de tes données en lieu sûr, dans Fichiers ou iCloud Drive.', 'Exporter', false, 'Sauvegarder maintenant ?')) openBackup(); else calMaybeSync(); }, 650);
    }
  });
  paint();
}

/* ---------- calendrier ---------- */
/* Réglages propres au téléphone (raccourci installé ici) : ni exportés, ni écrasés par un import. */
const CAL_DEVICE_KEYS = ['calReady', 'calShortcutV', 'calNeedsUpdate', 'calHour', 'calAuto', 'calClosing', 'calWeekly', 'calSig', 'lastCalSync'];
/* Point d'ouverture d'URL remplaçable par les tests (un navigateur de test ne sait pas ouvrir shortcuts://). */
const openURL = url => (window.__stmOpenURL || (u => { location.href = u; }))(url);
async function syncCalendar() {
  if (!state.settings.calReady) return openCalSetup();
  state.settings.calSig = calSig();
  state.settings.lastCalSync = new Date().toISOString();
  await saveNow();
  refresh();
  openURL(calendarURL());
}
/* Synchro automatique quand les rappels ont changé (contrat, échéance, nouveau mois). */
function calMaybeSync() {
  if (state.settings.calReady && state.settings.calAuto && calPending()) setTimeout(syncCalendar, 450);
}
function openCalSetup() {
  const step = (n, t) => `<div class="item"><span class="ico" style="--c:#fff"><span class="letter">${n}</span></span><div class="item-main" style="white-space:normal"><div class="item-title" style="white-space:normal;font-weight:500;line-height:1.35">${t}</div></div></div>`;
  const k = s => `<b style="font-weight:650">${s}</b>`;
  const steps = [
    `Dans ${k('Calendrier')}, crée un calendrier iCloud nommé ${k('STM')}.`,
    `Dans ${k('Raccourcis')}, crée un raccourci nommé exactement ${k(CAL_SHORTCUT)}.`,
    `${k('Obtenir le dictionnaire de')} : Entrée du raccourci.`,
    `${k('Rechercher des événements de calendrier')} : Calendrier est STM, et Date de début est après Aujourd'hui. Désactive la limite.`,
    `${k('Supprimer les événements')} : Événements de calendrier.`,
    `${k('Obtenir la valeur de')} la clé ${k('events')} dans Dictionnaire.`,
    `${k('Répéter avec chaque élément')} de cette valeur. Tout ce qui suit va dans la boucle.`,
    `Cinq fois ${k('Obtenir la valeur de')} dans Élément répété : ${k('days')}, ${k('hour')}, ${k('title')}, ${k('notes')}, ${k('alert')}. Renomme chaque résultat comme sa clé.`,
    `${k('Ajuster la date')} : Obtenir le début du jour de Date actuelle.`,
    `${k('Ajuster la date')} : Ajouter ${k('days')} jours à cette date, puis ${k('Ajuster la date')} : Ajouter ${k('hour')} heures. Renomme le résultat ${k('Début')}.`,
    `${k('Ajuster la date')} : Ajouter 30 minutes à Début. Renomme le résultat ${k('Fin')}.`,
    `${k('Si')} alert est ${k('week')} : ${k('Ajouter un nouvel événement')}. Titre = title, Calendrier STM, Début et Fin (pas « Journée entière »), Alerte 1 semaine avant, Remarques = notes.`,
    `${k('Sinon')} : un second ${k('Si')} alert est ${k('day')} → la même action avec Alerte 1 jour avant. Son ${k('Sinon')} → la même action avec Alerte Au moment de l'événement.`
  ];
  const sh = openSheet({
    title: 'Connecter le calendrier', full: true,
    body: `<p class="step-lead">${state.settings.calNeedsUpdate ? 'Le raccourci change : les rappels ont désormais une heure, pour que les alertes sonnent au bon moment. Refais-le avec ces étapes.' : 'STM envoie tes rappels à un raccourci qui les écrit dans ton Calendrier. À faire une seule fois.'}</p>
      <div class="group">${steps.map((t, i) => step(i + 1, t)).join('')}</div>
      <p class="hint" style="margin-top:14px;font-size:14.5px">À la première synchro, iOS demande l'accès au Calendrier et peut demander de confirmer la suppression des anciens rappels. Les noms des actions peuvent varier légèrement selon la version d'iOS.</p>`,
    foot: `<button class="btn btn-primary" data-act="sheet" data-fn="ready">C'est prêt, synchroniser</button>`
  });
  sheetActions(sh, { ready() { Object.assign(state.settings, { calReady: true, calShortcutV: CAL_SHORTCUT_V, calNeedsUpdate: false }); closeSheet(); syncCalendar(); } });
}

/* ---------- settings ---------- */
function openSettings() {
  const paint = () => {
    const s = state.settings, d = daysSince(s.lastBackup);
    return `
    <div class="group">
      <div class="setting"><span class="ico">${icon('lock', 19)}</span><span class="grow">Code à l'ouverture</span><button class="switch" role="switch" aria-checked="${!!s.pin}" data-act="sheet" data-fn="pin" aria-label="Code à l'ouverture"></button></div>
      ${s.pin ? `<button class="setting" data-act="sheet" data-fn="pinChange"><span class="ico">${icon('edit', 19)}</span><span class="grow">Changer le code</span>${icon('chevR', 18)}</button>` : ''}
    </div>
    <div class="sec-head" style="margin:24px 4px 10px"><h3 class="sec-title" style="font-size:17px">Calendrier</h3>${s.calReady ? `<span class="sec-aside small">${s.lastCalSync ? (daysSince(s.lastCalSync) === 0 ? "Synchronisé aujourd'hui" : `Synchronisé il y a ${daysSince(s.lastCalSync)} j`) : 'Jamais synchronisé'}</span>` : ''}</div>
    <div class="group">
      ${s.calReady ? `<button class="setting" data-act="calSync"><span class="ico">${icon('calendar', 19)}</span><span class="grow">Synchroniser maintenant</span>${calPending() ? '<span class="val">À mettre à jour</span>' : ''}${icon('chevR', 18)}</button>
      <div class="setting"><span class="grow">Synchroniser automatiquement</span><button class="switch" role="switch" aria-checked="${s.calAuto !== false}" data-act="sheet" data-fn="calAuto" aria-label="Synchroniser automatiquement"></button></div>
      <label class="setting"><span class="grow">Heure des rappels</span><select class="input" name="calHour" style="width:110px;height:42px">${Array.from({ length: 17 }, (_, i) => i + 6).map(h => `<option value="${h}" ${h === (s.calHour ?? 9) ? 'selected' : ''}>${h} h</option>`).join('')}</select></label>
      <div class="setting"><span class="grow">Point solde chaque dimanche</span><button class="switch" role="switch" aria-checked="${s.calWeekly !== false}" data-act="sheet" data-fn="calWeekly" aria-label="Point solde chaque dimanche"></button></div>
      <div class="setting"><span class="grow">Rappel de clôture chaque mois</span><button class="switch" role="switch" aria-checked="${s.calClosing !== false}" data-act="sheet" data-fn="calClosing" aria-label="Rappel de clôture chaque mois"></button></div>
      <button class="setting" data-act="calSetup"><span class="grow">Configuration du raccourci</span>${icon('chevR', 18)}</button>`
      : `<button class="setting" data-act="calSetup"><span class="ico">${icon('calendar', 19)}</span><span class="grow">Connecter le calendrier</span>${icon('chevR', 18)}</button>`}
    </div>
    <div class="sec-head" style="margin:24px 4px 10px"><h3 class="sec-title" style="font-size:17px">Sauvegarde</h3><span class="sec-aside small">${d === null ? 'Jamais faite' : d === 0 ? "Faite aujourd'hui" : `Il y a ${d} j`}</span></div>
    <div class="group">
      <button class="setting" data-act="backup"><span class="ico">${icon('backup', 19)}</span><span class="grow">Exporter une sauvegarde</span>${icon('chevR', 18)}</button>
      <button class="setting" data-act="importPick"><span class="ico">${icon('upload', 19)}</span><span class="grow">Importer une sauvegarde</span>${icon('chevR', 18)}</button>
    </div>
    <div class="sec-head" style="margin:24px 4px 10px"><h3 class="sec-title" style="font-size:17px">Préférences</h3></div>
    <div class="group">
      <button class="setting" data-act="cats" data-kind="out"><span class="grow">Catégories de charges</span><span class="val">${catList('out').length}</span>${icon('chevR', 18)}</button>
      <button class="setting" data-act="cats" data-kind="in"><span class="grow">Catégories de revenus</span><span class="val">${catList('in').length}</span>${icon('chevR', 18)}</button>
      <label class="setting"><span class="grow">Seuil des grosses dépenses</span><div class="suffix" data-suffix="€" style="width:110px"><input class="input" name="threshold" inputmode="numeric" value="${s.threshold}" style="height:42px;text-align:right"></div></label>
      <label class="setting"><span class="grow">Heures payées par mois</span><div class="suffix" data-suffix="h" style="width:110px"><input class="input" name="workHours" inputmode="decimal" value="${plainNum(s.workHours || 151.67)}" style="height:42px;text-align:right"></div></label>
      <label class="setting"><span class="grow">Début de l'année</span><select class="input" name="yearStart" style="width:150px;height:42px">${monthOptions(s.yearStart)}</select></label>
    </div>
    <div class="group" style="margin-top:24px">
      ${!isStandalone() ? `<button class="setting" data-act="installHelp"><span class="ico">${icon('install', 19)}</span><span class="grow">Installer sur l'écran d'accueil</span>${icon('chevR', 18)}</button>` : ''}
      <button class="setting" data-act="wipe" style="color:var(--danger)"><span class="ico" style="--c:var(--danger)">${icon('trash', 19)}</span><span class="grow">Tout effacer</span></button>
    </div>
    <p class="muted small" style="margin:18px 4px 0">STM ${APP_VERSION}. Tes données restent sur cet appareil.</p>`;
  };
  const sh = openSheet({ title: 'Réglages', body: paint() });
  sh._refresh = () => setSheetBody(sh, paint());
  sh.addEventListener('change', e => {
    if (e.target.name === 'threshold') { const v = parseAmount(e.target.value); if (v >= 0) { state.settings.threshold = v; save(); } }
    if (e.target.name === 'workHours') { const v = parseAmount(e.target.value); if (v > 0) { state.settings.workHours = v; save(); } }
    if (e.target.name === 'calHour') { state.settings.calHour = +e.target.value; save(); calMaybeSync(); }
    if (e.target.name === 'yearStart') { state.settings.yearStart = +e.target.value; ui.year = null; save(); render(false); }
  });
  sheetActions(sh, {
    pin(el) {
      if (state.settings.pin) { state.settings.pin = null; save(); toast('Code désactivé'); setSheetBody(sh, paint()); }
      else showLock('set', ok => { setSheetBody(sh, paint()); });
    },
    pinChange() { showLock('set', () => setSheetBody(sh, paint())); },
    calAuto(el) { state.settings.calAuto = el.getAttribute('aria-checked') === 'true'; save(); },
    calWeekly(el) { state.settings.calWeekly = el.getAttribute('aria-checked') === 'true'; save(); setSheetBody(sh, paint()); calMaybeSync(); },
    calClosing(el) { state.settings.calClosing = el.getAttribute('aria-checked') === 'true'; save(); setSheetBody(sh, paint()); calMaybeSync(); }
  });
}
function openCats(kind) {
  const paint = () => `<div class="group">${catList(kind).map(c => `<div class="setting">${catIcon(kind, c.id, 34)}<input class="input" data-cat="${c.id}" value="${esc(c.name)}" style="height:42px;flex:1" ${c.fixed ? 'readonly' : ''}>${c.fixed ? '' : `<button class="icon-btn" data-act="sheet" data-fn="rm" data-id="${c.id}" aria-label="Supprimer ${esc(c.name)}">${icon('trash', 17)}</button>`}</div>`).join('')}</div>
    <button class="btn btn-ghost btn-block" style="margin-top:12px" data-act="sheet" data-fn="add">${icon('plus', 20)}Ajouter une catégorie</button>`;
  const sh = openSheet({ title: kind === 'out' ? 'Catégories de charges' : 'Catégories de revenus', body: paint(), onClose: () => refresh() });
  sh.addEventListener('change', e => { const id = e.target.dataset.cat; if (!id) return; const c = catList(kind).find(x => x.id === id); const v = e.target.value.trim(); if (c && v) { c.name = v; save(); } });
  sheetActions(sh, {
    add() {
      const used = new Set(catList(kind).map(c => c.slot));
      const slot = [1, 2, 3, 4, 5, 6, 7, 8].find(s => !used.has(s)) || 0;
      const c = { id: uid(), name: 'Nouvelle catégorie', icon: null, slot, fixed: false };
      const list = catList(kind); list.splice(list.length - 1, 0, c);
      save(); setSheetBody(sh, paint());
      const inp = $(`[data-cat="${c.id}"]`, sh); inp.focus(); inp.select();
    },
    async rm(el) {
      const c = catList(kind).find(x => x.id === el.dataset.id);
      const fallback = catList(kind).find(x => x.fixed);
      const n = state.flows.filter(f => f.cat === c.id).length + state.oneoffs.filter(o => o.cat === c.id).length;
      if (n && !(await confirmSheet(`${n} élément${n > 1 ? 's' : ''} passer${n > 1 ? 'ont' : 'a'} dans « ${esc(fallback.name)} ».`, 'Supprimer', true, `Supprimer « ${esc(c.name)} » ?`))) return;
      state.flows.forEach(f => { if (f.cat === c.id) f.cat = fallback.id; });
      state.oneoffs.forEach(o => { if (o.cat === c.id) o.cat = fallback.id; });
      state.cats[kind] = catList(kind).filter(x => x !== c);
      save(); setSheetBody(sh, paint());
    }
  });
}

/* ---------- backup / import ---------- */
async function buildBackup() {
  const files = [];
  if (Store.db) { for (const k of await Store.keys('files')) { const r = await Store.get('files', k); if (r) files.push({ ...r, data: abToB64(r.data) }); } }
  /* Le code reste propre à l'appareil : il n'est pas exporté. */
  const st = JSON.parse(JSON.stringify(state));
  st.settings.pin = null; st.settings.pinLock = null;
  CAL_DEVICE_KEYS.forEach(k => delete st.settings[k]);
  const payload = { app: 'STM', v: SCHEMA, exported: new Date().toISOString(), state: st, files };
  return new File([JSON.stringify(payload)], `stm-sauvegarde-${todayISO()}.json`, { type: 'application/json' });
}
function openBackup() {
  let file = null;
  const sh = openSheet({ title: 'Sauvegarde', body: `<p class="muted">Préparation…</p>`, foot: `<button class="btn btn-primary" data-act="sheet" data-fn="go" disabled>Enregistrer la sauvegarde</button>` });
  buildBackup().then(f => {
    file = f;
    setSheetBody(sh, `<div class="group"><div class="item"><span class="ico sq">${icon('file', 19)}</span><div class="item-main"><div class="item-title">${esc(f.name)}</div><div class="item-sub">${fmtSize(f.size)}</div></div></div></div>
      <p class="hint" style="margin-top:12px">Choisis « Enregistrer dans Fichiers », puis iCloud Drive.</p>`);
    $('[data-fn="go"]', sh).disabled = false;
  }).catch(() => setSheetBody(sh, '<p class="muted">La sauvegarde a échoué. Réessaie.</p>'));
  sheetActions(sh, {
    async go() {
      if (!file) return;
      const ok = await shareOrDownload(file);
      if (ok) { state.settings.lastBackup = new Date().toISOString(); save(); closeSheet(true); refresh(); toast('Sauvegarde exportée'); calMaybeSync(); }
    }
  });
}
async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('Ce fichier n’est pas une sauvegarde STM', 'close'); return; }
  if (!data || data.app !== 'STM' || !data.state) { toast('Ce fichier n’est pas une sauvegarde STM', 'close'); return; }
  const when = data.exported ? fmtDate(data.exported.slice(0, 10)) : 'inconnue';
  if (!(await confirmSheet(`Tes données actuelles seront remplacées par la sauvegarde du ${when}.`, 'Remplacer', true, 'Importer la sauvegarde ?'))) return;
  try {
    if (Store.db) { await Store.clear('files'); for (const f of data.files || []) await Store.put('files', f.id, { ...f, data: b64ToAb(f.data) }); }
    /* Code et calendrier sont propres à l'appareil : on garde ceux de ce téléphone. */
    const keep = ['pin', 'pinLock', ...CAL_DEVICE_KEYS].map(k => [k, state.settings[k]]);
    state = migrate(data.state); keep.forEach(([k, v]) => { state.settings[k] = v; }); save();
    closeSheet(true); ui.ym = ymNow(); ui.year = null; ui.lastRest = null; render(true); toast('Sauvegarde importée');
  } catch (e) { toast('Import impossible', 'close'); }
}

/* ---------- install help ---------- */
function openInstall() {
  const step = (n, t) => `<div class="item"><span class="ico" style="--c:#fff"><span class="letter">${n}</span></span><div class="item-main" style="white-space:normal"><div class="item-title" style="white-space:normal">${t}</div></div></div>`;
  openSheet({
    title: 'Installer STM', body: `<div class="group">
      ${step(1, 'Ouvre STM dans Safari')}
      ${step(2, `Touche ${icon('share', 18)} Partager`.replace('<svg', '<svg style="display:inline;vertical-align:-3px"'))}
      ${step(3, 'Choisis « Sur l’écran d’accueil », puis « Ajouter »')}
      ${step(4, 'Ouvre STM depuis son icône')}</div>
      <p class="hint" style="margin-top:14px;font-size:14.5px">L'app installée ne voit pas ce que tu saisis dans Safari. Installe-la avant de commencer, ou passe par une sauvegarde pour transférer tes données.</p>`
  });
}

/* ---------- bilan de l'année d'alternance (diapos plein écran) ---------- */
const RV_BG = {
  blue: 'radial-gradient(120% 80% at 0% 0%,#5468ff 0%,rgba(84,104,255,0) 60%),linear-gradient(160deg,#2134e0,#130a55)',
  violet: 'radial-gradient(110% 80% at 100% 0%,#8b3dff 0%,rgba(139,61,255,0) 60%),linear-gradient(160deg,#3b1d8f,#0f0828)',
  pink: 'radial-gradient(110% 80% at 0% 100%,#ff4f8b 0%,rgba(255,79,139,0) 60%),linear-gradient(160deg,#7a1240,#1c0510)',
  amber: 'radial-gradient(110% 80% at 100% 100%,#f59e0b 0%,rgba(245,158,11,0) 60%),linear-gradient(160deg,#7c3a06,#1c0c02)',
  green: 'radial-gradient(110% 80% at 0% 0%,#22c58b 0%,rgba(34,197,139,0) 60%),linear-gradient(160deg,#0b5e47,#03150f)'
};
function reviewSlides(r, savage) {
  const t = (n, x) => savage ? x : n, M = v => money(v, { whole: true });
  const S = [];
  S.push({ bg: 'blue', kicker: `Ton année d'alternance${r.complete ? '' : ', en cours'}`, big: r.label,
    text: t(`${r.months} mois de comptes. Voyons ce que ça donne.`, `${r.months} mois. On a tout noté. Absolument tout.`) });
  if (r.inc) S.push({ bg: 'violet', kicker: 'Tu as gagné', big: M(r.inc),
    text: r.rest >= 0 ? t(`Après charges et épargne, il t'est resté ${M(r.rest)} pour vivre.`, `Après charges et épargne, il restait ${M(r.rest)}. Le reste, tu sais très bien où il est parti.`)
      : t(`Tes charges et ton épargne ont dépassé tes revenus de ${M(-r.rest)}.`, `${M(-r.rest)} de plus que ce que tu as gagné. Audacieux.`) });
  if (r.top) S.push({ bg: 'pink', kicker: 'Ton mois le plus cher', big: cap(ymMonth(r.top.ym)),
    text: t(`${M(r.top.out)} de charges. Ça arrive, et tu t'en es remis.`, `${M(r.top.out)} de charges. ${cap(ymMonth(r.top.ym))}, on en parle ?`) });
  if (r.big) S.push({ bg: 'amber', kicker: 'Ton plus gros achat', big: M(r.big.amount),
    text: `${esc(r.big.label)}, en ${ymMonth(r.big.ym)}.` + (r.big.mins ? t(` Soit ${fmtWork(r.big.mins)}. Bien mérité, on espère.`, ` ${cap(fmtWork(r.big.mins))}. J'espère que c'était beau.`) : '') });
  if (r.subs) S.push({ bg: 'violet', kicker: 'Tes abonnements', big: M(r.subs.total),
    text: r.subs.mins ? t(`Soit ${fmtWork(r.subs.mins)} sur l'année. À garder s'ils te servent.`, `${cap(fmtWork(r.subs.mins))} de ta vie, rien que pour des abonnements.`)
      : t(`Sur l'année.`, `Sur l'année. Tu les utilises tous ?`) });
  const names = r.goalsReached.map(n => `« ${esc(n)} »`).join(', ');
  S.push({ bg: 'green', kicker: 'Mis de côté', big: M(r.saved),
    text: r.goalsReached.length ? t(`Objectif${r.goalsReached.length > 1 ? 's' : ''} atteint${r.goalsReached.length > 1 ? 's' : ''} : ${names}. Bravo.`, `${names} : atteint. Pas mal, pour une fois.`)
      : r.saved > 0 ? t(`Chaque euro mis de côté compte.`, `C'est un début.`) : t(`L'année prochaine sera la bonne.`, `Zéro. On en reparle l'an prochain.`) });
  if (r.gap) S.push({ bg: 'pink', kicker: 'Dépenses non suivies', big: money(r.gap.total, { whole: true, sign: true }),
    text: r.gap.total < 0 ? t(`Parties en petites dépenses, sur les ${r.gap.months} mois où tu as saisi ton solde.`, `Évaporées en ${r.gap.months} mois. Cafés, kebabs : on ne saura jamais.`)
      : t(`Mieux que prévu sur ${r.gap.months} mois. Bien joué.`, `Mieux que prévu. Tu nous caches quelque chose ?`) });
  if (r.ahead && r.ahead.from !== null && r.ahead.to !== null) {
    const d = r.ahead.to - r.ahead.from;
    S.push({ bg: 'green', kicker: "Tes jours d'avance", big: `${r.ahead.from} → ${r.ahead.to}`,
      text: d > 0 ? t(`${d} jours de coussin en plus. Tu dépends un peu moins de la prochaine paie.`, `+${d} jours. Ça commence à ressembler à quelque chose.`)
        : d < 0 ? t(`${-d} jours de moins qu'en début d'année. L'an prochain, on remonte.`, `${-d} jours de moins. Le coussin s'est dégonflé.`)
        : t(`Stable sur l'année.`, `Pas bougé d'un jour. Constant, au moins.`) });
  }
  if (r.asks) S.push({ bg: 'amber', kicker: '« Je peux me le permettre ? »', big: `${r.asks.count} fois`,
    text: r.asks.skipped ? t(`Tu as renoncé ${r.asks.skipped} fois : ${M(r.asks.skippedAmount)} pas dépensés.`, `${r.asks.skipped} renoncement${r.asks.skipped > 1 ? 's' : ''}, ${M(r.asks.skippedAmount)} sauvés. Les ${r.asks.count - r.asks.skipped} autres fois, tu as craqué.`)
      : t(`Et chaque fois, tu pouvais te le permettre.`, `Et tu as tout acheté. À quoi bon demander ?`) });
  S.push({ bg: 'blue', kicker: r.checkins ? `${r.checkins} point${r.checkins > 1 ? 's' : ''} solde cette année` : 'Fin', big: r.complete ? 'À l’année prochaine' : 'À suivre',
    text: r.complete ? t(`Belle année. Rendez-vous en septembre pour la suivante.`, `L'année prochaine, on fait mieux ? Rendez-vous en septembre.`)
      : t(`Le bilan complet t'attend fin ${ymMonth(ymAdd(r.start, 11))}.`, `Fin ${ymMonth(ymAdd(r.start, 11))}, on fait les comptes pour de vrai.`) });
  return S;
}
let reviewEl = null;
function openReview(start) {
  if (reviewEl) return;
  const r = yearReview(start);
  let slides = null, i = 0;
  const el = document.createElement('div'); el.className = 'review'; reviewEl = el;
  el.innerHTML = `<div class="rv-bg"></div><div class="rv-bars"></div>
    <div class="rv-top"><span class="wordmark" style="font-size:22px">STM</span><button class="icon-btn rv-close" data-rv="close" aria-label="Fermer">${icon('close', 20)}</button></div>
    <div class="rv-body" aria-live="polite"></div>`;
  const o = takeOrigin();
  document.body.appendChild(el);
  zoomIn(el, o);
  const bg = $('.rv-bg', el), bars = $('.rv-bars', el), body = $('.rv-body', el);
  const close = () => {
    if (!state.settings.reviewSeen.includes(start)) { state.settings.reviewSeen.push(start); save(); }
    zoomOut(el, o, () => el.remove()); reviewEl = null; document.removeEventListener('keydown', onKey); refresh();
  };
  const paint = () => {
    const s = slides[i];
    bg.style.background = RV_BG[s.bg];
    bars.innerHTML = slides.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('');
    body.innerHTML = `<div class="rv-slide"><div class="rv-kicker">${esc(s.kicker)}</div><div class="rv-big ${String(s.big).length > 9 ? 'sm' : ''}">${esc(s.big)}</div><p class="rv-text">${s.text}</p>
      ${i === slides.length - 1 ? `<button class="btn btn-primary" data-rv="close" style="margin-top:18px">Fermer</button>` : ''}</div>`;
  };
  const go = d => { if (!slides) return; const n = i + d; if (n < 0) return; if (n >= slides.length) return close(); i = n; paint(); };
  bg.style.background = RV_BG.blue;
  body.innerHTML = `<div class="rv-slide"><div class="rv-kicker">Bilan d'alternance</div><div class="rv-big">${esc(r.label)}</div>
    <p class="rv-text">Comment tu veux qu'on te le dise ?</p>
    <div class="rv-tones"><button class="btn btn-primary" data-rv="nice">Gentiment</button><button class="btn btn-ghost" data-rv="savage" style="background:rgba(255,255,255,.14)">Sans pitié</button></div></div>`;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-rv]');
    if (b) { const a = b.dataset.rv; if (a === 'close') return close(); slides = reviewSlides(r, a === 'savage'); i = 0; return paint(); }
    if (!slides) return;
    go(e.clientX < window.innerWidth / 3 ? -1 : 1);
  });
  const onKey = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
  document.addEventListener('keydown', onKey);
}

/* ---------- lock screen ---------- */
/* Le code est un rideau contre les regards, pas un chiffrement : les données restent lisibles
   par qui a l'appareil déverrouillé. On limite quand même les essais : 5 libres, puis une attente
   qui double (30 s, 1 min, 2 min…), conservée même si l'app est relancée. */
const PIN_FREE_TRIES = 5;
const pinWait = () => { const l = state.settings.pinLock; return l && l.until ? Math.max(0, Math.ceil((l.until - Date.now()) / 1000)) : 0; };
function pinFailed() {
  const l = state.settings.pinLock || { fails: 0, until: 0 };
  l.fails++;
  if (l.fails >= PIN_FREE_TRIES) l.until = Date.now() + 30000 * 2 ** (l.fails - PIN_FREE_TRIES);
  state.settings.pinLock = l; save();
}
const fmtWait = n => n >= 60 ? `${Math.ceil(n / 60)} min` : `${n} s`;
let lockEl = null;
function showLock(mode = 'unlock', onDone) {
  if (lockEl) return;
  let entry = '', first = null, busy = false;
  const el = document.createElement('div'); el.className = 'lock'; lockEl = el;
  const title = () => mode === 'unlock' ? 'Entre ton code' : first ? 'Confirme le code' : 'Choisis un code à 4 chiffres';
  el.innerHTML = `<span class="wordmark" style="font-size:34px">STM</span><div class="lock-title" data-t>${title()}</div><div class="dots" data-dots>${'<i></i>'.repeat(4)}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="key" data-k="${n}">${n}</button>`).join('')}
    <button class="key ghost" data-k="x">${mode === 'set' ? 'Annuler' : 'Oublié ?'}</button><button class="key" data-k="0">0</button><button class="key ghost" data-k="b" aria-label="Effacer">${icon('chevL', 26)}</button></div>`;
  document.body.appendChild(el);
  const dots = $('[data-dots]', el), t = $('[data-t]', el);
  const paint = () => $$('i', dots).forEach((d, i) => d.classList.toggle('on', i < entry.length));
  let timer = null;
  const showWait = () => {
    clearInterval(timer);
    const tick = () => { const w = pinWait(); if (w > 0) t.textContent = `Trop d'essais. Réessaie dans ${fmtWait(w)}`; else { clearInterval(timer); t.textContent = title(); } };
    tick(); timer = setInterval(tick, 1000);
  };
  const close = (ok) => { clearInterval(timer); el.classList.add('out'); setTimeout(() => el.remove(), 380); lockEl = null; document.removeEventListener('keydown', onKey); onDone && onDone(ok); };
  const fail = msg => { t.textContent = msg; shake(dots); entry = ''; setTimeout(paint, 250); };
  const complete = async () => {
    busy = true;
    if (mode === 'unlock') {
      const h = await hashPin(entry, state.settings.pin.salt);
      if (h === state.settings.pin.hash) { state.settings.pinLock = null; save(); close(true); }
      else { pinFailed(); fail('Code incorrect'); if (pinWait()) setTimeout(showWait, 700); }
    } else if (!first) { first = entry; entry = ''; t.textContent = title(); setTimeout(paint, 120); }
    else if (first === entry) { const salt = uid() + uid(); state.settings.pin = { salt, hash: await hashPin(entry, salt) }; state.settings.pinLock = null; save(); toast('Code activé', 'lock'); close(true); }
    else { first = null; fail('Les codes ne correspondent pas'); setTimeout(() => { t.textContent = title(); }, 1400); }
    busy = false;
  };
  const press = async k => {
    if (busy) return;
    if (k === 'b') { entry = entry.slice(0, -1); paint(); return; }
    if (k === 'x') {
      if (mode === 'set') return close(false);
      if (await confirmSheet("Sans le code, la seule solution est de tout effacer puis d'importer une sauvegarde.", 'Tout effacer', true, 'Code oublié')) { await wipeAll(); close(true); }
      return;
    }
    if (entry.length >= 4) return;
    if (mode === 'unlock' && pinWait()) { shake(dots); return; }
    entry += k; paint();
    if (entry.length === 4) setTimeout(complete, 120);
  };
  if (mode === 'unlock' && pinWait()) showWait();
  el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
  const onKey = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('b'); };
  document.addEventListener('keydown', onKey);
}

/* ---------- wipe ---------- */
async function wipeAll() {
  state = freshState();
  try { if (Store.db) await Store.clear('files'); } catch (e) {}
  save(); ui.ym = ymNow(); ui.year = null; ui.lastRest = null; ui.tab = 'mois';
  closeSheet(true); render(true); toast('Données effacées', 'trash');
}

/* ---------- actions ---------- */
const ACTIONS = {
  tab: el => go(el.dataset.tab),
  month: el => shiftMonth(+el.dataset.d),
  settings: () => openSettings(),
  installHelp: () => openInstall(),
  backup: () => openBackup(),
  importPick: () => { const p = $('#importPick'); p.value = ''; p.click(); },
  wipe: async () => { if (await confirmSheet('Toutes tes données et documents seront supprimés de cet appareil. Pense à exporter une sauvegarde avant.', 'Tout effacer', true, 'Tout effacer ?')) wipeAll(); },
  closing: el => openClosing(el.dataset.ym),
  addFlow: el => openFlow(null, { kind: el.dataset.kind || (ui.tab === 'flux' && ui.fluxSeg !== 'contrats' ? ui.fluxSeg : (hasData() ? 'out' : 'in')) }),
  addOneoff: el => openOneoff(null, { ym: el.dataset.ym }),
  addContract: el => openContract(null, { flow: el.dataset.flow }),
  calSync: () => syncCalendar(),
  balSave: () => {
    const el = $('#view [name="balNow"]'), v = el ? parseAmount(el.value) : NaN;
    if (isNaN(v)) { if (el) { shake(el.closest('.money')); el.focus(); } toast('Tape ton solde', 'close'); return; }
    state.balances.push({ date: todayISO(), t: new Date().toISOString(), amount: v });
    if (state.balances.length > 120) state.balances = state.balances.slice(-120);
    ui.balEdit = false; save(); render(false); toast('Solde enregistré');
  },
  balEdit: () => { ui.balEdit = true; render(false); const el = $('#view [name="balNow"]'); if (el) { el.focus(); el.select(); } },
  pulseOpen: () => openPulse(),
  afford: () => openAfford(),
  review: el => openReview(el.dataset.start || yearStartOf(ymNow())),
  calSetup: () => openCalSetup(),
  addSaving: () => openSavingChooser(),
  addGoal: () => openGoal(null),
  addPlacement: () => openPlacement(null),
  addDebt: () => openDebt(null),
  openItem: el => {
    const { type, id, ym } = el.dataset;
    ({ flow: () => openFlow(id, { ym: ym || (ui.tab === 'mois' ? ui.ym : undefined) }), oneoff: () => openOneoff(id), debt: () => openDebt(id), contract: () => openContract(id), goal: () => openGoal(id), placement: () => openPlacement(id) })[type]?.();
  },
  toggleEnded: el => { ui.showEnded = !ui.showEnded; el.setAttribute('aria-expanded', ui.showEnded); el.nextElementSibling.classList.toggle('open', ui.showEnded); },
  yearEdit: () => { ui.yearEdit = !ui.yearEdit; render(false); },
  year: el => { const d = +el.dataset.d; withSwap(d, ['#view'], () => { ui.year = ymAdd(ui.year, 12 * d); render(false, { swap: true }); }); },
  wMove: el => { const ws = state.settings.widgets, i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= ws.length) return; [ws[i], ws[j]] = [ws[j], ws[i]]; save(); render(false); },
  wToggle: el => { state.settings.widgets[+el.dataset.i].on = el.getAttribute('aria-checked') === 'true'; save(); },
  openCat: el => { ui.openCat = ui.openCat === el.dataset.k ? null : el.dataset.k; render(false); },
  cats: el => openCats(el.dataset.kind),
  closeSheet: () => closeSheet(),
  sheet: el => { const sh = el.closest('.sheet'); const fn = sh && sh._actions && sh._actions[el.dataset.fn]; if (fn) fn(el); }
};

/* ---------- init ---------- */
async function init() {
  await loadState();
  if (state.settings.pin) showLock('unlock');
  render(true);
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (fn) { setOrigin(el); fn(el, e); }
  });
  $('#filePick').addEventListener('change', e => { const sh = topSheet(); const files = [...e.target.files]; if (sh && sh._onFiles && files.length) sh._onFiles(files); });
  $('#importPick').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (state.settings.pin && hiddenAt && Date.now() - hiddenAt > 60000) showLock('unlock');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetStack.length && !lockEl && !reviewEl) closeSheet(); });
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
