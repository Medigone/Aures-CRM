# Guide d'Utilisation - Accueil Client

## Introduction

Le document **Accueil Client** permet de planifier, organiser et suivre l'accueil de vos clients dans les locaux de votre société. Il gère automatiquement le statut de l'accueil, les heures d'arrivée/départ du client et calcule la durée de la visite dans vos locaux.

---

## Planifier un Accueil Client

### 1. Accéder au Formulaire

1. Dans le menu, recherchez **"Accueil Client"**
2. Cliquez sur **"Nouveau"** pour créer un nouveau document d'accueil

### 2. Remplir les Informations Générales

#### Onglet "Informations Générales"

**Champs obligatoires :**
- **Client** : Sélectionnez le client qui sera accueilli dans vos locaux
- **Date Visite Prévue** : Choisissez la date de l'accueil (ne peut pas être dans le passé)
- **Personne en charge** : Sélectionnez l'utilisateur de votre société qui sera responsable de l'accueil
- **Raison Visite** : Sélectionnez la raison de la visite du client depuis la liste prédéfinie

**Champs optionnels :**
- **Heure Prévue** : Indiquez l'heure prévue d'arrivée du client
- **Ordre du Jour** : Notez les points qui seront abordés pendant la visite du client dans vos locaux

> 💡 **Astuce** : Le statut est automatiquement défini sur "Planifiée" lors de la création. Le document est automatiquement numéroté (format : AC-YYYY-#####).

---

## Préparer l'Accueil

### Onglet "Préparation"

Avant l'arrivée du client, préparez l'accueil :

1. **Personnes Rencontrées** : Préparez la liste des personnes de votre société que le client rencontrera (tableau)
2. **Notes Préparation** : Ajoutez toutes les informations utiles pour bien organiser l'accueil (salle de réunion, matériel nécessaire, documents à préparer, etc.)

### Pourquoi préparer ?

Une bonne préparation permet de :
- Organiser les espaces nécessaires (salle de réunion, espace d'accueil)
- Préparer le matériel ou les documents à présenter
- Informer les collaborateurs qui rencontreront le client
- Assurer un accueil professionnel et fluide

---

## Accueillir le Client

### Quand le Client Arrive

Quand le client arrive dans vos locaux :

1. Changez le **statut** de **"Planifiée"** à **"En Cours"**
   - L'**heure d'arrivée** et la **date visite réelle** sont enregistrées automatiquement

### Pendant l'Accueil

Utilisez l'onglet **"Notes"** pour prendre des notes en temps réel :
- Points importants discutés
- Demandes ou questions du client
- Informations partagées
- Ces notes peuvent être modifiées même après soumission

---

## Finaliser l'Accueil

### Quand le Client Part

Quand le client quitte vos locaux :

1. Changez le **statut** de **"En Cours"** à **"Terminée"**
   - L'**heure de départ** est enregistrée automatiquement
   - La **durée de la visite** (en minutes) est calculée automatiquement
   - Le document reste en brouillon (doc_status = 0)

### Compléter les Informations de Suivi

#### Onglet "Suivi"

1. **Suite à Donner** : Notez les actions à entreprendre suite à la visite (devis à envoyer, informations à fournir, rappels, etc.)
2. **Prochaine Visite Prévue** : Si une prochaine visite est prévue, planifiez-la

#### Compléter les Personnes Rencontrées

Dans l'onglet **"Préparation"**, vérifiez que toutes les personnes de votre société que le client a rencontrées sont bien listées dans la table **"Personnes Rencontrées"**.

---

## Valider et Soumettre le Document

Une fois toutes les informations complétées et la visite terminée :

1. **Valider la visite** : Utilisez l'action workflow **"Valider Visite"** pour passer le statut de **"Terminée"** à **"Validé"**
   - Cette action soumet automatiquement le document (doc_status = 1)
   - Le document est maintenant validé et soumis

> ⚠️ **Important** : 
> - Après validation, certaines modifications restent possibles (notes, suite à donner) grâce à l'option "allow_on_submit"
> - Les champs de base (client, raison visite, etc.) sont maintenant protégés en lecture seule

---

## Gestion des Statuts

Le système gère automatiquement 5 statuts pour suivre l'accueil :

| Statut | Description | Action Automatique | Document Status |
|--------|-------------|-------------------|----------------|
| **Planifiée** | Accueil planifié mais le client n'est pas encore arrivé | Aucune | Brouillon (0) |
| **En Cours** | Le client est dans les locaux | Enregistre l'heure d'arrivée et la date réelle | Brouillon (0) |
| **Terminée** | Le client a quitté les locaux | Enregistre l'heure de départ et calcule la durée | Brouillon (0) |
| **Validé** | La visite est validée et le document soumis | Soumet le document | Soumis (1) |
| **Annulée** | L'accueil a été annulé | Aucune | Annulé (2) |

### Comment changer le statut

Le statut change via les **actions workflow** :
- **"Démarrer Visite"** : De "Planifiée" à "En Cours"
- **"Terminer Visite"** : De "En Cours" à "Terminée"
- **"Valider Visite"** : De "Terminée" à "Validé" (soumet le document)
- **"Annuler Visite"** : De "Validé" à "Annulée"

### Protection des Champs

⚠️ **Important** : Une fois que le statut n'est plus "Planifiée", les champs suivants deviennent **automatiquement en lecture seule** :
- Client
- Date Visite Prévue
- Heure Prévue
- Raison Visite
- Ordre du Jour
- Personne en charge

Cela garantit que les informations de base de la visite ne peuvent plus être modifiées une fois que la visite a commencé.

---

## Onglet "Autres"

Cet onglet contient les informations système :

- **Créé Par** : Nom de la personne qui a planifié l'accueil (automatique)
- **Personne en charge** : Responsable de l'accueil et de la visite du client

Ces informations sont remplies automatiquement.

---

## Conseils d'Utilisation

### ✅ Bonnes Pratiques

1. **Planifiez à l'avance** : Créez le document dès que l'accueil est planifié pour organiser les ressources nécessaires
2. **Vérifiez les informations avant de commencer** : Une fois le statut passé à "En Cours", les champs de base deviennent en lecture seule
3. **Préparez bien l'accueil** : Remplissez l'onglet "Préparation" avant l'arrivée du client
4. **Changez le statut en temps réel** : Passez à "En Cours" dès l'arrivée du client
5. **Prenez des notes pendant l'accueil** : Documentez les échanges importants
6. **Finalisez rapidement** : Changez le statut à "Terminée" et complétez le suivi dès le départ du client
7. **Validez la visite** : Utilisez l'action "Valider Visite" pour soumettre le document une fois tout complété
8. **Documentez les suites** : Notez les actions à entreprendre pendant que tout est frais en mémoire

### 🔍 Recherche et Filtres

Dans la liste des Accueils Client, vous pouvez filtrer par :
- **Client**
- **Date Visite Prévue**
- **Personne en charge** (celui qui accueille)
- **Raison Visite**
- **Statut**

Cela permet de voir rapidement :
- Les accueils planifiés aujourd'hui
- Les accueils d'un client particulier
- Les accueils dont vous êtes responsable

### 📊 Informations Automatiques

Le système enregistre automatiquement :
- Le numéro du document (format : AC-YYYY-#####)
- L'utilisateur qui a planifié l'accueil (créateur)
- L'heure d'arrivée du client (quand statut = "En Cours")
- L'heure de départ du client (quand statut = "Terminée")
- La durée de la visite dans vos locaux (calculée automatiquement en minutes)

---

## Cas d'Usage

### Scénario 1 : Accueil Planifié

1. Un commercial planifie la venue d'un client pour une présentation produit
2. Il crée un document "Accueil Client", remplit les informations et la préparation (statut "Planifiée")
3. Le jour J, il utilise l'action "Démarrer Visite" pour passer à "En Cours" à l'arrivée du client
4. Il prend des notes pendant la présentation
5. À la fin, il utilise l'action "Terminer Visite" pour passer à "Terminée" et complète le suivi
6. Une fois toutes les informations complétées, il utilise l'action "Valider Visite" pour soumettre le document (statut "Validé")

### Scénario 2 : Accueil Urgent

1. Un client arrive sans rendez-vous
2. Créez rapidement un document "Accueil Client" avec les informations disponibles
3. Mettez immédiatement le statut à "En Cours"
4. Complétez les informations au fur et à mesure
5. Finalisez normalement quand le client part

### Scénario 3 : Visite avec Plusieurs Personnes

1. Plusieurs représentants d'un client doivent être accueillis
2. Listez toutes les personnes de votre société qu'ils rencontreront dans "Personnes Rencontrées"
3. Préparez l'ordre du jour détaillé
4. Suivez l'accueil normalement

---

## Questions Fréquentes

### Comment annuler un accueil ?

L'annulation n'est possible que depuis le statut **"Validé"**. Utilisez l'action workflow **"Annuler Visite"** pour annuler un accueil déjà validé. L'accueil ne sera pas comptabilisé dans les statistiques.

### Puis-je modifier un accueil déjà soumis ?

Oui, les champs "Notes" et "Suite à Donner" peuvent être modifiés même après soumission pour ajouter des informations complémentaires.

### La durée est-elle calculée correctement ?

Oui, la durée est calculée automatiquement en minutes entre l'heure d'arrivée et l'heure de départ. Si la durée semble incorrecte, vérifiez que les heures d'arrivée et de départ sont bien enregistrées.

### Puis-je créer un accueil pour hier ?

Non, lors de la création, la date prévue ne peut pas être dans le passé. Cependant, si vous devez documenter un accueil passé, vous pouvez créer le document avec la date d'aujourd'hui et modifier la date manuellement après la création, ou créer le document directement avec le statut "Terminée".

### Qui peut créer un accueil client ?

Tous les utilisateurs ayant les permissions appropriées peuvent créer un accueil client. Consultez votre administrateur pour connaître vos droits d'accès.

### Puis-je voir tous les accueils du mois ?

Oui, utilisez les filtres dans la liste pour filtrer par période. Vous pouvez aussi exporter les données pour des analyses plus poussées.

---

## Support

Pour toute question ou problème, contactez votre administrateur système.
