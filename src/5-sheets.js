/* ---------- shared helpers for sheets ---------- */
function upsertHist(f, from, entry) {
  f.hist = f.hist.filter(h => h.from !== from);
  f.hist.push({ from, ...entry });
  sortHist(f);
}
const primary = (label, fn = 'save') => `<button class="btn btn-primary" data-act="sheet" data-fn="${fn}">${esc(label)}</button>`;
const dangerBtn = (label, fn = 'del') => `<button class="btn btn-danger btn-block" style="margin-top:22px" data-act="sheet" data-fn="${fn}">${esc(label)}</button>`;
function sheetActions(sh, map) { sh._actions = map; }
/* Tant que le calendrier n'est pas connecté, les fiches à échéance proposent de le faire.
   Une fois connecté, la synchro se fait toute seule à l'enregistrement. */
/* Bloc « Rappel dans le calendrier » des flux et des grosses dépenses. */
const dayOptions = sel => Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === sel ? 'selected' : ''}>${i ? i + 1 : '1er'}</option>`).join('');
function remindBlock(r) {
  const on = !!(r && r.on);
  return `<div class="field"><div class="group"><div class="setting"><span class="ico">${icon('calendar', 19)}</span><span class="grow">Rappel dans le calendrier</span><button type="button" class="switch" role="switch" data-sw="remind" aria-checked="${on}" aria-label="Rappel dans le calendrier"></button></div></div>
    <div data-remind ${on ? '' : 'hidden'} style="margin-top:12px">
      <div class="field"><span class="lbl">Me prévenir</span>${seg('remindAlert', REMIND_ALERTS, (r && r.alert) || 'day')}</div>
      ${calConnectBtn()}
    </div></div>`;
}
function wireRemind(sh) {
  sh.addEventListener('click', e => { const sw = e.target.closest('[data-sw="remind"]'); if (sw) $('[data-remind]', sh).hidden = sw.getAttribute('aria-checked') !== 'true'; });
}
function readRemind(sh) {
  const sw = $('[data-sw="remind"]', sh);
  if (!sw || sw.getAttribute('aria-checked') !== 'true') return null;
  return { on: true, alert: segVal(sh, 'remindAlert') };
}
const calConnectBtn = () => state.settings.calReady ? '' : `<button type="button" class="btn btn-ghost btn-block" data-act="calSetup">${icon('calendar', 20)}Connecter le calendrier</button>`;
/* « Paiement automatique » des charges et des remboursements de dettes : activé par défaut.
   Désactivé, chaque échéance s'affiche dans « À payer » sur l'écran Mois. */
function autoBlock(on) {
  return `<div class="field"><div class="group"><div class="setting"><span class="ico">${icon('repeat', 19)}</span><span class="grow">Paiement automatique</span><button type="button" class="switch" role="switch" data-sw="auto" aria-checked="${on}" aria-label="Paiement automatique"></button></div></div>
    <p class="hint" data-auto-hint ${on ? 'hidden' : ''}>Rappel dans « À payer » sur l'écran Mois.</p></div>`;
}
const readAuto = sh => { const sw = $('[data-sw="auto"]', sh); return !sw || sw.getAttribute('aria-checked') === 'true'; };
function wireAuto(sh, onChange) {
  sh.addEventListener('click', e => {
    if (!e.target.closest('[data-sw="auto"]')) return;
    $('[data-auto-hint]', sh).hidden = readAuto(sh);
    if (onChange) onChange(readAuto(sh));
  });
}
const dayLbl = (kind, auto) => kind === 'in' ? 'Jour du versement' : auto ? 'Jour du prélèvement' : "Jour de l'échéance";

