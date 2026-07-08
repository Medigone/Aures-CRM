# Guide d'utilisation - Ticket Commercial

## Objectif
Le `Ticket Commercial` permet aux commerciaux de transmettre une demande claire au back office, d'en suivre l'avancement et, si besoin, de demander une urgence.

Ce guide est volontairement simple et non technique.

## Quand créer un ticket commercial
Créez un ticket lorsqu'une action du back office est nécessaire, par exemple :

- création ou conception d'un besoin client
- demande de devis
- bon de commande
- information production
- mise à jour de données
- réclamation
- essai blanc
- autre demande spécifique

Règle simple : `1 ticket = 1 demande`.

## Accéder au module
Vous pouvez ouvrir `Ticket Commercial` :

- depuis le module `Aures CRM`
- depuis la recherche globale
- depuis la liste des tickets déjà existants

## Créer un ticket
1. Ouvrez la liste `Ticket Commercial`.
2. Cliquez sur `Nouveau`.
3. Renseignez les informations principales.
4. Décrivez précisément la demande.
5. Ajoutez les pièces jointes si nécessaire.
6. Sauvegardez.

Le numéro du ticket est créé automatiquement.

## Les champs importants

### Client
Sélectionnez le client concerné.

Le nom du client se remplit automatiquement.

### Type
Choisissez le type de demande le plus proche de votre besoin.

Valeurs disponibles :

- `Conception`
- `Bon de commande`
- `Demande de devis`
- `Information Production`
- `Mise à jour données`
- `Réclamation`
- `Essai Blanc`
- `Autre`

### Priorité
La priorité sert à indiquer l'importance générale de la demande :

- `Basse` : demande non urgente
- `Moyenne` : demande normale
- `Haute` : demande importante à traiter rapidement

La priorité ne remplace pas la demande d'urgence.

### Canal
Indiquez comment la demande est arrivée :

- `Email`
- `WhatsApp`
- `Raven`
- `Autre`

### Description détaillée
Expliquez clairement la demande :

- ce que le client attend
- pour quand
- les contraintes éventuelles
- les références utiles
- le contexte si nécessaire

### Pièces jointes
Ajoutez tout document utile :

- email client
- photo
- capture d'écran
- bon de commande
- document technique

## Suivre un ticket
Depuis la liste, vous pouvez retrouver rapidement vos tickets grâce aux colonnes :

- client
- commercial
- type
- statut
- urgence

Les tickets les plus récents remontent en premier.

## Signification des statuts du ticket

- `Nouveau` : le ticket vient d'être créé
- `En Cours` : le back office a commencé le traitement
- `Pending` : le traitement est momentanément en attente
- `Terminé` : la demande est finalisée
- `Annulé` : le ticket ne sera pas traité

Un ticket `Terminé` ou `Annulé` devient en lecture seule.

## Fonctionnement de l'urgence

### À quoi sert l'urgence
L'urgence permet de demander un traitement prioritaire par rapport au flux normal.

Elle est distincte de la priorité classique.

### Niveaux d'urgence

- `U0` : aucune urgence
- `U1` : urgence faible
- `U2` : urgence modérée
- `U3` : urgence forte

### Demander une urgence
Une fois le ticket sauvegardé, un bouton `Urgence > Demande d'urgence` peut apparaître.

Vous devez alors renseigner :

- le niveau demandé (`U1` à `U3` ; `U0` signifie « aucune urgence » et n’est pas proposé dans la demande)
- le motif de la demande

La demande part ensuite en validation.

### Demander une urgence plus forte après une validation
Si une urgence a déjà été **validée** (par exemple en `U1`) et que la situation nécessite un niveau supérieur (`U2`, `U3`, etc.), vous pouvez refaire une **nouvelle demande** : le bouton `Urgence > Demande d'urgence` reste disponible tant qu'il n'y a pas déjà une demande **en attente** de validation.

### Annuler une demande d'urgence
Si vous vous êtes trompé, vous pouvez utiliser :

- `Urgence > Annuler la demande`

Cela est possible lorsque la demande est encore **en attente** de validation, ou lorsque l'urgence a déjà été **validée** (dans ce dernier cas, le ticket repasse aussi à `U0`).

Cela remet le ticket à :

- `Niveau actuel : U0`
- `Statut demande urgence : Aucune`

Les actions sur l'urgence (demande, validation, refus, annulation) sont en outre **consignées dans la chronologie** du ticket (commentaires), pour garder une trace lisible.

### Validation par le back office
Le back office peut :

- valider la demande
- refuser la demande

Quand une urgence a été traitée, le bloc `Urgence Dossier` affiche de façon claire :

- le niveau actuel
- le niveau demandé
- le statut de la demande
- le motif
- la décision prise

### Couleurs des niveaux

- `U0` : vert
- `U1` : jaune
- `U2` : orange
- `U3` : rouge

## Boutons utiles dans le ticket

### Créer
Selon vos droits, vous pouvez créer directement depuis le ticket :

- une `Demande de faisabilité`
- un `Article`

Ces boutons évitent de ressaisir certaines informations.

### Urgence
Le groupe `Urgence` peut proposer :

- `Demande d'urgence`
- `Annuler la demande`

Selon votre rôle, le back office peut aussi voir les actions de validation.

## Bonnes pratiques

### Bien rédiger la description
Préférez une description précise, par exemple :

```text
Client : ABC
Besoin : demande de devis pour 1000 unités
Délai souhaité : avant vendredi
Contrainte : maquette jointe
Contact client : Mme Dupont
```

Évitez les descriptions trop courtes comme :

```text
Besoin urgent
```

### Bien utiliser l'urgence

- n'utilisez l'urgence que si nécessaire
- choisissez un niveau cohérent
- expliquez toujours le motif
- annulez la demande si elle a été faite par erreur (en attente ou après validation, selon les cas)

### Éviter les doublons
Avant de créer un nouveau ticket, vérifiez qu'un ticket n'existe pas déjà pour la même demande.

## Questions fréquentes

### Puis-je modifier un ticket après création ?
Oui, tant qu'il n'est pas `Terminé` ou `Annulé`.

### Puis-je demander une urgence sur un ticket non sauvegardé ?
Non. Il faut d'abord créer et sauvegarder le ticket.

### Puis-je annuler une urgence déjà validée ?
Oui. Le commercial du ticket peut utiliser `Urgence > Annuler la demande` : le ticket repasse en `U0` et l'historique reste visible dans la **chronologie** du ticket.

### Comment savoir si l'urgence a été prise en compte ?
Consultez le bloc `Urgence Dossier` dans le ticket. Il résume l'état de l'urgence.

### Où voir l'historique des demandes d'urgence ?
Dans la **chronologie** du ticket (commentaires), sous forme d'entrées « Journal urgence » décrivant les demandes, validations, refus et annulations.

### Puis-je voir les tickets des autres commerciaux ?
En principe, non, sauf droits particuliers.

## En résumé

- créez un ticket clair et complet
- joignez les documents utiles
- utilisez la priorité pour l'importance générale
- utilisez l'urgence seulement si une validation spécifique est nécessaire
- suivez l'avancement depuis la liste et dans le ticket

---

**Dernière mise à jour :** Avril 2026  
**Public visé :** Commerciaux  
**Document :** Guide utilisateur Ticket Commercial
