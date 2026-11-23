# STM (Save the Moula) : contexte pour reprendre le projet

Application perso de finances. Un seul fichier HTML hébergé sur GitHub Pages dans un dépôt public. Les données restent en local sur le téléphone (IndexedDB). L'app est installée sur l'écran d'accueil (PWA).

Le dépôt est public : aucune donnée personnelle dans le code, les tests ou ce fichier. Le contexte personnel est dans `CONTEXTE.local.md`, ignoré par git.

## Besoins
- Usage sur iPhone, environ une fois par mois. Peu de saisie : surtout un plan et une vue sur l'année.
- On suit le récurrent (frais fixes, abonnements, revenus) et les grosses dépenses ponctuelles (seuil réglable, 50 € par défaut).
- Le coût réel d'une charge tient compte de la part payée par l'employeur.
- Objectifs d'épargne fixés par l'utilisateur, sans suggestion de l'app.
- Placements avec versements, abondement, apport d'un tiers (lié à une dette) et valorisations.
- Pas de rattachement des dépenses à un compte. À la clôture, un seul solde global (comptes et livrets, hors placements) sert à mesurer l'écart avec la prévision.
- Contrats : date d'engagement, préavis, montant, documents PDF.
- Rappels écrits dans le Calendrier iOS via un raccourci. Code PIN. Export de sauvegarde manuel avec un rappel mensuel.
- Année de septembre à août par défaut (réglable). Graphiques au choix et dans l'ordre voulu.
- Style : thème unique sombre de banque, proche de Revolut, sobre. Pas de texte explicatif inutile. Animations et transitions soignées.

## Choix de design
- Fond noir pur et surfaces gris anthracite. Boutons principaux en pilule blanche.
- Seul élément coloré : la carte « Reste à vivre », en dégradé cobalt-violet, qui passe au pourpre quand le solde est négatif. L'icône reprend ce dégradé.
- Police Bricolage Grotesque (variable : opsz, wght, wdth), sous-ensemble embarqué en base64.
- Couleurs des graphiques : revenus #3987e5, charges #d95926, épargne #c98500, placements #9085e9. La palette a été validée pour les daltoniens sur le fond #141416.
- Quatre onglets : Mois, Flux (Revenus, Charges, Contrats), Épargne, Année.

## Code
- `src/` : `style.css`, `index.html` (gabarit) et les scripts JS numérotés de `1-core` à `8-gestures`, concaténés dans un seul bloc.
- `python3 build.py` produit `dist/` (index.html, sw.js, manifest, icônes PNG générées sans dépendance).
- Modèle de données (schéma v2, `migrate()` convertit le v1) :
  - `flows` : `hist[{from, amount, pause, employer, freq, month}]`. Chaque entrée s'applique à partir de son mois : changer un montant, la part employeur ou la fréquence ne réécrit jamais les mois passés. `end` pour un flux résilié.
  - `oneoffs`, `goals` (`moves`), `debts` (`moves`), `contracts` (`files` dans IndexedDB).
  - `placements` : `plan` (versement prévu par mois) et `ops`. Les opérations sont lues dans l'ordre chronologique ; dans un mois, la valorisation passe en dernier (valeur de fin de mois). La valeur saisie à la création est datée du mois précédent et sert de base : ce n'est pas une plus-value.
  - `months[ym] = {closed, balance}` : clôture et solde réel saisi. `monthGap()` = variation réelle du solde − variation prévue.
