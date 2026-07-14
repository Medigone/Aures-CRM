# Guide d'utilisation - Machine

## Objectif
Le `Machine` centralise le référentiel des équipements de production (presses, plieuses, colleuses, massicots, machines de découpe...). Il est utilisé par l'Étude Technique, le Dossier Fabrication et le Planning Production pour calculer le nombre de passages presse et visualiser la charge par machine.

Il porte aussi les **paramètres économiques** nécessaires pour estimer le coût d'un job (référentiel) — sans calcul automatique dans le devis pour l'instant.

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
3. Renseignez l'identification (`Nom`, `Type d'équipement`) et le `Statut Machine`.
4. Complétez les **Paramètres de devis** (méthode, coûts, effectif).
5. Si la machine est une presse offset, complétez l'onglet `Paramètres Presse`.
6. Sauvegardez.

## Les champs importants

### Identification
- `Statut Machine` : `Operationnelle` / `En Maintenance` / `En Panne` / `Hors Service` / `Désactivé`. Visible sur la fiche et en liste. Une machine non opérationnelle reste visible dans le planning, avec un statut coloré.
- `Nom` (obligatoire, unique) : identifiant affiché partout (planning, étude technique, dossier fabrication).
- `Type d'équipement` (obligatoire) : `Presse Offset`, `Plieuse`, `Colleuse`, `Massicot`, `Machine Découpe`, `Autre`.

  Seules les machines `Presse Offset` avec `Procédé = Offset` apparaissent dans le Planning Production et sont proposées comme presse dans l'étude technique / le dossier fabrication.
- `Marque`, `Modèle`
- `Site de Production`, `Atelier`

### Paramètres de Production
- `Vitesse maximale constructeur (unités/heure)` : information technique constructeur. **Ne pas l'utiliser pour le chiffrage.**

### Paramètres de devis (tous types)
- `Utilisable pour les devis` : à cocher quand les paramètres de coût sont prêts à être utilisés.
- `Méthode de calcul devis` :
  - **Forfait + coût par 1000** (recommandé en V1) : frais fixes de lancement + coût par 1 000 unités.
  - **Temps × coût horaire** : méthode avancée (calage + roulage).
- `Unité de production` : `Feuille`, `Unité`, `Mètre linéaire`, `Mètre carré`, `Kilogramme`, `Heure`.
- `Frais fixes de lancement` / `Coût par 1 000 unités` : visibles si méthode = forfait.
- `Vitesse standard devis (unités/heure)` : vitesse **réaliste** pour le chiffrage (souvent inférieure à la vitesse constructeur).
- `Quantité minimale facturable` : plancher économique, dans l'unité de production.
- `Nombre d'opérateurs` : effectif typique. La comptabilité calcule le coût MO : `effectif × taux horaire MO × heures`.
- `Date de révision des paramètres` : quand les coûts ont été revus.

#### Formule forfait (estimation manuelle)
```text
Quantité avec gâche =
  Quantité nette
  + Gâche calage                    (presses)
  + Quantité nette × Taux gâche %

Quantité facturée = max(Quantité avec gâche, Quantité minimale facturable)

Coût machine =
  Frais fixes de lancement
  + (Quantité facturée / 1000) × Coût par 1 000
```

#### Formule horaires (méthode avancée)
```text
Coût machine =
  (Temps calage / 60) × Coût horaire machine calage
  + (Quantité facturée / Vitesse standard devis) × Coût horaire machine roulage
```

Les coûts horaires machine sont **hors main-d'œuvre**. La MO se calcule à part via le nombre d'opérateurs.

### Onglet "Paramètres Presse" (uniquement si Type d'équipement = Presse Offset)
- `Procédé` : `Offset` / `Flexo` / `Autre` — doit être `Offset` pour que la machine apparaisse dans le planning production offset.
- `Type de presse` : `Feuille` / `Rotative`.
- `Retiration` : à cocher si la machine imprime recto-verso en un seul passage.
- `Vernis en ligne` : à cocher si la machine dispose d'une tour vernis — intervient dans le calcul du nombre de passages.
- `Nb couleurs recto` / `Nb couleurs verso`, `Total couleurs` (calculé automatiquement) : sert à calculer le nombre de passages nécessaires par article.
- `Gâche calage (feuilles)` : perte fixe au démarrage.
- `Taux de gâche production` : perte proportionnelle au volume.
- `Format d'impression` : laize et développement, min et max (mm).
- `Grammage minimum / maximum (g/m²)` : compatibilité support.
- `Marge de pince (mm)` : zone non imprimable en amont.

## Où sont utilisées ces données
- **Étude Faisabilité / Étude Technique / Dossier Fabrication** : le champ `Machine` choisi détermine le calcul automatique du nombre de passages (à partir de `Total couleurs` et `Vernis en ligne`).
- **Planning Production** : seules les machines `Presse Offset` + `Procédé = Offset` apparaissent en colonnes de la grille de charge.
- **Estimation de coût job** : les paramètres de devis servent de référentiel (chiffrage manuel / comptabilité). Pas encore branchés automatiquement au Calcul Devis.

## Bonnes pratiques
- Pas de doublon : le `Nom` doit être unique, réutilisez toujours la même fiche pour une même machine physique.
- Renseignez systématiquement `Total couleurs` et `Vernis en ligne` pour chaque presse offset : sans ces informations, le nombre de passages ne peut pas être calculé automatiquement pour cette machine.
- Mettez à jour le `Statut` dès qu'une machine tombe en panne ou part en maintenance, pour que la planification en tienne compte.
- Cochez `Utilisable pour les devis` seulement quand forfait / coûts / vitesse devis sont renseignés et validés.
- Preférez la méthode **Forfait + coût par 1000** tant que les taux horaires machine ne sont pas fiables.
- Tenez à jour la `Date de révision des paramètres` à chaque revue des coûts.

## Questions / blocages
En cas de doute sur une fiche machine ou un paramètre technique, contactez : _à compléter_.
