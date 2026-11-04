# Poste de bureau Aures (`/bureau`)

Application de bureau pour les équipes internes, à côté du Desk. Le premier module sert au back office (rôle `Administrateur Ventes`).
Cahier des charges de la V1 et maquette : voir les liens transmis au projet.

## Lot 1 (livré) : lecture
- **Liste de travail** : recherche, filtres combinables, vues avec compteurs, tri par urgence puis échéance.
- **Ticket** : en-tête, étape active, demande du commercial, urgence à décider, créance, rapprochement et liste de contrôle, en lecture seule.
- **Colonne de droite** : timeline, documents (ouverts dans une nouvelle fenêtre), cycle du dossier (ouvert sur le Desk).
- **Accès** : `Administrateur Ventes`, `System Manager`, `Administrator`. Les autres comptes reçoivent un refus, dans la page comme dans l'API.

## Lot 2 (livré) : traitement
- **Workflow** : Démarrer, Mettre en pause, Reprendre, Débloquer, Terminer, Annuler. Le serveur dit quelles actions sont permises ; le blocage créance passe par la carte Créance, qui exige un motif.
- **Décisions** : urgence (niveau accordé, commentaire obligatoire pour refuser), créance, rapprochement avec commentaire, liste de contrôle, attribution.
- **Fichiers** : ajout de fichiers privés au ticket ; chacun peut retirer ce qu'il a joint, tant que le ticket est ouvert.
- **Temps réel** : l'événement `aures_bureau_update` (`aurescrm/bureau_events.py`) ne porte que des identifiants ; la file et le ticket ouvert se rechargent.
- **Conflits** : chaque action envoie la date `modified` affichée. Si le ticket a changé entre-temps, l'action est refusée et l'écran se recharge, sans perdre la saisie.

Les créations (demande de faisabilité, dossier essai à blanc, commande, article) restent sur le Desk jusqu'aux lots 3 et 4, comme « Nouveau ticket ».

## Liste, aperçu et fiche

- **Liste** (`/bureau`) : tableau pleine largeur, trié par urgence puis échéance, ou par la colonne choisie. Vues, recherche et filtres combinables en haut. L'étape de chaque ligne vient de `compute_steps` ; `_queue_documents` lit les cycles en une seule fois, et un test vérifie que la liste et la fiche donnent la même étape.
- **Aperçu** (`/bureau?apercu=TC-…`) : tiroir à droite, par-dessus la liste, sans fond grisé. La liste reste cliquable pour changer de ticket. Un double clic sur une ligne ouvre directement la fiche.
- **Fiche** (`/bureau/ticket/TC-…`) : pleine page, avec retour à la liste et passage au ticket voisin de la vue affichée. Depuis l'aperçu, cliquer sur une étape ouvre la fiche à cette étape (`?etape=`).
- La liste reste montée pendant qu'une fiche est ouverte : sa sélection et son défilement sont conservés.

## Pagination et tri

- `get_queue` lit toute la vue avec peu de colonnes, la trie côté serveur, puis calcule les étapes de la seule page demandée. Il renvoie aussi le total et `names`, l'ordre de toute la vue, pour aller au ticket voisin depuis la fiche.
- **Tailles** : 20 (par défaut), 100 ou 500 lignes par page. Le choix reste sur l'appareil, et la vue et la page restent dans l'adresse (`?vue=mine&page=3`).
- **Tri** : par colonne, ou urgence puis échéance par défaut. L'étape ne trie pas : elle se calcule ligne par ligne. Les lignes sans valeur restent à la fin dans les deux sens.
- **Sélection** : la case de tête coche la page affichée. Changer de page, de vue ou de taille vide la sélection.
- **Colonnes** : Commercial et Créance s'ajoutent par le menu Colonnes. **Exporter** écrit en CSV toute la vue avec les colonnes affichées, au format d'Excel en français.

## Commentaires et activité

- Le fil (`shared/components/ActivityFeed.vue`, `aurescrm/api/activity.py`) lit `Comment`, `Version` et `Communication`, les mêmes sources que la timeline du Desk. Un commentaire écrit ici se lit sur le Desk, et inversement.
- `@` mentionne une personne au format du Desk, qui lui envoie sa notification. Chacun modifie et supprime ses seuls commentaires.
- **Le texte seul est affiché** : aucun HTML ne quitte le serveur. Une image ou une mise en forme écrite sur le Desk ne s'affiche donc pas ici.
- Les champs masqués du formulaire n'apparaissent pas dans l'historique, sauf ceux de `SHOWN_HIDDEN_FIELDS` (le statut).

## Actions groupées

- Les cases à cocher sélectionnent des tickets de la vue affichée. Une ligne cachée par un filtre ou une recherche n'est jamais touchée, et changer de vue vide la sélection.
- **Actions** : attribuer (`bulk_assign`), Démarrer et Mettre en pause (`bulk_action`). Terminer, Annuler et la créance restent ticket par ticket : ils dépendent d'une liste de contrôle ou d'un motif, ou sont difficiles à défaire.
- **Au plus 100 tickets par action.** Chacun est traité et validé à part avec sa date `modified` : un refus n'empêche pas les autres, et l'écran liste les tickets non traités avec leur raison.

## Disposition et densité

- Sur ordinateur, la page ne défile pas : la liste et le détail du ticket ont chacun leur défilement, et l'en-tête du ticket reste visible. En dessous de 900 px de large, la page reprend le défilement et l'aperçu prend tout l'écran.
- Les tailles viennent de la densité Poste (`data-density="poste"` dans `bureau/index.html`, valeurs dans `shared/tokens.css`) : texte courant de 13 px, boutons et champs de 32 px (variable `--ctl`, 44 px sur écran tactile). Voir `docs/STYLE_AURES.md`.
- Le thème suit celui de l'appareil. Le menu du compte force clair ou sombre, sous la clé `bureau-theme`.
- **Coquille** (`shared/components/AppShell.vue`) : barre du haut et menu de gauche. Le menu démarre replié sous 1 440 px de large, pour laisser la place au tableau, et garde ensuite le choix de l'utilisateur (clé `bureau-menu`). Sur téléphone, il devient une barre en bas de l'écran.
- **Menu** : les entrées sans écran dans le poste de bureau (Commandes, Devis, Créances, Clients, Articles) ouvrent le Desk dans une nouvelle fenêtre.
- **Recherche globale** (`Ctrl K`) : tickets ouverts et clos, par client ou numéro, avec `get_queue`.
- Une classe dont le nom est composé à l'exécution (`urgence-${niveau}`) doit figurer dans `safelist`, sinon le build la retire.

## Organisation du code
| Élément | Emplacement |
| --- | --- |
| Application Vue | `bureau/` |
| Socle partagé avec la PWA commerciale | `shared/` |
| Page et informations de démarrage | `aurescrm/www/bureau.py` |
| API et calcul des étapes | `aurescrm/api/bureau.py` |
| Temps réel | `aurescrm/bureau_events.py` |
| Tests serveur | `aurescrm/tests/test_bureau.py` |

Les étapes de la timeline se calculent dans une seule fonction : `compute_steps`.

## Construire et tester
```bash
yarn install
bench build --app aurescrm
bench --site aurescrm.intrapro.net run-tests --module aurescrm.tests.test_bureau
```
```bash
cd bureau && yarn test && yarn typecheck
```

`aurescrm/public/bureau/` et `aurescrm/www/bureau.html` sont générés et ne sont pas commités.
