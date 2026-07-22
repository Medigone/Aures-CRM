# Méthode fonctionnelle de calcul du devis

## Objectif
Ce document explique comment les montants du `Calcul Devis` sont obtenus.

Il permet :

- de comprendre les totaux affichés ;
- de contrôler un calcul ;
- de choisir la bonne unité pour un poste de production ;
- d'identifier l'origine d'un écart.

Cette méthode repose sur quatre éléments :

1. la quantité commandée et l'imposition ;
2. la gâche par poste de production ;
3. le coût du papier ;
4. les postes de production saisis manuellement.

## Vue d'ensemble
Le coût total est composé de :

```text
Coût total =
  Coût support total
  + Total coûts fixes
  + Total coûts variables
```

Le coût total est ensuite ramené à l'unité, puis la marge est appliquée pour obtenir le prix proposé.

## 1. Calcul du nombre de feuilles

### Quantité de feuilles nécessaires
La quantité commandée est divisée par le nombre de poses de l'imposition.

```text
Quantité feuilles =
  Quantité commandée ÷ Nombre de poses
```

Le résultat est toujours arrondi à la feuille entière supérieure.

Exemple :

```text
1 003 unités ÷ 4 poses = 250,75
Quantité feuilles retenue = 251 feuilles
```

Si le nombre de poses est vide ou égal à zéro, le calcul utilise une pose afin d'éviter une division impossible.

