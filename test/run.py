"""Parcours complet dans Chromium au format iPhone (402×874).

    python3 build.py && python3 test/run.py

Les données sont fictives et générées ici à chaque lancement : rien de personnel dans le dépôt.
Le script s'arrête avec un code d'erreur si une vérification échoue ou si la page logue une erreur.
Navigateur : celui de Playwright par défaut, ou le chemin donné dans la variable CHROME.
"""
import asyncio, json, os, subprocess, sys, tempfile, time
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import unquote
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
DIST = HERE.parent / 'dist'
SHOTS = HERE / 'shots'
PORT = 8765
errors, checks = [], []


def check(ok, label):
    checks.append((bool(ok), label))
    print(('  ok  ' if ok else '  ÉCHEC  ') + label)


def ym_add(ym, n):
    y, m = map(int, ym.split('-')); m += n
    y += (m - 1) // 12; m = (m - 1) % 12 + 1
    return f'{y}-{m:02d}'


def fixture():
    """Sauvegarde STM fictive : 3 mois de données, 1 clôturé avec solde, 2 en retard."""
    today = date.today(); now = today.strftime('%Y-%m')
    m3, m2, m1 = ym_add(now, -3), ym_add(now, -2), ym_add(now, -1)
    t = lambda amount, **k: {'from': m3, 'amount': amount, 'pause': False, 'employer': 0, 'freq': 'm', 'month': None, **k}
    flow = lambda i, kind, name, cat, amount, **k: {'id': i, 'kind': kind, 'name': name, 'cat': cat, 'due': k.pop('due', None), 'end': None, 'hist': [t(amount, **k)]}
    iso = lambda d: d.strftime('%Y-%m-%d')
    state = {
        'v': 2,
        'settings': {'pin': None, 'pinLock': None, 'threshold': 50, 'yearStart': 9, 'lastBackup': None, 'created': f'{m3}-01',
                     'widgets': [{'id': w, 'on': True} for w in ['bars', 'cats', 'incomes', 'savings', 'donut', 'placements']]},
        'flows': [
            {**flow('f1', 'in', 'Revenu test', 'salaire', 1000), 'day': 28},
            flow('f2', 'out', 'Loyer test', 'logement', 400),
            flow('f3', 'out', 'Transport test', 'transports', 80, employer=50),
            flow('f4', 'out', 'Abonnement test', 'abonnements', 10, due=iso(today + timedelta(days=20))),
        ],
        'oneoffs': [{'id': 'o1', 'kind': 'out', 'label': 'Dépense test', 'amount': 120, 'date': f'{m2}-10', 'cat': 'voyages'}],
        'months': {m3: {'closed': '2000-01-01T00:00:00Z', 'balance': 1000}},
        'goals': [{'id': 'g1', 'name': 'Objectif test', 'target': 1000, 'deadline': None, 'plan': 50, 'start': m3, 'moves': [{'id': 'gm1', 'ym': m3, 'amount': 50, 'src': 'close'}]}],
        'placements': [{'id': 'p1', 'name': 'Placement test', 'plan': 30, 'ops': [{'id': 'po1', 'ym': ym_add(m3, -1), 'kind': 'value', 'amount': 500}]}],
        'debts': [], 'contracts': [{'id': 'c1', 'name': 'Contrat test', 'org': 'Organisme', 'flow': 'f2', 'start': None,
                                     'endCommit': iso(today + timedelta(days=40)), 'noticeN': 1, 'noticeU': 'm', 'files': []}],
        'cats': None,
    }
    state.pop('cats')
    return {'app': 'STM', 'v': 2, 'exported': f'{today}T10:00:00Z', 'state': state, 'files': []}, (m3, m2, m1)


MINI_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"


