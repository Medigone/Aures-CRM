# Guide Utilisateur : Module de Gestion des Meetings Internes

## 🎯 Vue d'ensemble

Le module de gestion des meetings internes permet de planifier, suivre et documenter tous vos meetings et briefings d'équipe avec :
- Récurrence automatique (quotidienne, hebdomadaire, mensuelle)
- Rappels automatiques par email
- Gestion simple de l'ordre du jour, actions et décisions
- Suivi des participants
- Export PDF stylisé des comptes-rendus

## 🚀 Démarrage Rapide

### Accès au Module

1. Rechercher **"Meeting Interne"** dans la barre de recherche Frappe
2. Ou utiliser le menu **Aures CRM → Meeting Interne**

## 📋 Étape 1 : Configurer les Types de Meetings

### Types Disponibles par Défaut

Le système est livré avec 8 types de meetings pré-configurés :
- ✅ Réunion Quotidienne
- ✅ Réunion Hebdomadaire
- ✅ Briefing Équipe
- ✅ Réunion Stratégique
- ✅ Formation Interne
- ✅ Revue Projet
- ✅ Réunion Direction
- ✅ Point Individual

### Créer un Nouveau Type (Optionnel)

1. Aller dans **Type Meeting**
2. Cliquer **Nouveau**
3. Saisir le **Nom du Type** (ex: "Comité de Direction")
4. **Sauvegarder**

## 🗓️ Étape 2 : Créer un Meeting

### Création Basique

1. Aller dans **Meeting Interne**
2. Cliquer **Nouveau**
3. Remplir l'onglet **Informations Générales** :

```
┌─────────────────────────────────────────┐
│ Titre du Meeting                        │
│ Revue Hebdomadaire Équipe Technique     │
├─────────────────────────────────────────┤
│ Statut: Planifié ▼                      │
│ Type de Meeting: Réunion Hebdomadaire ▼ │
├─────────────────────────────────────────┤
│ Date: 28/10/2025                        │
│ Date & Heure: 28/10/2025 14:00         │
│ Durée Estimée: 60 minutes              │
├─────────────────────────────────────────┤
│ Lieu / Salle: Salle de Réunion A       │
│ Organisateur: wezri@example.com ▼      │
│ Nom Organisateur: Wezri [auto]         │
└─────────────────────────────────────────┘
```

4. Ajouter une **Description / Contexte** (optionnel)
5. **Sauvegarder**

### Ajouter des Participants

1. Aller dans l'onglet **Participants**
2. Cliquer **Ajouter ligne** dans le tableau
3. Pour chaque participant :
   - **Utilisateur** : Sélectionner dans la liste
   - **Nom Complet** : Se remplit automatiquement
   - **Rôle** : Organisateur / Participant / Requis / Optionnel
   - **Présent** : Cocher si présent (à remplir après le meeting)
   - **Commentaire** : Notes éventuelles

```
┌────────────────────────────────────────────────────────────┐
│ Utilisateur         │ Nom    │ Rôle    │ Présent │ Comment │
├────────────────────────────────────────────────────────────┤
│ wezri@example.com   │ Wezri  │ Organ.  │ ☑       │         │
│ john@example.com    │ John   │ Requis  │ ☐       │         │
│ sarah@example.com   │ Sarah  │ Requis  │ ☐       │         │
│ mike@example.com    │ Mike   │ Option. │ ☐       │         │
└────────────────────────────────────────────────────────────┘
```

> 💡 **Astuce** : L'organisateur est automatiquement ajouté aux participants avec le rôle "Organisateur" et marqué présent.

## 📋 Étape 3 : Définir l'Ordre du Jour

### Rédiger l'Ordre du Jour

1. Dans le meeting, aller à l'onglet **Ordre du Jour**
2. Rédiger les points à aborder dans l'éditeur de texte
3. Vous pouvez :
   - Utiliser le formatage (gras, italique, listes)
   - Numéroter les points
   - Ajouter des liens
   - Insérer des tableaux

**Exemple** :
```
1. Résultats du trimestre Q3 (15min)
   - Chiffre d'affaires : +12%
   - Nouveaux clients : 25

2. Budget 2026 (20min)
   - Présentation par Sarah
   - Discussion et validation

3. Nouveau projet Alpha (15min)
   - Objectifs
   - Ressources nécessaires

4. Questions diverses (10min)
```

## 🔁 Étape 4 : Configurer la Récurrence (Optionnel)

### Meetings Récurrents

Pour les meetings qui se répètent régulièrement :