/* ---------- flow ---------- */
function openFlow(id, opts = {}) {
  const f = id ? state.flows.find(x => x.id === id) : null;
  const isNew = !f;
  let kind = f ? f.kind : (opts.kind || 'out');
  const atYm = opts.ym || ymNow();
  const cur = f ? flowCurrentAmount(f, atYm) : null;
  const t0 = f ? flowTerms(f, atYm) : { freq: 'm', month: ymParts(atYm)[1], employer: 0 };
  const st0 = f ? flowStatus(f, atYm) : 'active';
  const linked = f ? state.contracts.filter(c => c.flow === f.id) : [];
  const auto0 = !f || f.auto !== false;
  const body = `
    ${isNew ? `<div class="field">${seg('kind', [['in', 'Revenu'], ['out', 'Charge']], kind)}</div>` : ''}
    <label class="field"><span class="lbl">Nom</span><input class="input" name="name" value="${esc(f ? f.name : '')}" placeholder="${kind === 'in' ? 'Salaire, aide…' : 'Loyer, transport…'}" autocomplete="off" enterkeyhint="done"></label>
    <div class="field"><span class="lbl">Montant</span>${moneyField('amount', cur)}</div>
    <div class="field"><span class="lbl">Fréquence</span>${seg('freq', [['m', 'Mensuel'], ['q', 'Trimestriel'], ['y', 'Annuel']], t0.freq)}</div>
    <label class="field" data-show="month" ${t0.freq === 'm' ? 'hidden' : ''}><span class="lbl">Mois de paiement</span><select class="input" name="month">${monthOptions(t0.month || ymParts(atYm)[1])}</select></label>
    <div data-show="auto" ${kind === 'in' ? 'hidden' : ''}>${autoBlock(auto0)}</div>
    <label class="field"><span class="lbl" data-daylbl>${dayLbl(kind, auto0)}</span><select class="input" name="day"><option value="">Pas précisé</option>${dayOptions(f ? f.day : null)}</select></label>
    <div class="field"><span class="lbl">Catégorie</span><div data-catwrap>${chipsCats('cat', kind, f ? f.cat : catList(kind)[0].id)}</div></div>
    <div class="field" data-show="employer" ${kind === 'in' ? 'hidden' : ''}><span class="lbl">Part payée par l'employeur</span>
      <div class="row2"><div class="suffix" data-suffix="%"><input class="input" name="employer" inputmode="decimal" value="${t0.employer ? plainNum(t0.employer) : ''}" placeholder="0"></div><div class="input" data-net style="display:flex;align-items:center;color:var(--t2);font-size:15px"></div></div></div>
    ${!isNew ? `<div class="field"><span class="lbl">Statut</span>${seg('status', [['active', 'Actif'], ['paused', 'En pause'], ['ended', 'Résilié']], st0 === 'future' ? 'active' : st0)}</div>` : ''}
    <label class="field" data-show="from" ${isNew ? '' : 'hidden'}><span class="lbl">${isNew ? 'Depuis' : 'À partir de'}</span><input class="input" type="month" name="from" value="${isNew ? (opts.from || yearStartOf(ymNow())) : atYm}"></label>
    <label class="field"><span class="lbl">Échéance ou fin d'essai</span><input class="input" type="date" name="due" value="${f && f.due ? f.due : ''}"></label>
    ${f && f.due ? calConnectBtn() : ''}
    <div data-remindwrap>${remindBlock(f && f.remind)}</div>
    ${!isNew && kind === 'out' ? `<div class="sec" style="margin-top:20px"><div class="sec-head"><h3 class="sec-title" style="font-size:17px">Contrat</h3></div>
      ${linked.length ? `<div class="group">${linked.map(contractRow).join('')}</div>` : `<button class="btn btn-ghost btn-block" data-act="addContract" data-flow="${f.id}">${icon('plus', 20)}Ajouter un contrat</button>`}</div>` : ''}
    ${!isNew ? dangerBtn('Supprimer') : ''}`;
  const sh = openSheet({ title: isNew ? 'Nouveau flux' : f.name, body, foot: primary('Enregistrer') });
  const read = () => {
    const freq = segVal(sh, 'freq');
    return {
      amount: parseAmount(fieldVal(sh, 'amount')),
      employer: kind === 'out' ? Math.min(100, Math.max(0, parseAmount(fieldVal(sh, 'employer')) || 0)) : 0,
      freq, month: freq === 'm' ? null : +fieldVal(sh, 'month')
    };
  };
  const termsChanged = r => (!isNaN(r.amount) && r.amount > 0 && r.amount !== cur) || r.employer !== (t0.employer || 0) || r.freq !== t0.freq || (r.freq !== 'm' && r.month !== t0.month);
  const upd = () => {
    const r = read();
    const net = $('[data-net]', sh);
    if (net) net.textContent = isNaN(r.amount) ? 'Coût réel' : `Réel ${money(r2(r.amount * (1 - r.employer / 100)))}`;
    if (!isNew) {
      const status = segVal(sh, 'status');
      const changed = termsChanged(r) || status !== (st0 === 'future' ? 'active' : st0);
      $('[data-show="from"]', sh).hidden = !changed;
      $('[data-show="from"] .lbl', sh).textContent = status === 'ended' ? 'Résilié à partir de' : status === 'paused' ? 'En pause à partir de' : 'À partir de';
    }
  };
  sh.addEventListener('input', upd);
  sh.addEventListener('change', upd);
  wireRemind(sh);
  wireAuto(sh, a => { $('[data-daylbl]', sh).textContent = dayLbl(kind, a); });
  sh.addEventListener('segchange', e => {
    if (e.detail.name === 'kind') {
      kind = e.detail.value;
      $('[data-catwrap]', sh).innerHTML = chipsCats('cat', kind, catList(kind)[0].id); wireControls($('[data-catwrap]', sh));
      $('[data-show="employer"]', sh).hidden = kind === 'in';
      $('[data-show="auto"]', sh).hidden = kind === 'in';
      $('[name="name"]', sh).placeholder = kind === 'in' ? 'Salaire, aide…' : 'Loyer, transport…';
      $('[data-daylbl]', sh).textContent = dayLbl(kind, readAuto(sh));
    }
    if (e.detail.name === 'freq') $('[data-show="month"]', sh).hidden = e.detail.value === 'm';
    upd();
  });
  upd();
  sheetActions(sh, {
    save() {
      const name = fieldVal(sh, 'name');
      const r = read();
      const status = isNew ? 'active' : segVal(sh, 'status');
      if (!requireField(sh, 'name', name, 'Donne un nom à ce flux')) return;
      if (!requireField(sh, 'amount', status !== 'active' || (r.amount > 0), 'Indique un montant')) return;
      const from = fieldVal(sh, 'from') || ymNow();
      const terms = { amount: r.amount > 0 ? r.amount : cur, employer: r.employer, freq: r.freq, month: r.month };
      const remind = readRemind(sh), day = +fieldVal(sh, 'day') || null, auto = kind === 'in' || readAuto(sh);
      if (!requireField(sh, 'day', !remind || day, 'Indique le jour du paiement pour le rappel')) return;
      if (!requireField(sh, 'day', auto || day, "Indique le jour de l'échéance")) return;
      /* Passage en paiement manuel : les échéances sont réclamées à partir de ce mois-ci. */
      const wasManual = f && f.auto === false;
      const common = { name, cat: chipVal(sh, 'cat'), due: fieldVal(sh, 'due') || null, day, remind, auto,
        manualFrom: auto ? null : (wasManual && f.manualFrom) || ymNow(), paid: auto ? null : (wasManual && f.paid) || null };
      if (isNew) {
        state.flows.push({ id: uid(), kind, ...common, hist: [{ from, ...terms, pause: false }], end: null });
      } else {
        Object.assign(f, common);
        if (status === 'ended') f.end = from;
        else {
          if (st0 === 'ended') f.end = null;
          if (status === 'paused' && (st0 !== 'paused' || termsChanged(r))) upsertHist(f, from, { ...terms, pause: true });
          else if (status === 'active' && (st0 === 'paused' || termsChanged(r))) upsertHist(f, from, { ...terms, pause: false });
        }
      }
      save(); closeSheet(); refresh(); toast(isNew ? 'Flux ajouté' : 'Flux enregistré'); calMaybeSync();
    },
    async del() {
      if (flowInClosedMonths(f)) {
        const v = await choiceSheet({
          title: `Supprimer « ${esc(f.name)} » ?`,
          message: `Ce flux compte dans des mois déjà clôturés. Le supprimer changerait leurs totaux. Le résilier garde l'historique.`,
          choices: [{ v: 'end', label: `Résilier dès ${ymMonth(ymNow())}`, cls: 'btn-primary' }],
          extra: [{ v: 'del', label: 'Supprimer quand même', cls: 'btn-danger' }]
        });
        if (v === 'end') { f.end = ymNow(); save(); closeSheet(); refresh(); toast('Flux résilié'); calMaybeSync(); return; }
        if (v !== 'del') return;
      } else if (!(await confirmSheet(`Supprimer « ${esc(f.name)} » et tout son historique ?`, 'Supprimer', true))) return;
      state.flows = state.flows.filter(x => x !== f);
      state.contracts.forEach(c => { if (c.flow === f.id) c.flow = null; });
      save(); closeSheet(); refresh(); toast('Flux supprimé', 'trash'); calMaybeSync();
    }
  });
}