async def main():
    SHOTS.mkdir(exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    data, (m3, m2, m1) = fixture()
    (tmp / 'fixture.json').write_text(json.dumps(data))
    (tmp / 'contrat.pdf').write_bytes(MINI_PDF)
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', str(DIST)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            launch = {'args': ['--no-sandbox']}
            if os.environ.get('CHROME'): launch['executable_path'] = os.environ['CHROME']
            b = await p.chromium.launch(**launch)
            ctx = await b.new_context(viewport={'width': 402, 'height': 874}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                      accept_downloads=True, locale='fr-FR', timezone_id='Europe/Paris')
            # shortcuts:// n'existe pas dans Chromium : on capture les URL au lieu de les ouvrir.
            await ctx.add_init_script("window.__stmOpenURL = u => { (window.__urls = window.__urls || []).push(u); };")
            page = await ctx.new_page()
            page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
            page.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
            shot = lambda n, full=False: page.screenshot(path=str(SHOTS / f'{n}.png'), full_page=full)
            wait = page.wait_for_timeout
            view = lambda: page.inner_text('#view')

            await page.goto(f'http://localhost:{PORT}/index.html'); await wait(700)
            await shot('01-vide')
            txt = await view()
            check('Commence par tes flux' in txt and 'exemple' not in txt.lower(), 'écran vide sans mode exemple')
            check(await page.locator('.tab').count() == 4, '4 onglets')

            # import des données fictives
            await page.click('[data-act=settings]'); await wait(600)
            async with page.expect_file_chooser() as fc:
                await page.click('.sheet [data-act=importPick]')
            await (await fc.value).set_files(str(tmp / 'fixture.json')); await wait(700)
            await page.click('.sheet:last-of-type [data-c="1"]'); await wait(1200)
            await shot('02-mois')
            cta = await page.inner_text('.cta')
            check('Clôturer' in cta and '1 autre en retard' in cta, f'clôture en retard proposée ({cta.strip()})')

            # flux : onglet contrats intégré
            await page.click('.tab[data-tab=flux]'); await wait(600)
            await page.click('[data-seg=fluxSeg] button[data-v=contrats]'); await wait(500)
            check('Contrat test' in await view(), 'contrats dans l’onglet Flux')
            await shot('03-flux-contrats')

            # contrat : document PDF, ouverture via fichier, rappel .ics
            await page.click('.item >> text=Contrat test'); await wait(700)
            async with page.expect_file_chooser() as fc:
                await page.click('.sheet [data-fn=addDoc]')
            await (await fc.value).set_files(str(tmp / 'contrat.pdf')); await wait(600)
            async with page.expect_download() as dl:
                await page.click('.sheet [data-fn=openDoc]')
            check((await dl.value).suggested_filename == 'contrat.pdf', 'PDF ouvert via un fichier')
            check(await page.is_visible('.sheet [data-act=calSetup]'), 'fiche contrat : « Connecter le calendrier » tant que non connecté')
            await shot('04-contrat')
            await page.click('.sheet [data-fn=save]'); await wait(700)

            # flux : changer la part employeur fait apparaître « À partir de »
            await page.click('[data-seg=fluxSeg] button[data-v=out]'); await wait(500)
            await page.click('.item >> text=Transport test'); await wait(600)
            check(await page.is_hidden('.sheet [data-show=from]'), '« À partir de » masqué sans changement')
            await page.fill('.sheet [name=employer]', '75'); await wait(200)
            check(await page.is_visible('.sheet [data-show=from]'), '« À partir de » visible après changement de la part employeur')
            await page.click('.sheet [data-fn=save]'); await wait(700)

            # supprimer un flux déjà dans un mois clôturé → proposition de résilier
            await page.click('.item >> text=Abonnement test'); await wait(600)
            await page.click('.sheet [data-fn=del]'); await wait(600)
            await shot('05-suppression-protegee')
            check('mois déjà clôturés' in await page.inner_text('.sheet:last-of-type'), 'suppression protégée')
            await page.click('.sheet:last-of-type [data-c=end]'); await wait(900)
            check('Résiliés (1)' in await view(), 'flux résilié au lieu d’être supprimé')

            # clôture du mois en retard avec solde réel
            await page.click('.tab[data-tab=mois]'); await wait(500)
            await page.click('.cta'); await wait(800)
            check('Clôture' in await page.inner_text('.sheet .sheet-title'), 'feuille de clôture ouverte')
            for _ in range(3):
                await page.click('.sheet [data-fn=next]'); await wait(500)
            await page.fill('.sheet [name=balance]', '1300'); await wait(300)
            await shot('06-cloture-solde')
            gap = await page.inner_text('.sheet [data-gap]')
            check('Dépenses non suivies' in gap or 'Mieux que prévu' in gap, f'écart calculé ({gap.strip().replace(chr(10), " ")})')
            await page.click('.sheet [data-fn=next]'); await wait(1300)
            if await page.locator('.sheet').count():
                await page.click('.sheet:last-of-type [data-c="0"]'); await wait(500)  # rappel de sauvegarde
            cta = await page.inner_text('.cta')
            check('autre' not in cta, f'il reste un seul mois à clôturer ({cta.strip()})')

            # rouvrir la clôture ne fait pas doubler le placement
            await page.click('.tab[data-tab=epargne]'); await wait(500)
            before = await page.locator('.item', has_text='Placement test').inner_text()
            await page.click('.tab[data-tab=mois]'); await wait(400)
            await page.click('[data-act=month][data-d="-1"]'); await wait(500)
            await page.click('[data-act=month][data-d="-1"]'); await wait(500)
            await page.click('.hero .badge'); await wait(700)
            for _ in range(4):
                await page.click('.sheet [data-fn=next]'); await wait(500)
            await wait(900)
            if await page.locator('.sheet').count():
                await page.click('.sheet:last-of-type [data-c="0"]'); await wait(500)
            await page.click('.tab[data-tab=epargne]'); await wait(500)
            after = await page.locator('.item', has_text='Placement test').inner_text()
            check(before == after, f'placement identique après réouverture ({after.split(chr(10))[-1]})')
            await shot('07-epargne', True)

            # calendrier : connexion, synchro, puis synchro automatique après un changement de date
            urls = lambda: page.evaluate('window.__urls || []')
            payload = lambda u: json.loads(unquote(u.split('&text=')[1]))
            await page.click('.tab[data-tab=mois]'); await wait(400)
            await page.click('[data-act=settings]'); await wait(600)
            await page.click('.sheet [data-act=calSetup]'); await wait(700)
            await shot('10-calendrier-config')
            await page.click('.sheet:last-of-type [data-fn=ready]'); await wait(900)
            u = await urls()
            check(len(u) == 1 and u[0].startswith('shortcuts://run-shortcut?name=STM%20Calendrier&input=text&text='), 'synchro envoyée au raccourci')
            ev = payload(u[0])['events']
            notice = next((e for e in ev if e['title'] == 'Résilier Contrat test (préavis)'), None)
            check(notice and notice['alert'] == 'week' and 0 < notice['days'] < 40, 'préavis du contrat dans la synchro (un mois avant la fin)')
            check(sum(e['title'].startswith('Clôturer') for e in ev) >= 12, 'rappels de clôture dans la synchro')
            await shot('11-reglages-calendrier')
            await page.click('.sheet [data-act=closeSheet]'); await wait(500)
            check('Calendrier à mettre à jour' not in await view(), 'pas de rappel de synchro juste après')
            await page.click('.tab[data-tab=flux]'); await wait(400)
            await page.click('[data-seg=fluxSeg] button[data-v=contrats]'); await wait(500)
            await page.click('.item >> text=Contrat test'); await wait(700)
            check(not await page.is_visible('.sheet [data-act=calSetup]'), 'fiche contrat sans bouton une fois connecté')
            new_end = (date.today() + timedelta(days=100)).strftime('%Y-%m-%d')
            await page.fill('.sheet [name=endCommit]', new_end)
            await page.click('.sheet [data-fn=save]'); await wait(1200)
            u = await urls()
            check(len(u) == 2 and any(e['title'] == "Fin d'engagement : Contrat test" and e['days'] == 100 for e in payload(u[1])['events']), 'synchro automatique après changement de date')

            # rappel de prélèvement sur le loyer
            await page.click('[data-seg=fluxSeg] button[data-v=out]'); await wait(500)
            await page.click('.item >> text=Loyer test'); await wait(700)
            check(await page.is_hidden('.sheet [data-remind]'), 'options de rappel masquées par défaut')
            await page.click('.sheet [data-sw=remind]'); await wait(300)
            check(await page.is_visible('.sheet [data-remind]'), 'options de rappel affichées')
            await page.click('.sheet [data-fn=save]'); await wait(500)
            check('jour du paiement' in (await page.inner_text('#toast')).lower(), 'rappel refusé sans jour de paiement')
            await page.select_option('.sheet [name=day]', '5')
            await page.click('.sheet [data-seg=remindAlert] button[data-v=week]')
            await page.evaluate("document.querySelector('.sheet .sheet-body').scrollTop = 9999"); await wait(300)
            await shot('12-rappel-loyer')
            await page.click('.sheet [data-fn=save]'); await wait(1200)
            u = await urls()
            loyer = [e for e in payload(u[-1])['events'] if e['title'].startswith('Loyer test')]
            check(len(u) == 3 and len(loyer) >= 12 and all(e['alert'] == 'week' and e['hour'] == 9 for e in loyer), f'rappels du loyer envoyés ({len(loyer)} prélèvements)')

            # point solde et « je peux me le permettre ? »
            await page.click('.tab[data-tab=mois]'); await wait(500)
            for _ in range(3):
                if await page.locator('#view [name=balNow]').count(): break
                await page.click('[data-act=month][data-d="1"]'); await wait(500)
            await page.fill('#view [name=balNow]', '900'); await page.click('#view [data-act=balSave]'); await wait(700)
            card = await page.inner_text('#view .bigstat')
            await shot('13-point-solde')
            check('Par jour jusqu' in card and 'Libre' in card, f'carte jusqu’à la paie ({card.splitlines()[0]})')
            check('Avance' in card, 'jours d’avance affichés')
            await page.click('#view [data-act=pulseOpen]'); await wait(700)
            check('Encore à passer' in await page.inner_text('.sheet'), 'détail du point solde')
            await page.click('.sheet [data-act=closeSheet]'); await wait(500)
            await page.click('#view [data-act=afford]'); await wait(700)
            await page.fill('.sheet [name=amount]', '60'); await page.fill('.sheet [name=label]', 'Concert'); await wait(300)
            res = await page.inner_text('.sheet [data-res]')
            await shot('14-je-peux')
            check('Par jour, après' in res and ('Oui' in res or 'manquerait' in res), f'simulation affichée ({res.splitlines()[1] if len(res.splitlines()) > 1 else res})')
            check('En temps de travail' in res, 'prix en heures de travail')
            before_free = card
            # « Je l'achète » se maintient : un appui bref n'achète rien
            hold = page.locator('.sheet [data-hold=buy]')
            await hold.click(); await wait(300)
            check(await page.locator('.sheet').count() == 1 and 'Maintiens' in await hold.inner_text(), 'appui bref : rien n’est acheté')
            box = await hold.bounding_box()
            await page.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            await page.mouse.down(); await wait(1100); await page.mouse.up(); await wait(1300)
            check('Concert' in await view(), 'achat ajouté aux grosses dépenses')
            check(await page.inner_text('#view .bigstat') != before_free, 'marge recalculée après l’achat')

            # mouvement : courbe scrubbable, rien qui traîne après les feuilles
            check(await page.locator('#view .pc-chart svg').count() == 1, 'courbe jusqu’à la paie affichée')
            ch = await page.locator('#view .pc-chart').bounding_box()
            await page.mouse.move(ch['x'] + 8, ch['y'] + ch['height'] / 2); await page.mouse.down()
            await page.mouse.move(ch['x'] + ch['width'] * .8, ch['y'] + ch['height'] / 2, steps=6); await wait(300)
            check('solde prévu' in await page.inner_text('#view .pc-lbl'), 'scrub : solde prévu du jour touché')
            await page.mouse.up(); await wait(700)
            check(await page.locator('.sheet').count() == 0 and 'Par jour' in await page.inner_text('#view .pc-lbl'), 'scrub : la fiche ne s’ouvre pas, la carte revient')
            check(await page.locator('.fx-ghost, .fx-lifted').count() == 0 and not await page.evaluate("document.documentElement.classList.contains('receded')"), 'aucune trace d’animation après fermeture')

            # à payer : une charge sans paiement automatique s'affiche sur l'écran Mois et se coche
            await page.click('.tab[data-tab=flux]'); await wait(500)
            await page.click('[data-seg=fluxSeg] button[data-v=out]'); await wait(500)
            await page.click('.item >> text=Transport test'); await wait(700)
            check(await page.get_attribute('.sheet [data-sw=auto]', 'aria-checked') == 'true', 'paiement automatique activé par défaut')
            await page.click('.sheet [data-sw=auto]'); await wait(300)
            check(await page.is_visible('.sheet [data-auto-hint]') and 'échéance' in await page.inner_text('.sheet [data-daylbl]'), 'paiement manuel : jour de l’échéance demandé')
            await page.click('.sheet [data-fn=save]'); await wait(500)
            check('échéance' in (await page.inner_text('#toast')).lower(), 'paiement manuel refusé sans jour')
            await page.select_option('.sheet [name=day]', str(date.today().day))
            await page.click('.sheet [data-fn=save]'); await wait(900)
            check('à payer le' in await view(), 'charge « à payer le » dans Flux')
            await page.click('.tab[data-tab=mois]'); await wait(700)
            rows = page.locator('#view .item.pay', has_text='Transport test')
            check(await rows.count() >= 1 and "Aujourd'hui" in await rows.first.inner_text(), 'à payer sur l’écran Mois, à sa date')
            await shot('18-a-payer')
            per_day = await page.inner_text('#view .pc-val')
            await rows.first.locator('[data-act=payToggle]').click(); await wait(900)
            check(await page.inner_text('#view .pc-val') == per_day, 'cochée après le point solde : toujours comptée dans la marge')
            paid = page.locator('#view .item.pay.paid', has_text='Transport test')
            check(await paid.count() == 1 and 'Payé le' in await paid.inner_text(), 'échéance cochée payée')
            await shot('19-a-payer-coche')
            await paid.locator('[data-act=payToggle]').click(); await wait(900)
            check(await page.locator('#view .item.pay.paid').count() == 0, 'échéance décochée')

            # à payer : remboursement de dette fait soi-même
            await page.click('.tab[data-tab=epargne]'); await wait(500)
            await page.click('#view [data-act=addDebt]'); await wait(700)
            await page.fill('.sheet [name=who]', 'Personne test'); await page.fill('.sheet [name=amount]', '200')
            await page.click('.sheet [data-seg=planFreq] button[data-v=once]'); await wait(300)
            await page.fill('.sheet [name=planAmount]', '50')
            check(await page.get_attribute('.sheet [data-sw=auto]', 'aria-checked') == 'true', 'dette : paiement automatique activé par défaut')
            await page.click('.sheet [data-sw=auto]'); await wait(200)
            await page.click('.sheet [data-fn=save]'); await wait(900)
            await page.click('.tab[data-tab=mois]'); await wait(700)
            check(await page.locator('#view .item.pay', has_text='Rembourser Personne test').count() == 1, 'remboursement de dette dans « À payer »')
            await page.locator('#view .item.pay', has_text='Rembourser Personne test').locator('[data-act=payToggle]').click(); await wait(900)
            await page.click('.tab[data-tab=epargne]'); await wait(500)
            check('150' in await page.locator('#view .item', has_text='Personne test').inner_text(), 'dette cochée : remboursement enregistré')

            # année : écart avec le réel
            await page.click('.tab[data-tab=annee]'); await wait(700)
            check('Écart avec le réel' in await view(), 'écart affiché dans l’année')
            await shot('08-annee', True)

            # bilan d'alternance
            await page.click('[data-act=review]'); await wait(700)
            await shot('15-bilan-ton')
            await page.click('.review [data-rv=savage]'); await wait(600)
            texts = []
            for k in range(14):
                texts.append(await page.inner_text('.review .rv-slide'))
                if k == 1: await shot('16-bilan-diapo')
                if await page.locator('.review .rv-slide [data-rv=close]').count(): break
                await page.mouse.click(350, 500); await wait(450)
            await shot('17-bilan-fin')
            check(len(texts) >= 5 and any('Tu as gagné' in t for t in texts), f'bilan en {len(texts)} diapos')
            await page.click('.review .rv-slide [data-rv=close]'); await wait(600)
            check(await page.locator('.review').count() == 0, 'bilan fermé')

            # sauvegarde : sans le code
            await page.click('.tab[data-tab=mois]'); await wait(400)
            await page.click('[data-act=settings]'); await wait(600)
            await page.click('.sheet [data-fn=pin]'); await wait(500)
            for k in '12341234':
                await page.click(f'.lock [data-k="{k}"]'); await wait(150)
            await wait(800)
            await page.click('.sheet [data-act=backup]'); await wait(1000)
            async with page.expect_download() as dl:
                await page.click('.sheet [data-fn=go]')
            backup = json.loads(Path(await (await dl.value).path()).read_text()); await wait(700)
            check(backup['state']['settings']['pin'] is None, 'code absent de la sauvegarde')
            check(len(backup['files']) == 1, 'document inclus dans la sauvegarde')
            (tmp / 'backup.json').write_text(json.dumps(backup))

            # code : délai après 5 erreurs, conservé au rechargement
            await page.reload(); await wait(900)
            for _ in range(5):
                for k in '9999':
                    await page.click(f'.lock [data-k="{k}"]'); await wait(60)
                await wait(900)
            await shot('09-code-bloque')
            check('Trop d' in await page.inner_text('.lock'), 'attente après 5 erreurs')
            await page.reload(); await wait(900)
            check('Trop d' in await page.inner_text('.lock'), 'attente conservée après rechargement')
            await wait(30500)
            for k in '1234':
                await page.click(f'.lock [data-k="{k}"]'); await wait(100)
            await wait(900)
            check(await page.locator('.lock').count() == 0, 'déverrouillé après l’attente')

            # tout effacer puis réimporter : données revenues, code de l'appareil conservé
            await page.click('[data-act=settings]'); await wait(600)
            await page.click('.sheet [data-act=wipe]'); await wait(600)
            await page.click('.sheet:last-of-type [data-c="1"]'); await wait(1200)
            await page.click('[data-act=settings]'); await wait(600)
            async with page.expect_file_chooser() as fc:
                await page.click('.sheet [data-act=importPick]')
            await (await fc.value).set_files(str(tmp / 'backup.json')); await wait(800)
            await page.click('.sheet:last-of-type [data-c="1"]'); await wait(1500)
            await page.click('.tab[data-tab=flux]'); await wait(400)
            await page.click('[data-seg=fluxSeg] button[data-v=contrats]'); await wait(500)
            check('1 doc.' in await view(), 'contrat et document restaurés')
            await b.close()
    finally:
        srv.terminate()
    if errors:
        print('Erreurs de la page :', json.dumps(errors, indent=1, ensure_ascii=False))
    bad = [l for ok, l in checks if not ok]
    print(f'\n{len(checks) - len(bad)} vérifications réussies, {len(bad)} en échec, {len(errors)} erreurs de page')
    sys.exit(1 if bad or errors else 0)

asyncio.run(main())
