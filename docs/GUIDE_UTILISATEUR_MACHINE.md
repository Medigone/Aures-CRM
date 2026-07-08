# Guide d'utilisation - Machine

## Objectif
Le `Machine` centralise le référentiel des équipements de production (presses, plieuses, colleuses, massicots, machines de découpe...). Il est utilisé par l'Étude Technique, le Dossier Fabrication et le Planning Production pour calculer le nombre de passages presse et visualiser la charge par machine.

Ce guide est volontairement simple et non technique.

## Quand créer une fiche machine
Créez une fiche pour chaque équipement physique de l'atelier qui doit apparaître dans les calculs de passages et/ou dans le planning de production.

Priorité : les presses offset, car elles sont indispensables au fonctionnement du Planning Production.

## Accéder au module
Vous pouvez ouvrir `Machine` :

- depuis le module `Aures CRM`
- depuis la recherche globale
- depuis la liste des machines déjà existantes

## Créer une machine
1. Ouvrez la liste `Machine`.
2. Cliquez sur `Nouveau`.
3. Renseignez l'identification (`Nom`, `Type d'équipement`).
4. Si la machine est une presse offset, complétez l'onglet `Paramètres Presse`.
5. Complétez les paramètres de production communs.
6. Sauvegardez.

## Les champs importants

### Identification
- `Nom` (obligatoire, unique) : identifiant affiché partout (planning, étude technique, dossier fabrication).
- `Type d'équipement` (obligatoire) : `Presse Offset`, `Plieuse`, `Colleuse`, `Massicot`, `Machine Découpe`, `Autre`.

  Seules les machines `Presse Offset` avec `Procédé = Offset` apparaissent dans le Planning Production et sont proposées comme presse dans l'étude technique / le dossier fabrication.
- `Marque`, `Modèle`
- `Site de Production`, `Atelier`

### Onglet "Paramètres Presse" (uniquement si Type d'équipement = Presse Offset)
- `Procédé` : `Offset` / `Flexo` / `Autre` — doit être `Offset` pour que la machine apparaisse dans le planning production offset.
- `Type de presse` : `Feuille` / `Rotative`.
- `Retiration` : à cocher si la machine imprime recto-verso en un seul passage.
- `Nb couleurs recto` / `Nb couleurs verso`, `Total couleurs` (calculé automatiquement) : sert à calculer le nombre de passages nécessaires par article.
- `Gâche calage (feuilles)`.
- `Format d'impression` : laize et développement, min et max.

### Section "Paramètres de Production" (tous types de machine)
- `Vitesse max (unités/heure)`
- `Temps total calage (minutes)`
- `Coût horaire calage` / `Coût horaire roulage`
- `Quantité Minimale (Feuilles)`
- `Vernis` : à cocher si la machine dispose d'une tour vernis — intervient aussi dans le calcul du nombre de passages.

### Statut Machine
`Operationnelle` / `En Maintenance` / `En Panne` / `Hors Service` / `Désactivé`.

Ce champ doit être tenu à jour : une machine non `Operationnelle` reste visible dans le planning mais son statut est affiché en couleur pour alerter la personne qui planifie.

## Où sont utilisées ces données
- **Étude Faisabilité / Étude Technique / Dossier Fabrication** : le champ `Machine` choisi détermine le calcul automatique du nombre de passages (à partir de `Total couleurs` et `Vernis`).
- **Planning Production** : seules les machines `Presse Offset` + `Procédé = Offset` apparaissent en colonnes de la grille de charge.

## Bonnes pratiques
- Pas de doublon : le `Nom` doit être unique, réutilisez toujours la même fiche pour une même machine physique.
- Renseignez systématiquement `Total couleurs` et `Vernis` pour chaque presse offset : sans ces informations, le nombre de passages ne peut pas être calculé automatiquement pour cette machine.
- Mettez à jour le `Statut` dès qu'une machine tombe en panne ou part en maintenance, pour que la planification en tienne compte.

## Questions / blocages
En cas de doute sur une fiche machine ou un paramètre technique, contactez : _à compléter_.