/* ---------- one-off (grosse dépense / entrée ponctuelle) ---------- */
function openOneoff(id, opts = {}) {
  const o = id ? state.oneoffs.find(x => x.id === id) : null;
  let kind = o ? o.kind : 'out';
  const ym = opts.ym || ymNow();
  const defDate = ym === ymNow() ? todayISO() : `${ym}-15`;
  const body = `
    <div class="field">${seg('kind', [['out', 'Dépense'], ['in', 'Entrée']], kind)}</div>
    <label class="field"><span class="lbl">Libellé</span><input class="input" name="label" value="${esc(o ? o.label : '')}" placeholder="Billets de train, cadeau…" autocomplete="off"></label>
    <div class="field"><span class="lbl">Montant</span>${moneyField('amount', o ? o.amount : null, String(state.settings.threshold))}</div>
    <label class="field"><span class="lbl">Date</span><input class="input" type="date" name="date" value="${o ? o.date : defDate}"></label>
    <div class="field"><span class="lbl">Catégorie</span><div data-catwrap>${chipsCats('cat', kind, o ? o.cat : (kind === 'out' ? 'loisirs' : 'autres-in'))}</div></div>
    ${remindBlock(o && o.remind)}
    ${o ? dangerBtn('Supprimer') : ''}`;
  const sh = openSheet({ title: o ? o.label : kind === 'out' ? 'Grosse dépense' : 'Entrée ponctuelle', body, foot: primary('Enregistrer') });
  wireRemind(sh);
  sh.addEventListener('segchange', e => {
    if (e.detail.name !== 'kind') return;
    kind = e.detail.value;
    $('[data-catwrap]', sh).innerHTML = chipsCats('cat', kind, kind === 'out' ? 'loisirs' : 'autres-in'); wireControls($('[data-catwrap]', sh));
    $('.sheet-title', sh).textContent = kind === 'out' ? 'Grosse dépense' : 'Entrée ponctuelle';
  });
  sheetActions(sh, {
    save() {
      const label = fieldVal(sh, 'label'), amount = parseAmount(fieldVal(sh, 'amount')), date = fieldVal(sh, 'date');
      if (!requireField(sh, 'label', label, 'Ajoute un libellé')) return;
      if (!requireField(sh, 'amount', amount > 0, 'Indique un montant')) return;
      if (!requireField(sh, 'date', date, 'Choisis une date')) return;
      const data = { kind, label, amount, date, cat: chipVal(sh, 'cat'), remind: readRemind(sh) };
      if (o) Object.assign(o, data); else state.oneoffs.push({ id: uid(), ...data });
      save(); closeSheet(); refresh(); toast(o ? 'Enregistré' : 'Ajouté'); calMaybeSync();
    },
    async del() {
      if (!(await confirmSheet(`Supprimer « ${esc(o.label)} » ?`, 'Supprimer', true))) return;
      state.oneoffs = state.oneoffs.filter(x => x !== o); save(); closeSheet(); refresh(); toast('Supprimé', 'trash'); calMaybeSync();
    }
  });
}

/* ---------- contract ---------- */
async function loadFileRecs(ids) {
  const out = {};
  for (const id of ids) { try { const rec = await Store.get('files', id); if (rec) out[id] = { rec }; } catch (e) {} }
  return out;
}
/* Ouverture via la feuille de partage : elle affiche l'aperçu du PDF et propose
   « Enregistrer dans Fichiers ». Les URL blob en target=_blank sont peu fiables en PWA iOS. */
