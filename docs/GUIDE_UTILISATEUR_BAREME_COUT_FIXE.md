# Guide d'utilisation - Bareme Cout Fixe

## Objectif
Le `Bareme Cout Fixe` est une bibliothèque de coûts standards utilisée comme aide-mémoire pendant le chiffrage.

Il permet de conserver des références habituelles pour :

- l'impression ;
- les vernis et finitions ;
- le pelliculage ;
- la découpe forme ;
- le prépresse ;
- les autres opérations récurrentes.

Le barème évite de rechercher ou de ressaisir de mémoire les mêmes montants à chaque nouveau devis.

## Principe important
Le barème est indépendant du `Calcul Devis`.

Il n'existe :

- aucun bouton de copie automatique ;
- aucune synchronisation des montants ;
- aucun calcul déclenché par la machine ;
- aucune mise à jour des devis existants lorsqu'un barème change.

L'utilisateur consulte une fiche de barème, puis recopie manuellement les informations utiles dans un poste du Calcul Devis.

## Accéder au barème
Vous pouvez ouvrir `Bareme Cout Fixe` :

- depuis le module `Aures CRM` ;
- depuis la recherche globale ;
- depuis la liste des barèmes existants.

## Créer une référence de barème
1. Ouvrez la liste `Bareme Cout Fixe`.
2. Cliquez sur `Nouveau`.
3. Renseignez un libellé clair.
4. Choisissez une catégorie.
5. Indiquez éventuellement une machine de référence.
6. Renseignez le coût fixe et, si nécessaire, le coût variable.
7. Vérifiez l'unité de calcul.
8. Ajoutez une note si le tarif dépend de conditions particulières.
9. Laissez la référence `Actif` si elle peut être utilisée.
10. Sauvegardez.

## Les champs importants

### Libellé
Nom de la référence.

Exemples :

- `Calage impression offset standard`
- `Pelliculage mat`
- `Découpe forme petit format`
- `Préparation fichiers et BAT`

Le libellé doit permettre de comprendre rapidement à quoi correspond le tarif.

### Catégorie
Permet de classer et de filtrer les références :

- `Impression`
- `Vernis / Finition`
- `Pelliculage`
- `Découpe forme`
- `Prépresse`
- `Autre`

### Machine (référence)
Machine habituellement concernée par ce coût.

Ce champ est facultatif et informatif. Il ne récupère aucun tarif depuis la fiche Machine et ne déclenche aucun calcul.

### Coût fixe
Montant de préparation, de calage ou de lancement appliqué pour un passage.

Exemples :

- calage machine ;
- préparation d'un poste ;
- lancement d'une opération ;
- mise en route d'une sous-traitance.

### Unité de calcul
Indique comment interpréter le `Coût variable unitaire` :

- `Par feuille` : tarif multiplié par le nombre de feuilles avec gâche ;
- `Par 1000 unités` : tarif multiplié par la quantité commandée divisée par 1 000 ;
- `Forfait` : montant appliqué une fois par passage.

### Coût variable unitaire
Montant associé à l'unité de calcul choisie.

Il peut rester à zéro si la référence ne comporte qu'un coût fixe.

### Gâche (feuilles)
Nombre de feuilles de gâche de calage typique pour cette étape.

Cette valeur préremplit le champ `Gâche (feuilles)` du poste dans Calcul Devis. Elle n'est pas multipliée par le nombre de passages. Le chargé de devis peut l'ajuster sur chaque devis.

### Actif
Une référence active est disponible pour les chiffrages courants.

Décochez `Actif` lorsqu'un tarif est obsolète. Il est préférable de désactiver une ancienne référence plutôt que de la supprimer, afin de conserver l'historique.

### Notes
Précisions utiles pour choisir ou adapter le tarif.

Exemples :

- date de révision ;
- fournisseur concerné ;
- formats couverts ;
- quantité minimale ;
- tarif indicatif à confirmer ;
- conditions particulières.

## Utiliser une référence dans un Calcul Devis
1. Ouvrez le Calcul Devis à chiffrer.
2. Identifiez l'étape de production à ajouter.
3. Recherchez la référence correspondante dans `Bareme Cout Fixe`.
4. Vérifiez que la référence est active et adaptée au cas traité.
5. Ajoutez une ligne dans `Postes de Production`.
6. Recopiez manuellement :
   - le libellé ;
   - la machine si elle est pertinente ;
   - le coût fixe ;
   - l'unité de calcul ;
   - le coût variable unitaire.
7. Renseignez le nombre de passages propre au devis.
8. Adaptez le montant si les conditions du devis le nécessitent.

## Exemples de références

### Référence avec coût fixe uniquement
- Libellé : `Calage presse offset`
- Catégorie : `Impression`
- Coût fixe : `150`
- Coût variable unitaire : `0`

Dans le Calcul Devis, un poste avec deux passages produira un coût fixe total de `150 × 2 = 300`.

### Référence avec coût par feuille
- Libellé : `Pelliculage mat standard`
- Catégorie : `Pelliculage`
- Coût fixe : `80`
- Unité : `Par feuille`
- Coût variable unitaire : `0,04`

Le coût fixe couvre le lancement. Le coût variable dépend du nombre de feuilles avec gâche.

### Référence avec coût par 1000 unités
- Libellé : `Conditionnement au mille`
- Catégorie : `Autre`
- Coût fixe : `0`
- Unité : `Par 1000 unités`
- Coût variable unitaire : `25`

Pour une commande de 5 000 unités et un passage, le coût variable sera `25 × 5 = 125`.

### Référence forfaitaire
- Libellé : `Contrôle qualité complémentaire`
- Catégorie : `Autre`
- Coût fixe : `0`
- Unité : `Forfait`
- Coût variable unitaire : `50`

Avec deux passages, le coût sera `50 × 2 = 100`.

## Révision des barèmes
Les coûts doivent être revus régulièrement par les personnes responsables du chiffrage.

Lors d'une révision :

1. vérifiez la source du tarif ;
2. mettez à jour les montants ;
3. ajoutez la date ou le contexte dans les notes ;
4. désactivez les références devenues obsolètes ;
5. informez les utilisateurs des changements importants.

Modifier un barème n'a aucun effet rétroactif sur les Calculs Devis déjà créés.

## Bonnes pratiques
- Utilisez un libellé unique et précis.
- Évitez plusieurs références actives portant le même nom avec des montants différents.
- Indiquez la machine seulement lorsqu'elle aide réellement à choisir le tarif.
- Vérifiez que l'unité correspond bien au montant saisi.
- Ne saisissez pas deux fois le même forfait dans `Coût fixe` et `Coût variable unitaire`.
- Ajoutez une note quand le tarif doit être confirmé avant validation du devis.
- Désactivez les anciens tarifs au lieu de les supprimer.

## Questions / blocages
En cas de doute sur un montant ou sur l'unité à utiliser, demandez validation au Responsable Devis avant de reprendre la référence dans un Calcul Devis.