- Un flux présent dans un mois clôturé n'est pas supprimé sans confirmation : l'app propose de le résilier.
- Toutes les clôtures en retard sont proposées, de la plus ancienne à la plus récente (`pendingClosings()`).
- Point solde (écran Mois, mois courant) : l'utilisateur tape son solde (`balances[{date, t, amount}]`). `pulse()` = solde + tout ce qui doit encore passer entre la date du solde et la prochaine paie (`nextPayday()` : plus gros revenu ayant un jour de paiement) : occurrences datées des flux (`flow.day`), grosses dépenses prévues, épargne prévue du mois pas encore faite. Charges sans jour : comptées par prudence ; revenus sans jour : ignorés. Résultat : libre et marge par jour.
- « Je peux me le permettre ? » : `afford(montant)` → marge par jour avant/après, reste à vivre avant/après, retard estimé des objectifs si c'est pris sur l'épargne. « Je l'achète » : grosse dépense du jour si ≥ seuil, et baisse du solde enregistré quand le point solde ne la compterait pas déjà.
- Rappel « Point solde STM » chaque dimanche (12 semaines, réglable). La clôture propose le dernier solde saisi entre le 24 du mois et le 3 du suivant.
- Prix en heures de travail : `hourlyRate()` = revenus de la catégorie « Salaire » du mois (sinon le plus gros revenu) ÷ heures payées par mois (réglage, 151,67 h par défaut). Une journée = 7 h. Affiché dans « Je peux ? » et dans le bilan.
- Jours d'avance : solde ÷ dépense moyenne par jour (3 derniers mois clôturés : charges + dépenses non suivies ; sinon charges prévues du mois). Sur la carte du point solde, avec l'évolution depuis le point d'un autre jour.
- Bilan d'alternance (`yearReview(start)`, diapos plein écran, ton « Gentiment » ou « Sans pitié », textes écrits à l'avance, pas d'IA) : revenus, mois le plus cher, plus gros achat, abonnements en heures de travail, épargne et objectifs atteints, dépenses non suivies, jours d'avance, « Je peux ? » (`affordLog`, renoncements compris). Proposé sur l'écran Mois en août et en septembre (`reviewSeen`), toujours accessible depuis Année > Bilan, et annoncé dans le Calendrier le dernier jour de l'année.
- Code PIN : rideau contre les regards, pas un chiffrement. 5 essais libres puis une attente qui double. Le code n'est jamais exporté dans les sauvegardes ; un import garde le code de l'appareil.
- PDF et sauvegardes passent par `shareOrDownload` (feuille de partage iOS), pas par des liens `data:` ou blob.
- Calendrier : une web app n'a pas accès au Calendrier d'iOS. `calendarURL()` ouvre `shortcuts://run-shortcut?name=STM Calendrier&input=text&text=<JSON>` avec `{app, v:2, events:[{days, hour, title, notes, alert}]}`. Chaque rappel est un événement de 30 min à `hour` h, `days` jours après aujourd'hui (aucun texte de date à interpréter) ; `alert` = `event` (à l'heure), `day` (la veille) ou `week` (7 jours avant). Pas d'événements « journée entière » : leurs alertes sonnent à minuit. Le raccourci vide les événements à venir du calendrier « STM » et les recrée (mode d'emploi dans l'app : Réglages > Calendrier). `CAL_SHORTCUT_V` change quand le raccourci doit être refait : l'app le signale.
- Rappels : préavis, fins d'engagement, échéances de flux, clôture le 1er de chaque mois, et rappels optionnels de prélèvement ou de versement (`flow.day` + `flow.remind = {on, alert}`, une occurrence par paiement sur 12 mois, en suivant pauses, fréquence et montants datés) et de grosse dépense (`oneoff.remind = {on, alert}`). Heure des rappels réglable. Horizon 400 jours.
- Synchro automatique quand la signature des rappels (`calSig`) change : enregistrement d'un contrat, d'un flux ou d'une dépense, clôture, nouveau mois, heure modifiée. Les réglages du calendrier (`CAL_DEVICE_KEYS`) sont propres à l'appareil : ni exportés, ni écrasés par un import.

## Mouvement (v1.6)
Règle : rien n'apparaît sans venir du geste qui l'a provoqué. On ne perd jamais le fil.
- `src/7-fx.js` : moteur. `setOrigin()` retient l'élément touché (clic sur `[data-act]`). `openSheet` fait sortir la feuille de cet élément (container transform) ; `closeSheet` la renvoie dans l'élément de même clé après le nouveau rendu, sinon vers le bas. L'arrière-plan recule (`html.receded`, `--rp`) et suit le doigt quand on glisse la feuille.
- Glisser une feuille : depuis la poignée, l'en-tête, ou le contenu quand il est en haut. Lancer rapide = fermeture à la vitesse du doigt. Élastique vers le haut.
- `withSwap(dir, scopes, mutate)` : l'ancien contenu (copie inerte `.fx-ghost`) part, le nouveau arrive dans le sens du geste. Utilisé pour les onglets (ordre des onglets), segments du Flux, mois, années, étapes de clôture (`setSheetBody(sh, html, dir)`).
- `render(false)` et `setSheetBody` sans direction : FLIP. Ce qui reste se déplace, ce qui arrive s'ouvre, ce qui a changé (même clé, HTML différent) s'éclaire. Clés : `data-k`, `data-type` + `data-id`, titres de section, notes.
- Odomètre : `odoHTML(n, {id})` ; un odomètre nommé roule depuis sa dernière valeur affichée (`odoMem`). `odoSet(el, n)` met à jour en place (scrub, saisie).
- `src/8-gestures.js` : courbe « Jusqu'à la paie » (`projection(p)` : solde jour par jour, charges sans jour comptées au départ ; pointillés = en dépensant la marge par jour, arrive à 0 le jour de la paie), scrub au doigt (un scrub n'ouvre pas la fiche), carte « Reste à vivre » qui suit le doigt et change de mois, « Je l'achète » à maintenir 0,9 s, lignes balayables dans Flux (pause/reprise, résiliation), grand titre qui se replie dans une barre, confettis quand un objectif est atteint (depuis le bouton qui l'a fait atteindre, jamais à l'ouverture d'un écran ni à un import).
- `prefers-reduced-motion` coupe tout : les états changent sans animation.
- Inspirations, réécrites sans dépendance : Vaul (feuilles), NumberFlow (odomètre), auto-animate (FLIP), Material container transform, Robinhood (scrub), Mail d'iOS (balayage).
- Haptique non utilisée : l'astuce `<input switch>` ne marche plus depuis iOS 26.5.

## Tests
- `node test/unit.js` : calculs (placements, flux datés, clôtures, écart réel, migration). Aucune dépendance.
- `python3 build.py && python3 test/run.py` : parcours complet (dont courbe, scrub et « Je l'achète » maintenu) avec Playwright en 402×874, avec des données fictives générées à chaque lancement. Échoue si une vérification rate ou si la page logue une erreur. Navigateur : celui de Playwright, ou `CHROME=/chemin/vers/chrome`.

## Reste à vérifier sur un vrai iPhone
- Ouverture de Raccourcis depuis l'app installée, accès au Calendrier, confirmation de suppression.
- Ouverture et enregistrement des PDF depuis la feuille de partage.
- Partage du fichier de sauvegarde.
- Icône sur l'écran d'accueil.
