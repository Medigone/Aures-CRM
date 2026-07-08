# Guide d'utilisation - Étude Technique

## Objectif
L'`Étude Technique` formalise, pour un article d'une commande, les données nécessaires à sa fabrication (tracé, imposition, maquette, BAT, machine, nombre de passages) et sert de support à la planification production offset. Elle est traitée par l'équipe pré-presse.

Ce guide est volontairement simple et non technique.

## D'où viennent les études techniques
Deux origines possibles :

1. **Génération automatique** (cas courant) : quand l'équipe planification valide la planification d'un `Dossier Fabrication`, une étude technique est créée automatiquement pour chaque ligne du programme de livraison. Tracé, imposition, machine et date de planification sont repris automatiquement si déjà renseignés.
2. **Création manuelle** (ancien flux, cas particulier) : une étude peut être créée directement, indépendamment d'un dossier fabrication.

Dans la grande majorité des cas, vous n'avez rien à créer : votre travail commence à la réception de l'étude.

## Accéder au module
Vous pouvez ouvrir `Étude Technique` :

- depuis le module `Aures CRM`
- depuis la recherche globale
- depuis le `Dossier Fabrication` lié (champ `Dossier fabrication`)

## Cycle de vie (statut)

`Nouveau` → `En Cours` → `Terminée` → `Annulée`

- **Nouveau** : étude créée, pas encore prise en main.
- **En Cours** : technicien assigné, étude en cours de traitement (bouton `Démarrer`).
- **Terminée** : étude finalisée et soumise (bouton `Terminer`) — les champs deviennent verrouillés, sauf ceux explicitement modifiables après soumission (voir plus bas).
- **Annulée** : étude annulée (bouton `Annuler`), possible depuis le statut Terminée.

## S'attribuer une étude
Sur une étude au statut `Nouveau` :

- Bouton `À moi` : vous attribue l'étude directement.
- Bouton `Attribuer à...` : permet de désigner un autre technicien pré-presse.

## Traiter une étude technique
1. Ouvrez l'étude (statut `Nouveau` ou `En Cours`).
2. Vérifiez les données héritées : client, article, quantité, tracé, imposition, maquette, demande de faisabilité, dossier fabrication.
3. Vérifiez le BAT associé. Le système recherche automatiquement un BAT `BAT-P Validé` (ou à défaut `BAT-E Validé`) pour l'article et vous prévient s'il en trouve un.
4. Renseignez ou vérifiez `Machine` et `Date planification production`, si ce n'est pas déjà fait par l'équipe planification.
5. Passez le statut à `En Cours` puis `Terminée` une fois l'étude finalisée.

## Les champs importants

- `Client` / `Article` / `Quantité` : hérités de la commande, lecture seule.
- `Tracé` / `Imposition` / `Maquette` : liens vers les documents techniques, avec leurs fichiers joints. Ne les modifiez pas depuis l'étude technique : ils sont hérités automatiquement, toute correction se fait en amont (Étude Faisabilité / Dossier Fabrication).
- `Procédé` : hérité de l'article.
- `Nombre de poses` : hérité de l'imposition.
- `Machine` : presse affectée. Reste modifiable même après soumission de l'étude, pour permettre une replanification depuis le Planning Production.
- `Nombre de passages` / `Charge presse (feuilles × passages)` : calculés automatiquement selon la machine choisie et les couleurs/vernis de l'article.
- `Quantité Feuilles` : calculée à partir de la quantité commandée et du nombre de poses.
- `Date planification production` : date cible de lancement en production (charge machine), distincte de la date de livraison client. Modifiable après soumission pour permettre la replanification.
- `Dossier fabrication` / `Ligne dossier fabrication` : dossier d'origine.
- `Ordre de Production` : un bouton `Créer Ordre de Production` est disponible une fois l'étude soumise.

  **Ce module est en cours de validation et ne doit pas être utilisé pour l'instant**, sauf consigne explicite.

## Où apparaît une étude technique une fois traitée
Une fois créée (et si `Procédé = Offset`), l'étude technique alimente automatiquement la grille du `Planning Production`, avec la machine et la date de planification renseignées. Toute mise à jour de la machine ou de la date, que ce soit depuis l'étude ou depuis le planning, se reflète des deux côtés.

## Bonnes pratiques
- Ne modifiez pas manuellement `Tracé` / `Imposition` : ces champs sont hérités et en lecture seule.
- N'utilisez pas le bouton `Créer Ordre de Production` sans consigne explicite (module en cours de validation).
- Si `Machine` ou `Date planification production` sont déjà renseignées à l'ouverture de l'étude, elles viennent probablement de l'équipe planification : vérifiez avant de les modifier.

## Questions / blocages
En cas de doute sur une étude ou un blocage technique, contactez : _à compléter_.