### Feuilles avec gâche
La gâche est saisie **par poste de production**, en nombre de feuilles (calage typique de l'étape). Elle n'est pas multipliée par le nombre de passages.

```text
Total gâche (feuilles) =
  Σ Gâche (feuilles) de chaque poste

Feuilles avec gâche =
  Quantité feuilles + Total gâche
```

Exemple :

```text
250 feuilles nettes
+ 50 (impression) + 20 (vernis) + 30 (découpe)
= 350 feuilles avec gâche
```

La valeur de référence peut être préremplie depuis le `Bareme Cout Fixe` (`Gâche (feuilles)`), puis ajustée sur la ligne poste.

### Différence avec le taux de chutes
Le Calcul Devis peut afficher :

- `Taux de Chutes (Imposition)` : information provenant de l'imposition (non utilisée dans le coût) ;
- `Total Gâche (feuilles)` / `Feuilles avec Gâche` : résultats du calcul issus des postes.

Seul le total des gâches des postes intervient dans le coût du devis.

## 2. Calcul du coût du support

### Surface d'une feuille
La surface est calculée à partir du format d'impression exprimé en millimètres.

```text
Surface feuille en m² =
  Largeur en mm × Hauteur en mm ÷ 1 000 000
```

Exemple :

```text
Format 500 × 400 mm
Surface = 500 × 400 ÷ 1 000 000
Surface = 0,20 m²
```

### Poids d'une feuille
Le poids dépend de la surface et du grammage.

```text
Poids feuille en grammes =
  Surface feuille en m² × Grammage en g/m²
```

Exemple :

```text
0,20 m² × 100 g/m² = 20 g par feuille
```

### Coût du support par feuille
Le poids est converti en kilogrammes puis multiplié par le coût du support au kilogramme.

```text
Coût support par feuille =
  Poids feuille en grammes ÷ 1 000 × Coût support par kg
```

Exemple :

```text
20 g ÷ 1 000 × 2 par kg = 0,04 par feuille
```

### Coût support total
Le coût par feuille est appliqué au nombre de feuilles avec gâche.

```text
Coût support total =
  Coût support par feuille × Feuilles avec gâche
```

Le coût du support n'est pas multiplié par le nombre de passages des postes de production.

## 3. Calcul des postes de production
Chaque ligne de `Postes de Production` peut comporter :

- un coût fixe ;
- un coût variable ;
- un nombre de passages.

Le nombre de passages multiplie le coût fixe et le coût variable de la ligne.

### Coût fixe d'un poste

```text
Coût fixe du poste =
  Coût fixe saisi × Nombre de passages
```

Exemple :

```text
Calage à 150 avec 2 passages
= 150 × 2
= 300
```

Le `Total Coûts Fixes` est la somme des coûts fixes de tous les postes.

## 4. Calcul du coût variable selon l'unité

### Unité « Par feuille »
Le coût est appliqué à toutes les feuilles avec gâche et à tous les passages.

```text
Coût variable du poste =
  Coût variable unitaire
  × Nombre de passages
  × Feuilles avec gâche
```

Exemple :

```text
0,05 par feuille × 2 passages × 275 feuilles
= 27,50
```

### Unité « Par 1000 unités »
Le coût est appliqué à la quantité commandée, exprimée en milliers.

```text
Coût variable du poste =
  Coût variable unitaire
  × Nombre de passages
  × (Quantité commandée ÷ 1 000)
```

Exemple :

```text
30 par 1 000 × 1 passage × (5 000 ÷ 1 000)
= 30 × 5
= 150
```

Cette unité utilise la quantité commandée. Elle n'utilise ni le nombre de feuilles ni la gâche.

### Unité « Forfait »
Le forfait est appliqué une fois pour chaque passage.

```text
Coût variable du poste =
  Coût variable unitaire × Nombre de passages
```

Exemple :

```text
Forfait de 25 × 3 passages = 75
```

Le `Total Coûts Variables` est la somme des coûts variables de tous les postes, quelle que soit leur unité.

## 5. Calcul du coût total et du coût unitaire

### Coût total

```text
Coût total =
  Coût support total
  + Total coûts fixes
  + Total coûts variables
```

### Coût unitaire

```text
Coût unitaire =
  Coût total ÷ Quantité commandée
```

Si la quantité commandée est nulle, le coût unitaire reste à zéro.

## 6. Calcul du prix proposé

### Prix unitaire proposé

```text
Prix unitaire proposé =
  Coût unitaire × (1 + Marge ÷ 100)
```

Exemple :

```text
Coût unitaire de 10 avec une marge de 20 %
= 10 × 1,20
= 12
```

La marge est une majoration appliquée au coût. Elle ne représente pas un taux de marge calculé sur le prix de vente.

### Prix total proposé

```text
Prix total proposé =
  Prix unitaire proposé × Quantité commandée
```

Le prix unitaire et le prix total proposés sont une **référence calculée**. Ils ne sont pas modifiés manuellement.

## 6 bis. Prix proposé final et marges commerciales

Le chargé de devis peut saisir un `Prix proposé final` indépendant de la référence.

### Prix total final

```text
Prix total final =
  Prix proposé final × Quantité commandée
```

### Marge commerciale sur coût (%)

```text
Marge commerciale sur coût =
  (Prix proposé final − Coût unitaire) ÷ Coût unitaire × 100
```

### Marge commerciale sur prix (%)

```text
Marge commerciale sur prix =
  (Prix proposé final − Coût unitaire) ÷ Prix proposé final × 100
```

Si le prix proposé final est vide ou nul, ou si le coût unitaire est nul, les deux marges restent à zéro.

Le recalcul des coûts ou de la marge de référence ne remplit ni n'écrase jamais le `Prix proposé final`.

## 7. Exemple complet

### Données de départ
- Quantité commandée : `1 000`
- Nombre de poses : `4`
- Format d'impression : `500 × 400 mm`
- Grammage : `100 g/m²`
- Coût support : `2 par kg`
- Marge : `20 %`

### Postes de production

**Impression offset**

- Nombre de passages : `2`
- Coût fixe : `100`
- Gâche : `50` feuilles
- Unité : `Par feuille`
- Coût variable unitaire : `0,05`

**Vernis sérigraphique**

- Nombre de passages : `1`
- Coût fixe : `50`
- Gâche : `20` feuilles
- Unité : `Par 1000 unités`
- Coût variable unitaire : `30`

**Découpe**

- Nombre de passages : `3`
- Coût fixe : `0`
- Gâche : `30` feuilles
- Unité : `Forfait`
- Coût variable unitaire : `25`

### Étape 1 - Feuilles

```text
Quantité feuilles = 1 000 ÷ 4 = 250
Total gâche = 50 + 20 + 30 = 100
Feuilles avec gâche = 250 + 100 = 350
```

### Étape 2 - Support

```text
Surface feuille = 500 × 400 ÷ 1 000 000 = 0,20 m²
Poids feuille = 0,20 × 100 = 20 g
Coût par feuille = 20 ÷ 1 000 × 2 = 0,04
Coût support total = 0,04 × 350 = 14
```

### Étape 3 - Coûts fixes

```text
Impression = 100 × 2 = 200
Vernis = 50 × 1 = 50
Découpe = 0

Total coûts fixes = 250
```

### Étape 4 - Coûts variables

```text
Impression = 0,05 × 2 × 350 = 35
Vernis = 30 × 1 × (1 000 ÷ 1 000) = 30
Découpe = 25 × 3 = 75

Total coûts variables = 140
```

### Étape 5 - Totaux

```text
Coût total = 14 + 250 + 140 = 404
Coût unitaire = 404 ÷ 1 000 = 0,404
Prix unitaire proposé = 0,404 × 1,20 = 0,4848
Prix total proposé = 0,4848 × 1 000 = 484,80
```

## 8. Règles d'arrondi
- Les quantités de feuilles nettes sont toujours arrondies à l'entier supérieur.
- La gâche par poste est un nombre entier de feuilles (sans arrondi supplémentaire sur le total).
- Les coûts sont calculés avec leur précision disponible.
- L'affichage monétaire peut présenter moins de décimales que le calcul unitaire.

Pour contrôler un écart de quelques centimes, vérifiez le coût unitaire détaillé avant de recalculer à partir des montants arrondis affichés.

## 9. Points qui ne sont pas automatiques
La méthode actuelle ne réalise pas automatiquement les actions suivantes :

- choisir les étapes selon les finitions de l'article ;
- synchroniser un devis existant après modification d'un barème ou d'un modèle ;
- récupérer un tarif depuis la machine sélectionnée ;
- calculer le nombre de passages à partir de la machine ;
- appliquer une cascade de gâche par ordre d'étapes (la gâche est additive et globale).

Le dialogue d'ajout de poste préremplit les coûts et la gâche depuis le `Bareme Cout Fixe` sélectionné ; les valeurs restent ensuite figées sur la ligne.

Le bouton `Ajouter depuis un modèle` applique un `Modele Postes Devis` choisi manuellement. Il ajoute uniquement les barèmes manquants et conserve les postes déjà saisis. Les montants copiés restent figés sur le Calcul Devis.

## 10. Contrôle fonctionnel avant validation
Avant de soumettre le Calcul Devis, vérifiez :

1. la quantité commandée ;
2. le nombre de poses ;
3. la gâche (feuilles) de chaque poste et le total ;
4. le format et le grammage ;
5. le coût support au kilogramme ;
6. la présence de toutes les étapes de production ;
7. le nombre de passages par étape ;
8. l'unité de chaque coût variable ;
9. l'absence de double comptage entre coût fixe et forfait ;
10. la marge appliquée.

Pour le mode opératoire, consultez :

- `docs/GUIDE_UTILISATEUR_CALCUL_DEVIS.md`
- `docs/GUIDE_UTILISATEUR_BAREME_COUT_FIXE.md`
