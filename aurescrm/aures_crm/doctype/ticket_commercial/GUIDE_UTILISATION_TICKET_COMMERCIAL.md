# Guide d'Utilisation - Ticket Commercial

## 📋 Table des matières

1. [Introduction](#introduction)
2. [Accès au module](#accès-au-module)
3. [Créer un nouveau ticket](#créer-un-nouveau-ticket)
4. [Les champs du formulaire](#les-champs-du-formulaire)
5. [Les statuts et le workflow](#les-statuts-et-le-workflow)
6. [Suivre vos tickets](#suivre-vos-tickets)
7. [Bonnes pratiques](#bonnes-pratiques)
8. [FAQ](#faq)

---

## 🎯 Introduction

Le **Ticket Commercial** est un outil centralisé qui permet aux commerciaux de transmettre toutes les demandes et informations clients au back office d'Aures Emballages. 

### Objectifs du système

- ✅ **Centraliser** toutes les demandes commerciales en un seul endroit
- ✅ **Traçabiliser** les échanges avec les clients
- ✅ **Faciliter le suivi** des actions par le back office
- ✅ **Traduire** les demandes en actions concrètes dans l'ERP et les procédures

### Quand utiliser un ticket commercial ?

Utilisez un ticket commercial pour toute demande nécessitant une action du back office :

- 📝 Création d'un nouveau client
- 📦 Demande de bon de commande
- 💰 Demande de devis
- 🔄 Mise à jour de données client
- ⚠️ Réclamation commerciale
- 📎 Toute autre demande nécessitant une intervention

---

## 🚪 Accès au module

### Méthode 1 : Via le menu principal

1. Connectez-vous à votre espace ERPNext
2. Dans le menu latéral, recherchez le module **"Aures CRM"**
3. Cliquez sur **"Ticket Commercial"**

### Méthode 2 : Via le workspace Visites

1. Accédez au workspace **"Visites"**
2. Cliquez sur le raccourci **"Tickets Commerciaux"** (icône orange)

### Méthode 3 : Via la recherche globale

1. Utilisez la barre de recherche en haut de l'écran
2. Tapez **"Ticket Commercial"**
3. Sélectionnez l'option dans les résultats

---

## ➕ Créer un nouveau ticket

### Étapes de création

1. **Cliquez sur le bouton "Nouveau"** en haut à droite de la liste des tickets
2. **Remplissez les champs obligatoires** (marqués d'un astérisque *)
3. **Ajoutez une description détaillée** de la demande
4. **Joignez les fichiers** si nécessaire
5. **Sauvegardez** le ticket

### Numérotation automatique

Chaque ticket reçoit automatiquement un numéro unique au format :
```
TC-YY-MM-#####
```
Exemple : `TC-25-12-00001` (Ticket Commercial créé en décembre 2025, numéro 00001)

---

## 📝 Les champs du formulaire

### Section : Informations générales

#### Client * (Obligatoire)
- **Type** : Liste déroulante
- **Description** : Sélectionnez le client concerné par la demande
- **Comportement** : Le nom du client se remplit automatiquement après sélection

#### Priorité * (Obligatoire)
- **Type** : Liste déroulante
- **Options disponibles** :
  - 🔵 **Basse** : Demande non urgente, peut attendre
  - 🟡 **Moyenne** : Demande normale (valeur par défaut)
  - 🔴 **Haute** : Demande urgente nécessitant un traitement rapide
- **Conseil** : Utilisez "Haute" uniquement pour les demandes vraiment urgentes

### Section : Détails de la demande

#### Type * (Obligatoire)
- **Type** : Liste déroulante
- **Options disponibles** :
  - **Création** : Création d'un nouveau client, nouveau produit, etc.
  - **Bon de commande** : Demande de création ou modification d'un bon de commande
  - **Demande de devis** : Demande de création d'un devis
  - **Mise à jour données** : Modification d'informations client (adresse, contact, etc.)
  - **Réclamation commerciale** : Réclamation ou problème à résoudre
  - **Autre** : Toute autre demande non catégorisée

#### Canal
- **Type** : Liste déroulante
- **Options disponibles** :
  - 📞 **Téléphone**
  - 📧 **Email**
  - 💬 **WhatsApp**
  - 📱 **Raven**
  - 📎 **Autre**
- **Conseil** : Indiquez comment le client vous a contacté pour cette demande

#### Commercial
- **Type** : Liste déroulante
- **Description** : Votre nom est automatiquement rempli, mais vous pouvez le modifier si nécessaire
- **Comportement** : Le nom complet du commercial s'affiche automatiquement

#### Fichier
- **Type** : Pièce jointe
- **Description** : Joignez tous les documents utiles (photos, PDF, emails, etc.)
- **Formats acceptés** : Tous les formats de fichiers
- **Conseil** : Pour les réclamations, joignez toujours les photos ou documents justificatifs

### Section : Description

#### Description détaillée
- **Type** : Éditeur de texte enrichi
- **Description** : Décrivez en détail la demande du client
- **Conseil** : Soyez le plus précis possible :
  - Qui ? (nom du contact client)
  - Quoi ? (nature exacte de la demande)
  - Quand ? (délai souhaité, date limite)
  - Comment ? (instructions particulières)
  - Pourquoi ? (contexte si nécessaire)

### Champs automatiques (non modifiables)

- **Date de création** : Remplie automatiquement avec la date du jour
- **Créé par** : Votre nom est automatiquement enregistré
- **Statut** : Initialisé à "Nouveau" automatiquement

---

## 🔄 Les statuts et le workflow

### Les différents statuts

| Statut | Couleur | Signification | Qui peut modifier |
|--------|---------|---------------|-------------------|
| **Nouveau** | 🔵 Bleu | Ticket créé, en attente de traitement | Back office |
| **En Cours** | 🟠 Orange | Ticket pris en charge par le back office | Back office |
| **Pending** | 🟡 Jaune | Ticket mis en pause temporairement | Back office |
| **Terminé** | 🟢 Vert | Ticket traité et finalisé | Back office |
| **Annulé** | 🔴 Rouge | Ticket annulé | Back office |

### Le cycle de vie d'un ticket

```
┌─────────┐
│ Nouveau │ ← Vous créez le ticket ici
└────┬────┘
     │
     │ [Démarrer] (Back office)
     ▼
┌──────────┐
│ En Cours │ ← Le back office traite votre demande
└────┬─────┘
     │
     ├─── [Pause] ───► ┌─────────┐
     │                 │ Pending │ ← Mise en pause temporaire
     │                 └────┬────┘
     │                     │
     │                     │ [Reprendre]
     │                     ▼
     │                 ┌──────────┐
     │                 │ En Cours │
     │                 └────┬─────┘
     │                     │
     └─────────────────────┘
                         │
                         │ [Terminer]
                         ▼
                    ┌─────────┐
                    │ Terminé │ ← Demande traitée
                    └─────────┘
```

### Rôles et permissions

- **Vous (Commercial)** : 
  - ✅ Créer de nouveaux tickets
  - ✅ Modifier vos propres tickets (tant qu'ils ne sont pas terminés/annulés)
  - ✅ Consulter vos tickets
  - ✅ Supprimer vos tickets (si non soumis)
  
- **Back Office (Administrateur Ventes)** :
  - ✅ Modifier tous les tickets
  - ✅ Changer les statuts
  - ✅ Traiter les demandes

---

## 👀 Suivre vos tickets

### Vue liste

La liste des tickets affiche les colonnes suivantes :
- **Nom Client** : Nom du client concerné
- **Commercial** : Votre nom
- **Type** : Type de demande
- **Priorité** : Niveau de priorité
- **Statut** : État actuel du ticket

### Filtres disponibles

Vous pouvez filtrer vos tickets par :
- **Client** : Rechercher tous les tickets d'un client spécifique
- **Statut** : Voir uniquement les tickets "Nouveau", "En Cours", etc.
- **Type** : Filtrer par type de demande
- **Priorité** : Voir uniquement les tickets urgents
- **Commercial** : Voir vos propres tickets uniquement

### Tri par défaut

Les tickets sont triés par **date de modification** (plus récents en premier).

### Indicateurs visuels

- **Couleurs des statuts** : Chaque statut a une couleur pour un repérage rapide
- **Icône de notification** : Les tickets non lus sont marqués

---

## ✅ Bonnes pratiques

### 1. Rédaction de la description

**❌ À éviter :**
```
"Besoin d'un devis"
```

**✅ À privilégier :**
```
"Demande de devis pour le client ABC SARL
- Contact : M. Dupont (06 12 34 56 78)
- Produit : Emballage carton 30x40x50 cm
- Quantité : 1000 unités
- Délai souhaité : Livraison avant le 15 janvier 2026
- Référence commande client : CMD-2025-1234
- Fichier joint : Plan technique du produit"
```

### 2. Priorisation

- **Haute** : Utilisez uniquement pour les urgences réelles (problème client, perte de commande imminente)
- **Moyenne** : Pour la majorité des demandes normales
- **Basse** : Pour les demandes non urgentes ou informatives

### 3. Joindre des fichiers

Toujours joindre :
- 📸 Photos pour les réclamations
- 📄 Documents clients (devis, commandes)
- 📧 Copies d'emails importants
- 📋 Plans techniques ou spécifications

### 4. Mise à jour des tickets

- ✅ Vérifiez régulièrement l'état de vos tickets
- ✅ Répondez aux commentaires du back office si nécessaire
- ✅ Ne créez pas de doublons : vérifiez d'abord si un ticket existe déjà

### 5. Communication avec le back office

- ✅ Un ticket = une demande précise
- ✅ Créez un ticket séparé pour chaque demande différente
- ✅ Utilisez la description pour donner tous les détails nécessaires
- ✅ Indiquez les délais souhaités clairement

---

## ❓ FAQ

### Puis-je modifier un ticket après l'avoir créé ?

**Oui**, vous pouvez modifier vos tickets tant qu'ils ne sont pas au statut "Terminé" ou "Annulé". Une fois terminés, ils deviennent en lecture seule.

### Comment savoir si mon ticket a été traité ?

Le statut du ticket change automatiquement :
- **"En Cours"** = Le back office a commencé à traiter votre demande
- **"Terminé"** = Votre demande a été traitée et finalisée

### Puis-je annuler un ticket ?

Si vous êtes le créateur du ticket et qu'il n'est pas encore soumis, vous pouvez le supprimer. Sinon, contactez le back office pour annuler un ticket.

### Que faire si j'ai fait une erreur dans un ticket ?

Vous pouvez modifier le ticket tant qu'il n'est pas terminé. Si le ticket est déjà terminé, créez un nouveau ticket avec les corrections.

### Combien de temps prend le traitement d'un ticket ?

Le délai dépend de :
- La **priorité** du ticket
- La **complexité** de la demande
- La **charge de travail** du back office

Les tickets **Haute priorité** sont traités en priorité.

### Puis-je créer plusieurs tickets pour le même client ?

**Oui**, chaque demande doit avoir son propre ticket pour un meilleur suivi.

### Que signifie le statut "Pending" ?

Le statut "Pending" signifie que le traitement du ticket est temporairement mis en pause, généralement en attente d'informations complémentaires ou d'une action externe.

### Comment joindre plusieurs fichiers ?

Vous pouvez joindre plusieurs fichiers en utilisant le champ "Fichier". Cliquez sur "Attacher" et sélectionnez tous les fichiers nécessaires.

### Puis-je voir les tickets des autres commerciaux ?

Non, vous ne pouvez voir que vos propres tickets (sauf si vous avez le rôle Administrateur Ventes).

### Le ticket est-il automatiquement envoyé au back office ?

Oui, dès que vous sauvegardez un ticket, il est visible par le back office qui peut le prendre en charge.

---

## 📞 Support

Pour toute question ou problème technique :

1. **Consultez ce guide** en premier
2. **Contactez le back office** via un ticket ou par email
3. **Contactez l'administrateur système** pour les problèmes techniques

---

## 📅 Historique des modifications

- **Version 1.0** - Décembre 2025 : Création du guide d'utilisation

---

**Dernière mise à jour :** Décembre 2025  
**Auteur :** Équipe Aures CRM

