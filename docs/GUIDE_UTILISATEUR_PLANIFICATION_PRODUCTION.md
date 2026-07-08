# Procédure - Planification de la production (BROUILLON)

> Document de travail, non validé. À relire et ajuster avant diffusion à l'équipe.
> Prérequis techniques à finaliser avant mise en route : voir section "Avant de démarrer".

## Objectif

Permettre à l'équipe planification de programmer la production (presses offset) directement dans l'ERP, à partir des `Dossier Fabrication` générés automatiquement à la commande client, en remplacement progressif du suivi papier / Excel.

Ce document couvre uniquement l'étape de **programmation** (affecter une machine et une date à chaque article commandé). Le suivi d'exécution en atelier n'est pas encore couvert par ce document et reste géré comme aujourd'hui.

## Avant de démarrer (prérequis, à valider avant le premier dossier réel)

- [ ] Les presses offset sont créées dans `Machine` (nom, couleurs, vernis, cadence).
- [ ] Un rôle "Planification" existe et est attribué aux membres de l'équipe, avec accès au `Dossier Fabrication` et à la page `Planning Production`.
- [ ] Un dossier réel a été programmé et validé en test par un membre de l'équipe accompagné.

Tant que ces trois points ne sont pas cochés, continuez avec le suivi actuel.

## D'où viennent les dossiers à programmer

Un `Dossier Fabrication` est créé automatiquement dès qu'une commande client est validée (soumise) dans l'ERP. Vous n'avez rien à créer : votre travail commence à la réception du dossier.

Pour retrouver les dossiers en attente de programmation :

1. Ouvrez la liste `Dossier Fabrication`.
2. Filtrez sur `Statut = Ouvert` ou `Programmation en cours`.

Chaque dossier correspond à une commande client. Chaque ligne du programme de livraison correspond à un article à produire, avec une quantité et une date de livraison attendue.

### Comprendre le statut du dossier

Le statut (`Statut`) est calculé automatiquement, vous n'avez rien à choisir manuellement :

- **Ouvert** : rien n'est encore programmé.
- **Programmation en cours** : une partie des articles/quantités est programmée, mais pas tout.
- **Programmation complète** : toutes les quantités de tous les articles sont programmées — le dossier est prêt à être validé.
- **Planification validée** : la planification a été validée (bouton `Valider la planification`), les études techniques sont générées, le programme est verrouillé.
- **Clôturé** : dossier terminé (action manuelle, une fois la production livrée).

**Règle importante** : le bouton `Valider la planification` reste bloqué tant que la quantité commandée de chaque article n'est pas intégralement répartie dans le programme de livraison. Un message indique précisément quel article et quelle quantité manquent.

## Programmer un dossier

1. Ouvrez le `Dossier Fabrication`.
2. Dans le tableau "Programme livraison", pour chaque ligne :
   - vérifiez l'article, la quantité et la date de livraison (déjà remplis) ;
   - renseignez le champ `Machine` (presse) ;
   - renseignez le champ `Date de fabrication prévue`.
3. En cas d'hésitation sur la machine à choisir, utilisez l'aide au choix (voir ci-dessous).
4. Une fois toutes les lignes renseignées, cliquez sur `Valider la planification`.

**Attention** : une fois la planification validée, les lignes sont verrouillées et ne peuvent plus être modifiées depuis le dossier. Pour un changement après validation, utilisez la page `Planning Production` (voir plus bas).

### Si une ligne ne peut pas être programmée

- Machine ou date manquante : impossible de valider tant que ces deux champs ne sont pas remplis sur chaque ligne.
- Trace ou imposition absente : contactez l'équipe étude de faisabilité, la ligne ne peut pas être programmée sans ces informations.

## Choisir la bonne machine

Pour vous aider, l'ERP peut recommander une presse en fonction de l'article et de la date visée : elle propose la machine qui demande le moins de passages pour cet article, en tenant compte de la charge déjà programmée ce jour-là. Utilisez cette recommandation comme point de départ, pas comme une obligation - vous restez décisionnaire.

## Suivre et ajuster le programme : la page Planning Production

Une fois des dossiers programmés, la page `Planning Production` affiche une grille avec :

- en colonnes : les presses offset,
- en lignes : les dates (jour, semaine ou mois selon l'affichage choisi),
- dans chaque case : les articles programmés ce jour sur cette machine, avec une indication de charge (quantité de feuilles × nombre de passages).

Cette vue sert à :

- visualiser la charge de chaque presse sur les prochains jours/semaines,
- repérer les jours surchargés ou les machines sous-utilisées,
- replanifier un article (changer de machine ou de date) directement depuis la grille, y compris après validation du dossier.

## Ce qui reste hors de ce document (pour l'instant)

- Le suivi de fabrication en atelier (démarrage/fin de production, contrôle qualité, rebuts) : géré comme aujourd'hui.
- Les articles flexo et les opérations de finition (vernis, dorure, découpe, etc.) : pas encore couverts par la page Planning Production, restent gérés comme aujourd'hui.

## Questions / blocages

En cas de doute sur une ligne ou un blocage technique, contactez : _à compléter_.