const openDoc = r => shareOrDownload(new File([r.rec.data], r.rec.name, { type: r.rec.type }));
function openContract(id, opts = {}) {
  const c = id ? state.contracts.find(x => x.id === id) : null;
  const draft = { files: c ? [...(c.files || [])] : [], added: [], removed: [] };
  let recs = {};
  let saved = false;
  const outFlows = state.flows.filter(f => f.kind === 'out');
  const datesBlock = () => {
    const tmp = { endCommit: fieldVal(sh, 'endCommit'), noticeN: fieldVal(sh, 'noticeN'), noticeU: segVal(sh, 'noticeU') };
    const nd = noticeDate(tmp), name = fieldVal(sh, 'name') || 'Contrat';
    if (nd) return `<p class="hint" style="font-size:15px;color:var(--t1);margin:0 4px 10px">Résilier avant le ${fmtDate(nd)}</p>${calConnectBtn()}`;
    if (tmp.endCommit) return calConnectBtn();
    return '';
  };
  const docsBlock = () => `${draft.files.length ? `<div class="group oplist">${draft.files.map(fid => {
      const r = recs[fid]; if (!r) return '';
      return `<div class="item"><span class="ico sq">${icon('file', 19)}</span><div class="item-main"><div class="item-title">${esc(r.rec.name)}</div><div class="item-sub">${fmtSize(r.rec.size)}</div></div>
        <button class="icon-btn" data-act="sheet" data-fn="openDoc" data-id="${fid}" aria-label="Ouvrir ou enregistrer">${icon('share', 18)}</button>
        <button class="icon-btn" data-act="sheet" data-fn="rmDoc" data-id="${fid}" aria-label="Retirer">${icon('trash', 18)}</button></div>`;
    }).join('')}</div>` : ''}
    <button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="sheet" data-fn="addDoc">${icon('plus', 20)}Ajouter un document</button>`;
  const body = `
    <label class="field"><span class="lbl">Nom</span><input class="input" name="name" value="${esc(c ? c.name : '')}" placeholder="Mutuelle, box, assurance…" autocomplete="off"></label>
    <label class="field"><span class="lbl">Organisme</span><input class="input" name="org" value="${esc(c ? c.org || '' : '')}" autocomplete="off"></label>
    <label class="field"><span class="lbl">Flux lié</span><select class="input" name="flow"><option value="">Aucun</option>${outFlows.map(f => `<option value="${f.id}" ${(c ? c.flow : opts.flow) === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
    <div class="row2"><label class="field"><span class="lbl">Début</span><input class="input" type="date" name="start" value="${c ? c.start || '' : ''}"></label><label class="field"><span class="lbl">Fin d'engagement</span><input class="input" type="date" name="endCommit" value="${c ? c.endCommit || '' : ''}"></label></div>
    <div class="field"><span class="lbl">Préavis de résiliation</span><div class="row2"><input class="input" name="noticeN" inputmode="numeric" value="${c && c.noticeN ? c.noticeN : ''}" placeholder="0">${seg('noticeU', [['d', 'Jours'], ['m', 'Mois']], c ? c.noticeU || 'm' : 'm')}</div></div>
    <div data-dates></div>
    <div class="sec" style="margin-top:20px"><div class="sec-head"><h3 class="sec-title" style="font-size:17px">Documents</h3></div><div data-docs></div></div>
    ${c ? dangerBtn('Supprimer le contrat') : ''}`;
  const sh = openSheet({
    title: c ? c.name : 'Nouveau contrat', body, foot: primary('Enregistrer'),
    onClose: async () => {
      if (!saved) for (const fid of draft.added) { try { await Store.del('files', fid); } catch (e) {} }
    }
  });
  const paintDocs = () => { $('[data-docs]', sh).innerHTML = docsBlock(); };
  const paintDates = () => { $('[data-dates]', sh).innerHTML = datesBlock(); };
  sh.addEventListener('input', paintDates); sh.addEventListener('change', paintDates); sh.addEventListener('segchange', paintDates);
  paintDates(); paintDocs();
  loadFileRecs(draft.files).then(r => { recs = r; paintDocs(); });
  sh._onFiles = async files => {
    for (const file of files) {
      try {
        const data = await file.arrayBuffer();
        const fid = uid();
        await Store.put('files', fid, { id: fid, name: file.name, type: file.type || 'application/octet-stream', size: file.size, data, added: todayISO() });
        draft.files.push(fid); draft.added.push(fid);
        recs[fid] = { rec: { name: file.name, type: file.type || 'application/octet-stream', size: file.size, data } };
      } catch (e) { toast('Impossible d’ajouter ce fichier', 'close'); }
    }
    paintDocs();
  };
  sheetActions(sh, {
    addDoc() { const p = $('#filePick'); p.value = ''; p.click(); },
    openDoc(el) { const r = recs[el.dataset.id]; if (r) openDoc(r); },
    rmDoc(el) { const fid = el.dataset.id; draft.files = draft.files.filter(x => x !== fid); draft.removed.push(fid); paintDocs(); },
    async save() {
      const name = fieldVal(sh, 'name');
      if (!requireField(sh, 'name', name, 'Donne un nom au contrat')) return;
      const data = { name, org: fieldVal(sh, 'org'), flow: fieldVal(sh, 'flow') || null, start: fieldVal(sh, 'start') || null, endCommit: fieldVal(sh, 'endCommit') || null, noticeN: parseInt(fieldVal(sh, 'noticeN')) || 0, noticeU: segVal(sh, 'noticeU'), files: draft.files };
      if (c) Object.assign(c, data); else state.contracts.push({ id: uid(), ...data });
      for (const fid of draft.removed) { try { await Store.del('files', fid); } catch (e) {} }
      saved = true; save(); closeSheet(); refresh(); toast(c ? 'Contrat enregistré' : 'Contrat ajouté'); calMaybeSync();
    },
    async del() {
      if (!(await confirmSheet(`Supprimer « ${esc(c.name)} » et ses documents ?`, 'Supprimer', true))) return;
      for (const fid of c.files || []) { try { await Store.del('files', fid); } catch (e) {} }
      state.contracts = state.contracts.filter(x => x !== c); saved = true; save(); closeSheet(); refresh(); toast('Contrat supprimé', 'trash'); calMaybeSync();
    }
  });
}

/* ---------- goal ---------- */
function movesList(list, fmt) {
  if (!list.length) return '';
  return `<div class="group oplist" style="margin-top:10px">${list.map(m => `<div class="item"><div class="item-main"><div class="item-title">${esc(fmt(m).title)}</div><div class="item-sub">${esc(ymLabel(m.ym))}</div></div><div class="item-amt">${fmt(m).amt}</div><button class="icon-btn" data-act="sheet" data-fn="rmMove" data-id="${m.id}" aria-label="Supprimer">${icon('trash', 17)}</button></div>`).join('')}</div>`;
}
const miniForm = (extra = '', btn = 'Ajouter') => `<div class="mini">${extra}${moneyField('mvAmount', null)}<input class="input" type="month" name="mvYm" value="${ymNow()}"></div><button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="sheet" data-fn="addMove">${esc(btn)}</button>`;
function ensureIds(list) { list.forEach(m => { if (!m.id) m.id = uid(); }); }
function openGoal(id) {
  const g = id ? state.goals.find(x => x.id === id) : null;
  const paint = () => {
    const saved = g ? goalSaved(g) : 0;
    if (g) ensureIds(g.moves);
    return `
    <label class="field"><span class="lbl">Nom</span><input class="input" name="name" value="${esc(g ? g.name : '')}" placeholder="Fonds d'urgence, voyage…" autocomplete="off"></label>
    <div class="field"><span class="lbl">Montant à atteindre</span>${moneyField('target', g ? g.target : null)}</div>
    <div class="row2"><label class="field"><span class="lbl">Pour quand</span><input class="input" type="month" name="deadline" value="${g && g.deadline ? g.deadline : ''}"></label>
    <label class="field"><span class="lbl">Par mois</span><div class="suffix" data-suffix="€"><input class="input" name="plan" inputmode="decimal" value="${g && g.plan ? plainNum(g.plan) : ''}" placeholder="0"></div></label></div>
    ${g ? `<div class="sec" style="margin-top:16px"><div class="sec-head"><h3 class="sec-title" style="font-size:17px">Mouvements</h3><span class="sec-aside">${money(saved)}</span></div>
      ${movesList(sortByYm(g.moves.slice()).reverse(), m => ({ title: m.amount >= 0 ? 'Mis de côté' : 'Retiré', amt: money(m.amount, { sign: true }) }))}
      <div style="margin-top:12px">${seg('mvDir', [['in', 'Ajout'], ['out', 'Retrait']], 'in')}</div>${miniForm()}</div>${dangerBtn("Supprimer l'objectif")}` : ''}`;
  };
  const sh = openSheet({ title: g ? g.name : 'Nouvel objectif', body: paint(), foot: primary('Enregistrer') });
  sh._refresh = () => setSheetBody(sh, paint());
  sheetActions(sh, {
    save() {
      const name = fieldVal(sh, 'name'), target = parseAmount(fieldVal(sh, 'target'));
      if (!requireField(sh, 'name', name, "Donne un nom à l'objectif")) return;
      if (!requireField(sh, 'target', target > 0, 'Indique le montant à atteindre')) return;
      const data = { name, target, deadline: fieldVal(sh, 'deadline') || null, plan: parseAmount(fieldVal(sh, 'plan')) || 0 };
      if (g) Object.assign(g, data); else state.goals.push({ id: uid(), ...data, start: ymNow(), moves: [] });
      save(); closeSheet(); refresh(); toast(g ? 'Objectif enregistré' : 'Objectif créé');
    },
    addMove() {
      const a = parseAmount(fieldVal(sh, 'mvAmount')), ym = fieldVal(sh, 'mvYm') || ymNow();
      if (!requireField(sh, 'mvAmount', a > 0, 'Indique un montant')) return;
      g.moves.push({ id: uid(), ym, amount: segVal(sh, 'mvDir') === 'out' ? -a : a });
      save(); setSheetBody(sh, paint()); render(false);
    },
    rmMove(el) { g.moves = g.moves.filter(m => m.id !== el.dataset.id); save(); setSheetBody(sh, paint()); render(false); },
    async del() {
      if (!(await confirmSheet(`Supprimer l'objectif « ${esc(g.name)} » ?`, 'Supprimer', true))) return;
      state.goals = state.goals.filter(x => x !== g); save(); closeSheet(); refresh(); toast('Objectif supprimé', 'trash');
    }
  });
}