1. Dans le meeting, section **Récurrence**, cocher **Meeting Récurrent**
2. Choisir la **Fréquence** :
   - **Quotidien** : Tous les jours
   - **Hebdomadaire** : Chaque semaine
   - **Mensuel** : Chaque mois
3. Si Hebdomadaire, sélectionner le **Jour de la Semaine** (ex: Lundi)
4. Si Mensuel, saisir le **Jour du Mois** (1-31)
5. Définir la **Date Fin Récurrence** (jusqu'à quand répéter)
6. **Sauvegarder**

### Exemple : Réunion Hebdomadaire

```
┌─────────────────────────────────────────┐
│ ☑ Meeting Récurrent                     │
├─────────────────────────────────────────┤
│ Fréquence: Hebdomadaire ▼               │
│ Jour de la Semaine: Lundi ▼             │
├─────────────────────────────────────────┤
│ Date Fin Récurrence: 31/12/2025        │
└─────────────────────────────────────────┘
```

> ⚠️ **Important** : Les occurrences récurrentes sont **générées automatiquement** lors de la sauvegarde du meeting parent.

### Gérer les Occurrences

- Le meeting original devient le **Meeting Parent**
- Chaque occurrence créée a un lien vers le parent
- Les occurrences peuvent être modifiées individuellement
- Annuler le parent n'annule pas les occurrences déjà créées

## 🔔 Étape 5 : Configurer les Rappels

### Activer les Rappels Automatiques

1. Dans le meeting, section **Rappels**, cocher **Envoyer Rappel Automatique**
2. Choisir le **Délai du Rappel** :
   - 15 minutes avant
   - 30 minutes avant
   - 1 heure avant
   - 2 heures avant
   - 1 jour avant
   - 2 jours avant

```
┌─────────────────────────────────────────┐
│ ☑ Envoyer Rappel Automatique            │
│ Délai du Rappel: 1 heure avant ▼        │
├─────────────────────────────────────────┤
│ ☐ Rappel Envoyé [lecture seule]        │
│ Date Envoi Rappel: [vide]              │
└─────────────────────────────────────────┘
```

3. **Sauvegarder**

### Fonctionnement des Rappels

- Le système vérifie **toutes les heures** les meetings à rappeler
- Un **email** est envoyé automatiquement à tous les participants
- Le champ **Rappel Envoyé** est coché automatiquement
- La **Date Envoi Rappel** est enregistrée

### Envoyer un Rappel Manuellement

Si vous voulez envoyer le rappel immédiatement :

1. Ouvrir le meeting
2. Cliquer **Actions → Envoyer Rappel Maintenant**
3. Confirmer
4. Tous les participants reçoivent un email

## 📧 Contenu des Notifications

### Email de Convocation (Création)

Envoyé automatiquement à tous les participants à la création :

```
Sujet: Nouveau Meeting: Revue Hebdomadaire Équipe Technique

Bonjour,

Vous êtes invité(e) au meeting suivant:

Revue Hebdomadaire Équipe Technique

Date: 28/10/2025
Heure: 28/10/2025 14:00
Lieu: Salle de Réunion A
Organisateur: Wezri
Rôle: Requis

Description:
[Description du meeting]

[Voir le meeting]
```

### Email de Rappel

Envoyé selon le délai configuré :

```
Sujet: Rappel: Revue Hebdomadaire Équipe Technique

Bonjour,

Ceci est un rappel pour le meeting suivant:

Revue Hebdomadaire Équipe Technique

Date: 28/10/2025
Heure: 28/10/2025 14:00
Lieu: Salle de Réunion A
Organisateur: Wezri

[Ordre du jour détaillé]

[Voir le meeting]
```

## 📝 Étape 6 : Pendant le Meeting

### Prendre des Notes

1. Aller dans l'onglet **Compte-Rendu**
2. Remplir les champs :
   - **Notes principales** : Notes brutes du meeting
   - **Résumé exécutif** : Synthèse courte
   - **Points clés discutés** : Points importants
3. **Fichiers attachés** : Ajouter des documents (slides, fichiers...)

### Marquer la Présence

1. Retourner à l'onglet **Participants**
2. Cocher **Présent** pour chaque participant présent
3. Le **Taux de présence** se calcule automatiquement dans l'onglet **Suivi Post-Meeting**

## ✅ Étape 7 : Enregistrer les Actions

### Ajouter des Points d'Action

1. Aller dans l'onglet **Actions**
2. Rédiger les actions dans l'éditeur de texte
3. Utilisez un format structuré :

**Exemple** :
```
□ Préparer rapport Q3 (John - 05/11/2025) - Priorité: Haute
□ Contacter client ACME (Sarah - 01/11/2025) - URGENT
□ Mettre à jour documentation (Mike - 10/11/2025)
□ Organiser formation équipe (Pierre - 15/11/2025)
```

## 🎯 Étape 8 : Enregistrer les Décisions

### Documenter les Décisions

1. Aller dans l'onglet **Décisions**
2. Rédiger les décisions prises dans l'éditeur de texte

**Exemple** :
```
**Décision 1: Lancement projet Alpha**
- Type: Stratégique
- Impact: Élevé
- Décideur: Direction Générale
- Description: Validation du lancement du projet Alpha au Q1 2026
  avec un budget de 500K€

**Décision 2: Recrutement**
- Type: RH
- Impact: Moyen  
- Décideur: RH
- Description: Recrutement de 2 développeurs Python pour l'équipe
```

## 🔗 Étape 9 : Lier des Documents

### Ajouter des Références Documents

1. Aller dans l'onglet **Documents Liés**
2. Ajouter les liens vers les documents pertinents dans l'éditeur

**Exemple** :
```
Documents discutés:
- Customer: ACME Corp (nouveau client projet)
- Quotation: QUO-2025-001 (devis validé)
- Sales Order: SO-2025-042 (commande signée)
- Fichiers: Présentation Q3.pdf, Budget 2026.xlsx
```

## 📊 Étape 10 : Consulter le Suivi

### Onglet Suivi Post-Meeting

Affiche des métriques calculées automatiquement :

```
┌─────────────────────────────────────────┐
│ Taux de Présence: 75% [calculé auto]   │
│ Taux Complétion Actions: 33%           │
├─────────────────────────────────────────┤
│ Efficacité du Meeting: ★★★★☆ (4/5)    │
└─────────────────────────────────────────┘

Commentaires Généraux:
[Zone de texte libre pour feedback]

Prochaines Étapes:
[Zone de texte pour plan d'action]
```

## 📄 Étape 11 : Exporter le Compte-Rendu PDF

### Générer le PDF Stylisé

1. Ouvrir le meeting terminé
2. Cliquer **Actions → Exporter Compte-Rendu PDF**
3. Une nouvelle fenêtre s'ouvre avec le PDF
4. **Télécharger** ou **Imprimer**

### Contenu du PDF

Le PDF inclut automatiquement :

```
┌───────────────────────────────────────────┐
│        COMPTE-RENDU DE MEETING            │
│   Revue Hebdomadaire Équipe Technique     │
├───────────────────────────────────────────┤
│ Date: 28/10/2025 à 14:00                  │
│ Lieu: Salle de Réunion A                  │
│ Organisateur: Wezri                        │
│ Type: Réunion Hebdomadaire                │
│ Statut: Terminé                            │
├───────────────────────────────────────────┤
│                                            │
│ PARTICIPANTS (Taux: 75%)                   │
│ ✓ Wezri - Organisateur                    │
│ ✓ John - Requis                           │
│ ✓ Sarah - Requis                          │
│ ✗ Mike - Optionnel                        │
│                                            │
│ ORDRE DU JOUR                              │
│ [Contenu de l'ordre du jour]              │
│                                            │
│ DÉCISIONS PRISES                           │
│ [Décisions documentées]                    │
│                                            │
│ ACTIONS À RÉALISER                         │
│ [Liste des actions]                        │
│                                            │
│ RÉSUMÉ EXÉCUTIF                            │
│ [Synthèse du meeting]                      │
│                                            │
│ PROCHAINES ÉTAPES                          │
│ [Plan d'action]                            │
│                                            │
├───────────────────────────────────────────┤
│ Document généré le 28/10/2025 à 16:30    │
│ Meeting Interne - MEET-2025-0001          │
└───────────────────────────────────────────┘
```

## 🔍 Étape 12 : Rechercher et Filtrer

### Filtres Rapides

Dans la liste des **Meeting Interne** :

1. **Filtrer par Statut** :
   - Planifié
   - En Cours
   - Terminé
   - Reporté
   - Annulé

2. **Filtrer par Type** :
   - Réunion Quotidienne
   - Réunion Hebdomadaire
   - etc.

3. **Filtrer par Date** :
   - Aujourd'hui
   - Cette semaine
   - Ce mois
   - Personnalisé

### Recherche Avancée

1. Cliquer sur **Filtres** dans la barre
2. Ajouter des filtres :
   - **Organisateur** : Mes meetings
   - **Date ≥** : Meetings futurs
   - **Statut** : Planifié

## 📞 Support et Questions Fréquentes

### Comment modifier un meeting récurrent ?

**Modifier une seule occurrence** :
- Ouvrir l'occurrence spécifique
- Modifier les champs souhaités
- Sauvegarder

**Modifier toutes les occurrences futures** :
- Annuler le meeting parent
- Créer un nouveau meeting récurrent avec les bonnes dates

### Comment annuler un meeting ?

1. Ouvrir le meeting
2. Changer le **Statut** à **Annulé**
3. Sauvegarder
4. (Optionnel) Notifier manuellement les participants

### Puis-je avoir plusieurs organisateurs ?

Le système a un seul organisateur, mais vous pouvez :
- Ajouter d'autres personnes avec le rôle "Organisateur" dans les participants
- Utiliser le champ **Commentaire** pour noter les co-organisateurs

### Comment savoir si un rappel a été envoyé ?

1. Ouvrir le meeting
2. Section **Rappels**
3. Vérifier que **Rappel Envoyé** est coché
4. Consulter la **Date Envoi Rappel**

### Que se passe-t-il si je modifie la date d'un meeting avec rappel ?

- Si le rappel n'a pas encore été envoyé, il s'adapte à la nouvelle date
- Si le rappel a déjà été envoyé, décocher **Rappel Envoyé** pour qu'il soit renvoyé

### Comment voir l'historique des modifications ?

1. Ouvrir le meeting
2. Cliquer sur l'icône **ⓘ Info** en haut à droite
3. Onglet **Versions** affiche toutes les modifications

## 🎓 Bonnes Pratiques

### ✅ À FAIRE

1. **Planifier à l'avance** : Créer les meetings au moins 2 jours avant
2. **Rédiger l'ordre du jour** : Préparer les points à aborder
3. **Activer les rappels** : Assurer une meilleure participation
4. **Marquer la présence** : Suivre l'assiduité des participants
5. **Documenter les décisions** : Traçabilité des choix importants
6. **Lister les actions clairement** : Avec responsables et échéances
7. **Exporter les CR** : Archiver et partager les comptes-rendus
8. **Mettre à jour les statuts** : Passer de "Planifié" à "Terminé"

### ❌ À ÉVITER

1. ❌ Créer un meeting sans participants
2. ❌ Oublier de remplir l'ordre du jour
3. ❌ Ne pas documenter les actions et décisions
4. ❌ Laisser le statut à "Planifié" après le meeting
5. ❌ Créer trop d'occurrences récurrentes (max 100)
6. ❌ Ne pas utiliser un format structuré pour actions et décisions

## 🎨 Codes Couleurs des Statuts

Dans la liste des meetings :

- 🔵 **Planifié** : Meeting à venir
- 🟠 **En Cours** : Meeting en train de se dérouler
- 🟢 **Terminé** : Meeting terminé avec CR
- 🟡 **Reporté** : Meeting replanifié
- 🔴 **Annulé** : Meeting annulé

## 📊 Statistiques et Rapports

### Rapports Disponibles

1. **Meetings par Type** : Répartition par type de meeting
2. **Meetings par Statut** : État des meetings
3. **Taux de Présence Moyen** : Par équipe / personne
4. **Actions en Cours** : Toutes les actions non terminées
5. **Décisions Stratégiques** : Historique des décisions importantes

### Créer un Rapport Personnalisé

1. Aller dans **Report Builder**
2. Sélectionner **Meeting Interne**
3. Choisir les champs à afficher
4. Ajouter des filtres
5. Sauvegarder le rapport

## 🚀 Fonctionnalités Avancées

### Intégration Calendrier

Les meetings avec **Date & Heure** apparaissent dans le calendrier Frappe :
1. Menu **Desk → Calendar**
2. Filtrer par **Meeting Interne**
3. Vue jour / semaine / mois

### API pour Intégrations

Les meetings peuvent être créés/modifiés via l'API Frappe :
- Endpoint : `/api/resource/Meeting Interne`
- Authentification : API Key / Token
- Documentation : Frappe API Docs

### Webhooks

Configurer des webhooks pour être notifié lors de :
- Création d'un nouveau meeting
- Changement de statut
- Ajout d'une action
- Prise d'une décision

## 📚 Pour Aller Plus Loin

- Consulter la documentation technique : `module_meetings_implementation.md`
- Configurer des permissions personnalisées par rôle
- Créer des dashboards personnalisés
- Automatiser avec des scripts personnalisés

---

**Version** : 1.1.0 (Structure Simplifiée)  
**Dernière mise à jour** : 28 octobre 2025  
**Développé par** : AURES Technologies