/* ---------- placement ---------- */
const planField = v => `<label class="field"><span class="lbl">Versement prévu par mois</span><div class="suffix" data-suffix="€"><input class="input" name="plan" inputmode="decimal" value="${v ? plainNum(v) : ''}" placeholder="0"></div></label>`;
const OP_LABEL = { value: 'Valorisation', deposit: 'Versement perso', abond: 'Abondement', third: "Apport d'un tiers", withdraw: 'Retrait' };
function openPlacement(id) {
  const p = id ? state.placements.find(x => x.id === id) : null;
  const paint = () => {
    if (!p) return `<label class="field"><span class="lbl">Nom</span><input class="input" name="name" placeholder="PEE, PEA, livret…" autocomplete="off"></label>
      <div class="field"><span class="lbl">Valeur fin ${ymMonth(ymAdd(ymNow(), -1))}</span>${moneyField('value', null)}</div>
      ${planField(null)}`;
    ensureIds(p.ops);
    const b = placementBreakdown(p);
    return `<label class="field"><span class="lbl">Nom</span><input class="input" name="name" value="${esc(p.name)}" autocomplete="off"></label>
      ${planField(p.plan)}
      <div class="tiles"><div class="tile"><span>Valeur</span><b>${money(b.value)}</b></div><div class="tile"><span>Plus-value</span><b>${money(b.gain, { sign: true })}</b></div>
      <div class="tile"><span>Versé par moi</span><b>${money(b.me)}</b></div><div class="tile"><span>Abondement</span><b>${money(b.abond)}</b></div>
      ${b.start ? `<div class="tile"><span>Valeur de départ</span><b>${money(b.start)}</b></div>` : ''}${b.third ? `<div class="tile"><span>Apport d'un tiers</span><b>${money(b.third)}</b></div>` : ''}${b.out ? `<div class="tile"><span>Retiré</span><b>${money(b.out)}</b></div>` : ''}</div>
      <div class="sec" style="margin-top:20px"><div class="sec-head"><h3 class="sec-title" style="font-size:17px">Opérations</h3></div>
      ${movesList(sortByYm(p.ops.slice()).reverse(), o => ({ title: OP_LABEL[o.kind], amt: o.kind === 'value' ? money(o.amount) : money(o.kind === 'withdraw' ? -o.amount : o.amount, { sign: true }) }))}
      <label class="field" style="margin:12px 0 0"><select class="input" name="opKind">${Object.entries(OP_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      ${miniForm('', "Ajouter l'opération")}</div>${dangerBtn('Supprimer le placement')}`;
  };
  const sh = openSheet({ title: p ? p.name : 'Nouveau placement', body: paint(), foot: primary('Enregistrer') });
  sh._refresh = () => setSheetBody(sh, paint());
  sheetActions(sh, {
    save() {
      const name = fieldVal(sh, 'name');
      if (!requireField(sh, 'name', name, 'Donne un nom au placement')) return;
      const plan = Math.max(0, parseAmount(fieldVal(sh, 'plan')) || 0);
      if (p) Object.assign(p, { name, plan });
      else {
        /* La valeur de départ est celle de fin du mois dernier : les versements de ce mois s'y ajoutent. */
        const v = parseAmount(fieldVal(sh, 'value'));
        state.placements.push({ id: uid(), name, plan, ops: v > 0 ? [{ id: uid(), ym: ymAdd(ymNow(), -1), kind: 'value', amount: v }] : [] });
      }
      save(); closeSheet(); refresh(); toast(p ? 'Placement enregistré' : 'Placement ajouté');
    },
    addMove() {
      const a = parseAmount(fieldVal(sh, 'mvAmount')), ym = fieldVal(sh, 'mvYm') || ymNow();
      if (!requireField(sh, 'mvAmount', a > 0, 'Indique un montant')) return;
      p.ops.push({ id: uid(), ym, kind: fieldVal(sh, 'opKind'), amount: a });
      save(); setSheetBody(sh, paint()); render(false);
    },
    rmMove(el) { p.ops = p.ops.filter(o => o.id !== el.dataset.id); save(); setSheetBody(sh, paint()); render(false); },
    async del() {
      if (!(await confirmSheet(`Supprimer « ${esc(p.name)} » et ses opérations ?`, 'Supprimer', true))) return;
      state.placements = state.placements.filter(x => x !== p);
      state.debts.forEach(d => { if (d.placement === p.id) d.placement = null; });
      save(); closeSheet(); refresh(); toast('Placement supprimé', 'trash');
    }
  });
}

/* ---------- debt ---------- */
const PLAN_FREQS = [['none', 'Aucun'], ['once', 'Une fois'], ['m', 'Chaque mois']];
function openDebt(id) {
  const d = id ? state.debts.find(x => x.id === id) : null;
  const paint = () => {
    if (d) ensureIds(d.moves);
    const dir = d ? d.dir : 'owe', p = d && d.plan, freq = p ? p.freq : 'none';
    return `<div class="field">${seg('dir', [['owe', 'Je dois'], ['owed', 'On me doit']], dir)}</div>
    <label class="field"><span class="lbl">Personne</span><input class="input" name="who" value="${esc(d ? d.who : '')}" autocomplete="off"></label>
    <div class="field"><span class="lbl">Montant</span>${moneyField('amount', d ? d.amount : null)}</div>
    <div class="row2"><label class="field"><span class="lbl">Depuis</span><input class="input" type="month" name="ym" value="${d ? d.ym : ymNow()}"></label>
    <label class="field" data-show="plc" ${dir === 'owed' || !state.placements.length ? 'hidden' : ''}><span class="lbl">Placé sur</span><select class="input" name="placement"><option value="">Aucun</option>${state.placements.map(p => `<option value="${p.id}" ${d && d.placement === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label></div>
    <div class="field" style="margin-top:8px"><span class="lbl" data-plan-lbl>${dir === 'owe' ? 'Remboursement prévu' : 'Remboursement attendu'}</span>${seg('planFreq', PLAN_FREQS, freq)}</div>
    <div data-plan ${freq === 'none' ? 'hidden' : ''}>
      <div class="field"><span class="lbl" data-plan-amt>${freq === 'm' ? 'Par mois' : 'Montant'}</span>${moneyField('planAmount', p ? p.amount : null, '0', 'sm')}</div>
      <label class="field" data-plan-once ${freq === 'once' ? '' : 'hidden'}><span class="lbl">Le</span><input class="input" type="date" name="planDate" value="${p && p.date ? p.date : todayISO()}"></label>
      <div class="row2" data-plan-m ${freq === 'm' ? '' : 'hidden'}>
        <label class="field"><span class="lbl">Le</span><select class="input" name="planDay">${dayOptions(p && p.day ? p.day : 5)}</select></label>
        <label class="field"><span class="lbl">À partir de</span><input class="input" type="month" name="planFrom" value="${p && p.from ? p.from : ymNow()}"></label>
      </div>
      <p class="hint" data-plan-sum style="margin:-6px 4px 16px"></p>
      <div data-show="auto" ${dir === 'owed' ? 'hidden' : ''}>${autoBlock(!p || p.auto !== false)}</div>
      ${remindBlock(p && p.remind)}
    </div>
    ${d ? `<div class="sec" style="margin-top:16px"><div class="sec-head"><h3 class="sec-title" style="font-size:17px">Remboursements</h3><span class="sec-aside">Reste ${money(Math.max(0, debtLeft(d)))}</span></div>
      <div class="bar"><i style="width:${Math.min(100, (d.amount - debtLeft(d)) / d.amount * 100)}%;--c:${d.dir === 'owe' ? 'var(--out)' : 'var(--in)'}"></i></div>
      ${movesList(sortByYm(d.moves.slice()).reverse(), m => ({ title: 'Remboursé', amt: money(m.amount) }))}
      ${miniForm('', 'Ajouter un remboursement')}</div>${dangerBtn('Supprimer la dette')}` : ''}`;
  };
  const sh = openSheet({ title: d ? (d.dir === 'owe' ? `Je dois à ${d.who}` : `${d.who} me doit`) : 'Nouvelle dette', body: paint(), foot: primary('Enregistrer') });
  /* Remboursement prévu tel qu'il est saisi (null si « Aucun »). */
  const readPlan = () => {
    const freq = segVal(sh, 'planFreq');
    if (!freq || freq === 'none') return null;
    const p = { freq, amount: parseAmount(fieldVal(sh, 'planAmount')), remind: readRemind(sh) };
    /* Je rembourse moi-même : chaque échéance va dans « À payer », à partir de ce mois-ci. */
    if (segVal(sh, 'dir') === 'owe' && !readAuto(sh)) { p.auto = false; p.manualFrom = (d && d.plan && d.plan.auto === false && d.plan.manualFrom) || ymNow(); }
    if (freq === 'once') p.date = fieldVal(sh, 'planDate');
    else { p.day = +fieldVal(sh, 'planDay') || 1; p.from = fieldVal(sh, 'planFrom') || ymNow(); }
    return p;
  };
  /* Résumé sous le formulaire : combien de versements, quand la dette est soldée. */
  const summary = () => {
    const el = $('[data-plan-sum]', sh); if (!el) return;
    const p = readPlan(), amount = parseAmount(fieldVal(sh, 'amount')), moves = d ? d.moves : [];
    if (!p || !(p.amount > 0) || !(amount > 0)) { el.textContent = ''; return; }
    const occ = debtPlanned({ amount, moves, plan: p }, ymAdd(ymNow(), 120));
    const left = r2(debtLeft({ amount, moves }) - sum(occ, o => o.amount)), last = occ[occ.length - 1];
    el.textContent = !occ.length ? 'Rien à prévoir : la dette est soldée, ou ce mois est déjà clôturé ou remboursé.'
      : p.freq === 'once' ? (left > 0 ? `Il restera ${money(left)} à rembourser.` : 'La dette sera soldée.')
      : left > 0 ? `${occ.length} versements, et il restera ${money(left)}.`
      : `${occ.length} versement${occ.length > 1 ? 's' : ''}, soldée le ${fmtDate(last.date)}${last.amount < p.amount ? ` (dernier : ${money(last.amount)})` : ''}.`;
  };
  const repaint = () => { setSheetBody(sh, paint()); summary(); };
  sh._refresh = repaint;
  wireRemind(sh);
  wireAuto(sh);
  sh.addEventListener('input', summary);
  sh.addEventListener('change', summary);
  sh.addEventListener('segchange', e => {
    const { name, value } = e.detail;
    if (name === 'dir') {
      const el = $('[data-show="plc"]', sh); if (el) el.hidden = value === 'owed' || !state.placements.length;
      $('[data-show="auto"]', sh).hidden = value === 'owed';
      $('[data-plan-lbl]', sh).textContent = value === 'owe' ? 'Remboursement prévu' : 'Remboursement attendu';
    }
    if (name === 'planFreq') {
      $('[data-plan]', sh).hidden = value === 'none';
      $('[data-plan-once]', sh).hidden = value !== 'once';
      $('[data-plan-m]', sh).hidden = value !== 'm';
      $('[data-plan-amt]', sh).textContent = value === 'm' ? 'Par mois' : 'Montant';
    }
    summary();
  });
  summary();
  sheetActions(sh, {
    save() {
      const who = fieldVal(sh, 'who'), amount = parseAmount(fieldVal(sh, 'amount'));
      if (!requireField(sh, 'who', who, 'Indique la personne')) return;
      if (!requireField(sh, 'amount', amount > 0, 'Indique un montant')) return;
      const plan = readPlan();
      if (plan && !requireField(sh, 'planAmount', plan.amount > 0, 'Indique le montant prévu')) return;
      if (plan && plan.freq === 'once' && !requireField(sh, 'planDate', plan.date, 'Choisis la date du remboursement')) return;
      const dir = segVal(sh, 'dir');
      const data = { who, amount, dir, ym: fieldVal(sh, 'ym') || ymNow(), placement: dir === 'owe' ? (fieldVal(sh, 'placement') || null) : null, plan };
      if (d) Object.assign(d, data); else state.debts.push({ id: uid(), ...data, moves: [] });
      save(); closeSheet(); refresh(); toast(d ? 'Dette enregistrée' : 'Dette ajoutée'); calMaybeSync();
    },
    addMove() {
      const a = parseAmount(fieldVal(sh, 'mvAmount')), ym = fieldVal(sh, 'mvYm') || ymNow();
      if (!requireField(sh, 'mvAmount', a > 0, 'Indique un montant')) return;
      d.moves.push({ id: uid(), ym, amount: a }); save(); repaint(); render(false); calMaybeSync();
    },
    rmMove(el) { d.moves = d.moves.filter(m => m.id !== el.dataset.id); save(); repaint(); render(false); calMaybeSync(); },
    async del() {
      if (!(await confirmSheet('Supprimer cette dette et ses remboursements ?', 'Supprimer', true))) return;
      state.debts = state.debts.filter(x => x !== d); save(); closeSheet(); refresh(); toast('Dette supprimée', 'trash'); calMaybeSync();
    }
  });
}

function openSavingChooser() {
  const opt = (fn, ic, t, s) => `<button class="item tap" data-act="sheet" data-fn="${fn}"><span class="ico">${icon(ic, 19)}</span><div class="item-main"><div class="item-title">${t}</div><div class="item-sub">${s}</div></div>${icon('chevR', 18)}</button>`;
  const sh = openSheet({ title: 'Ajouter', body: `<div class="group">${opt('goal', 'target', 'Objectif', 'Un montant à atteindre')}${opt('plc', 'coins', 'Placement', 'PEE, PEA, livret')}${opt('debt', 'handshake', 'Dette', 'Argent dû ou prêté')}</div>` });
  sheetActions(sh, { goal() { closeSheet(); openGoal(null); }, plc() { closeSheet(); openPlacement(null); }, debt() { closeSheet(); openDebt(null); } });
}

/* ---------- point solde : détail ---------- */
function openPulse() {
  const p = pulse(); if (!p) return;
  const row = x => `<div class="item" data-date="${x.date || ''}"><div class="item-main"><div class="item-title">${esc(x.name)}</div><div class="item-sub">${x.date ? fmtDateS(x.date) : x.saving ? 'Ce mois-ci' : 'Jour de paiement non précisé'}</div></div><div class="item-amt">${money(x.amount, { sign: true })}</div></div>`;
  const missing = state.flows.filter(f => !f.day && flowStatus(f) === 'active');
  const pr = projection(p);
  const sh = openSheet({
    title: `Jusqu'au ${fmtDateS(p.pay.date)}`,
    body: `<div class="chart-card pc-big"><div class="pc-read"><span class="pc-lbl">Libre le ${esc(fmtDateS(p.pay.date))}</span><b>${odoHTML(p.free, { id: 'pcBig' })}</b><span class="pc-ops small muted">Avant la paie${p.pay.flow ? ` (${esc(p.pay.flow.name)})` : ''}</span></div>
        <div class="pc-chart" data-scrub>${curveSVG(pr, { big: true })}</div>
        <div class="legend" style="margin:8px 2px 0"><span><i class="sw" style="--c:var(--t1)"></i>Solde prévu</span><span><i class="sw" style="--c:var(--t3)"></i>En dépensant ta marge</span></div></div>
      <div class="tiles" style="margin-top:12px"><div class="tile"><span>Solde du ${fmtDateS(p.bal.date)}</span><b>${money(p.bal.amount)}</b></div><div class="tile"><span>Libre</span><b>${money(p.free)}</b></div>
        <div class="tile"><span>Jours restants</span><b>${p.days}</b></div><div class="tile"><span>Par jour</span><b>${money(p.perDay)}</b></div></div>
      ${daysAhead() !== null ? `<div class="tiles" style="margin-top:12px"><div class="tile" style="grid-column:1/-1"><span>Jours d'avance</span><b>${daysAhead()} jours</b></div></div>
        <p class="hint" style="margin:8px 4px 0">Ton solde couvrirait ${daysAhead()} jours de dépenses sans nouvelle rentrée, au rythme de ${money(avgDailySpend() * 30.44, { whole: true })} par mois.</p>` : ''}
      <div class="sec-head" style="margin:22px 4px 10px"><h3 class="sec-title" style="font-size:17px">Encore à passer</h3><span class="sec-aside">${money(sum(p.items, x => x.amount), { sign: true })}</span></div>
      ${p.items.length ? `<div class="group">${p.items.map(row).join('')}</div>` : `<p class="muted" style="margin:0 4px">Rien d'ici la paie.</p>`}
      ${missing.length ? `<div class="sec-head" style="margin:22px 4px 10px"><h3 class="sec-title" style="font-size:17px">Jour de paiement à préciser</h3></div>
        <div class="group">${missing.map(f => itemRow({ act: 'openItem', attrs: `data-type="flow" data-id="${f.id}"`, ico: catIcon(f.kind, f.cat), title: f.name, sub: f.kind === 'in' ? 'Revenu ignoré dans le calcul' : 'Compté par prudence', amt: money(flowCurrentAmount(f)) })).join('')}</div>` : ''}`
  });
  /* Scrub : le solde prévu du jour touché, ses mouvements, et les lignes correspondantes s'éclairent. */
  const rd = $('.pc-read', sh), lbl = $('.pc-lbl', rd), val = $('.odo', rd), ops = $('.pc-ops', rd), def = [lbl.textContent, ops.innerHTML];
  wireScrub($('.pc-chart', sh), pr, true, d => {
    $$('.item[data-date]', sh).forEach(r => r.classList.toggle('hl', !!d && r.dataset.date === d.date));
    if (!d) { lbl.textContent = def[0]; ops.innerHTML = def[1]; odoSet(val, p.free); return; }
    lbl.textContent = `${dayLabel(d)} · solde prévu`; odoSet(val, d.v); ops.innerHTML = opsLine(d.ops);
  });
}

/* ---------- je peux me le permettre ? ---------- */
function openAfford() {
  const ym = ymNow();
  delete odoMem.afDay; delete odoMem.afRest;
  const result = a => {
    if (!(a > 0)) return `<p class="hint" style="margin:4px">Tape un montant.</p>`;
    const r = afford(a), p = r.pulse;
    const verdict = p
      ? (r.ok ? `Oui. Jusqu'au ${fmtDateS(p.pay.date)}, il te restera ${money(r.perDayAfter)} par jour.` : `Pas d'ici la paie : il te manquerait ${money(-r.freeAfter)}.`)
      : (r.ok ? `Oui, ton reste à vivre ${deMonth(ym)} le couvre.` : `Ton reste à vivre ${deMonth(ym)} ne le couvre pas.`);
    const goals = !r.ok && r.goals.length ? `<p class="hint" style="margin:14px 4px 0">Pris sur ton épargne, ça repousserait ${r.goals.map(g => `« ${esc(g.name)} » d'environ ${g.weeks} semaine${g.weeks > 1 ? 's' : ''}`).join(' et ')}.</p>` : '';
    return `<div class="hero ${r.ok ? '' : 'neg'}" style="min-height:0"><div class="hero-label">${r.ok ? 'Tu peux' : 'Attention'}</div><div style="font-size:21px;font-weight:650;line-height:1.25;margin-top:6px">${verdict}</div></div>
      <div class="tiles" style="margin-top:12px">
        ${p ? `<div class="tile"><span>Par jour, avant</span><b>${money(p.perDay)}</b></div><div class="tile"><span>Par jour, après</span><b>${odoHTML(r.perDayAfter, { id: 'afDay' })}</b></div>` : ''}
        <div class="tile"><span>Reste à vivre, avant</span><b>${money(r.restBefore)}</b></div><div class="tile"><span>Reste à vivre, après</span><b>${odoHTML(r.restAfter, { id: 'afRest' })}</b></div>
        ${workMinutes(a) ? `<div class="tile" style="grid-column:1/-1"><span>En temps de travail</span><b>${fmtWork(workMinutes(a))}</b></div>` : ''}
      </div>${goals}${p ? '' : `<p class="hint" style="margin:14px 4px 0">Ajoute ton solde sur l'écran Mois pour savoir jusqu'à la paie.</p>`}`;
  };
  let bought = false;
  const sh = openSheet({
    title: 'Je peux me le permettre ?',
    onClose: () => {
      /* Journal des « Je peux ? » (pour le bilan) : renoncer compte aussi. */
      const a = parseAmount(fieldVal(sh, 'amount'));
      if (a > 0) { state.affordLog.push({ date: todayISO(), amount: a, bought }); if (state.affordLog.length > 500) state.affordLog = state.affordLog.slice(-500); save(); }
    },
    body: `<div class="field"><span class="lbl">Combien ?</span>${moneyField('amount', null, '0')}</div>
      <label class="field"><span class="lbl">Quoi ? <span style="color:var(--t3)">facultatif</span></span><input class="input" name="label" autocomplete="off" placeholder="Sneakers, concert…"></label>
      <div data-res>${result(NaN)}</div>`,
    foot: `<button class="btn btn-ghost" data-act="closeSheet">Pas maintenant</button>${holdBtn('buy', "Je l'achète")}`
  });
  /* Chaque chiffre tapé fait rouler les montants « après » ; la feuille s'étire au lieu de sauter. */
  sh.addEventListener('input', () => {
    const a = parseAmount(fieldVal(sh, 'amount')), box = $('[data-res]', sh), h0 = sh.offsetHeight;
    box.innerHTML = result(a); odoAfter(box); sheetResize(sh, h0);
    $('[data-hold]', sh).classList.toggle('neg', a > 0 && !afford(a).ok);
  });
  wireHold(sh, 'buy');
  setTimeout(() => { const el = $('[name="amount"]', sh); el && el.focus(); }, 350);
  sheetActions(sh, {
    buy() {
      const a = parseAmount(fieldVal(sh, 'amount'));
      if (!requireField(sh, 'amount', a > 0, 'Indique un montant')) return;
      const today = todayISO(), bal = latestBalance(), big = a >= state.settings.threshold;
      /* Au-dessus du seuil : grosse dépense du jour (suivie dans le mois).
         Le solde enregistré baisse quand la dépense ne sera pas déjà comptée par le point solde. */
      if (big) state.oneoffs.push({ id: uid(), kind: 'out', label: fieldVal(sh, 'label') || 'Achat', amount: a, date: today, cat: 'shopping', remind: null });
      if (bal && (!big || bal.date === today)) bal.amount = r2(bal.amount - a);
      bought = true;
      save(); closeSheet(); refresh(); toast(big ? 'Ajouté aux grosses dépenses' : 'Pris en compte');
    }
  });
}
