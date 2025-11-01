# Guide Utilisateur : Module de Conception Maquette

## 🎯 Vue d'ensemble

Le module de gestion des conceptions de maquettes permet de suivre et gérer la charge de travail des infographes avec :
- Suivi des demandes de conception pour les articles clients
- Système de points d'effort pour estimer la charge (Simple/Moyen/Complexe)
- **Traçabilité précise du temps** avec date/heure de début et fin
- **Calcul automatique du temps total** passé sur chaque conception
- Gestion des priorités (Normale/Haute/Urgente)
- Workflow de validation (Nouveau → En Cours → Terminé → Validé)
- Liaison avec les maquettes créées automatiquement
- Visibilité pour les équipes commerciales sur l'avancement

## 🚀 Démarrage Rapide

### Accès au Module

1. Rechercher **"Conception Maquette"** dans la barre de recherche Frappe
2. Ou utiliser le menu **Aures CRM → Conception Maquette**

## 📋 Étape 1 : Créer une Demande de Conception

### Création d'une Nouvelle Conception

1. Aller dans **Conception Maquette**
2. Cliquer **Nouveau**
3. Remplir les informations obligatoires :

```
┌─────────────────────────────────────────┐
│ Statut: Nouveau ▼                       │
│ Priorité: Normale ▼                     │
├─────────────────────────────────────────┤
│ INFORMATIONS DE BASE                    │
├─────────────────────────────────────────┤
│ Client: ACME Corporation ▼              │
│ Nom Client: ACME Corp [auto]           │
├─────────────────────────────────────────┤
│ Article: CLI-ACME-BOX-001 ▼            │
│ Désignation: Boîte carton [auto]       │
├─────────────────────────────────────────┤
│ Description de la demande:              │
│ Créer une maquette pour une nouvelle   │
│ boîte avec le logo ACME...             │
└─────────────────────────────────────────┘
```

4. **Sauvegarder**

> 💡 **Note** : Un numéro unique est généré automatiquement au format `CONC-2025-00001`

## 👤 Étape 2 : Assigner et Estimer

### Assigner un Infographe

1. Dans la section **Assignation et Charge** :
   - **Infographe assigné** : Sélectionner l'infographe disponible
   - **Nom Infographe** : Se remplit automatiquement
   
2. Définir les **Points d'effort** :
   - **1 - Simple** : Modification mineure, ajustement de couleurs
   - **2 - Moyen** : Création standard, quelques éléments complexes
   - **3 - Complexe** : Création complète, design élaboré, nombreux détails

```
┌─────────────────────────────────────────┐
│ ASSIGNATION ET CHARGE                   │
├─────────────────────────────────────────┤
│ Infographe assigné: john@aures.dz ▼    │
│ Nom Infographe: John Dupont [auto]     │
├─────────────────────────────────────────┤
│ Points d'effort: 2 - Moyen ▼           │
└─────────────────────────────────────────┘
```

3. **Sauvegarder**

### Ajuster la Priorité

Si besoin, modifier la priorité :
- **Normale** : Traitement standard
- **Haute** : À traiter rapidement
- **Urgente** : Production bloquée, traiter immédiatement

> ⚠️ **Important** : Les priorités Haute et Urgente affichent des alertes visuelles dans le formulaire.

## 🎨 Étape 3 : Travailler sur la Conception

### Démarrer le Travail

1. L'infographe ouvre la conception qui lui est assignée
2. Change le **Statut** à **En Cours**
3. **Sauvegarder**

> 📅 **Automatique** : La **Date et heure début** est enregistrée automatiquement lors du passage en "En Cours" (date et heure précises)

### Pendant la Conception

L'infographe peut utiliser le champ **Notes internes** pour :
- Noter les choix de design
- Documenter les échanges avec le client
- Indiquer les difficultés rencontrées
- Référencer les fichiers sources utilisés

```
┌─────────────────────────────────────────┐
│ LIAISON AVEC RÉSULTAT                   │
├─────────────────────────────────────────┤
│ Maquette créée: [sera lié plus tard]   │
├─────────────────────────────────────────┤
│ Notes internes:                         │
│ - Utilisation du template standard     │
│ - Ajustement des couleurs Pantone      │
│ - 3 révisions demandées par client     │
└─────────────────────────────────────────┘
```

## ✅ Étape 4 : Terminer la Conception

### Marquer comme Terminé

Quand la conception est finalisée :

1. Lier la **Maquette créée** (si elle existe déjà dans le système)
2. Changer le **Statut** à **Terminé**
3. **Sauvegarder**

> 📅 **Automatique** : La **Date et heure fin** est enregistrée automatiquement avec le **temps total** calculé

```
┌─────────────────────────────────────────┐
│ Statut: Terminé ▼                       │
├─────────────────────────────────────────┤
│ SUIVI DES DATES                         │
├─────────────────────────────────────────┤
│ Date création: 28/10/2025 [auto]       │
│ Date/heure début: 28/10/2025 09:30     │
│ Date/heure fin: 29/10/2025 14:45       │
│ Date validation: [vide]                │
├─────────────────────────────────────────┤
│ TEMPS DE TRAVAIL                        │
├─────────────────────────────────────────┤
│ Temps total: 29.25 heures [auto]       │
└─────────────────────────────────────────┘
```

> ⏱️ **Calcul automatique** : Le système calcule automatiquement le temps total en heures entre le début et la fin de la conception.

## 🎯 Étape 5 : Valider la Conception

### Validation par le Responsable

Le **Responsable Prepresse** valide la conception :

1. Vérifier la qualité de la maquette
2. S'assurer que tous les critères sont respectés
3. Changer le **Statut** à **Validé**
4. **Sauvegarder**

> 📅 **Automatique** : La **Date validation** est enregistrée automatiquement

> ⚠️ **Validation** : Impossible de valider une conception sans l'avoir terminée au préalable. Le système affichera une erreur.

## 🔍 Suivi de la Charge de Travail

### Pour les Responsables Prepresse

#### Vue d'ensemble des Conceptions

1. Aller dans **Liste Conception Maquette**
2. Utiliser les **filtres standards** :
   - **Par Statut** : Voir toutes les conceptions "En Cours"
   - **Par Infographe** : Voir la charge d'un infographe
   - **Par Points d'effort** : Identifier les conceptions complexes

#### Calculer la Charge par Infographe

Pour voir la charge totale d'un infographe :

```
Exemple :
┌────────────────────────────────────────────┐
│ Infographe : John Dupont                   │
├────────────────────────────────────────────┤
│ Conceptions en cours:                      │
│ - CONC-2025-00001 : 2 points (Moyen)     │
│ - CONC-2025-00005 : 3 points (Complexe)  │
│ - CONC-2025-00008 : 1 point (Simple)     │
├────────────────────────────────────────────┤
│ TOTAL : 6 points en cours                 │
└────────────────────────────────────────────┘
```

#### Analyser le Temps Réel

Avec les conceptions terminées, analysez les temps réels :

```
Exemple d'analyse :
┌─────────────────────────────────────────────────────┐
│ Infographe : John Dupont - Mois d'octobre          │
├─────────────────────────────────────────────────────┤
│ Conceptions terminées: 8                           │
├─────────────────────────────────────────────────────┤
│ Temps moyen par complexité:                        │
│ - Simple (1 point)   : 4.5 heures en moyenne      │
│ - Moyen (2 points)   : 12.3 heures en moyenne     │
│ - Complexe (3 points): 28.7 heures en moyenne     │
├─────────────────────────────────────────────────────┤
│ TOTAL temps travaillé : 156.2 heures              │
└─────────────────────────────────────────────────────┘
```

> 💡 **Astuce** : Utilisez la fonction **Export** pour exporter les données et calculer les statistiques dans Excel. Le champ **temps_total** permet une analyse précise des performances.

### Pour les Commerciaux

Les commerciaux peuvent consulter l'avancement :

1. Ouvrir une **Conception Maquette**
2. Voir le **Statut** et les **Dates**
3. Consulter l'**Infographe assigné**
4. Lire les **Notes internes** (si besoin)

> 📖 **Permissions** : Les commerciaux ont un accès en **lecture seule**.

## 📊 Filtres et Recherches

### Filtres Rapides Utiles

#### Voir les Conceptions Urgentes
1. **Filtres** → **Priorité** = "Urgente"
2. **Afficher**

#### Voir les Conceptions d'un Client
1. **Filtres** → **Client** = "ACME Corp"
2. **Afficher**

#### Voir les Conceptions Non Assignées
1. **Filtres** → **Infographe assigné** = "Est vide"
2. **Afficher**

#### Voir la Charge d'un Infographe
1. **Filtres** → **Infographe assigné** = "john@aures.dz"
2. **Filtres** → **Statut** = "En Cours" ou "Nouveau"
3. **Afficher**

## 🔄 Gestion des Statuts

### Workflow des Statuts

```
NOUVEAU
  ↓
EN COURS (Date début enregistrée)
  ↓
TERMINÉ (Date fin enregistrée)
  ↓
VALIDÉ (Date validation enregistrée)
```

### Statut Annulé

Si une conception n'est plus nécessaire :

1. Changer le **Statut** à **Annulé**
2. Ajouter une note dans **Notes internes** expliquant pourquoi
3. **Sauvegarder**

> 📝 **Note** : Une conception annulée ne peut plus être modifiée mais reste visible pour historique.

### Retour en Arrière

Si vous changez le statut en arrière (ex: de "Terminé" à "En Cours") :
- Les dates futures sont **automatiquement effacées**
- Exemple : Passer de "Terminé" à "En Cours" efface la date_fin

## 📧 Notifications et Commentaires

### Suivre les Changements

Le système enregistre automatiquement :
- Les changements de statut dans les commentaires
- L'historique complet des modifications (onglet **Info** ⓘ)
- Qui a modifié quoi et quand

### Ajouter des Commentaires

1. Faire défiler vers le bas du formulaire
2. Section **Commentaires**
3. Ajouter un commentaire
4. Les participants peuvent être notifiés

## 🎨 Liaison avec les Maquettes

### Lier une Maquette Existante

Si la maquette a déjà été créée automatiquement lors de la création de l'article :

1. Dans **Liaison avec résultat**
2. Champ **Maquette créée** : Sélectionner la maquette
3. **Sauvegarder**

> 💡 **Info** : Les maquettes sont générées automatiquement lors de la création des articles. Vous n'avez qu'à créer le lien.

### Accéder à la Maquette

Une fois liée, cliquer sur le nom de la maquette pour l'ouvrir dans un nouvel onglet.

## 📞 Support et Questions Fréquentes

### Comment réassigner une conception à un autre infographe ?

1. Ouvrir la conception
2. Changer **Infographe assigné**
3. **Sauvegarder**
4. (Optionnel) Ajouter un commentaire expliquant le changement

### Que faire si je veux changer les points d'effort ?

Les points d'effort peuvent être modifiés à tout moment :
1. Ouvrir la conception
2. Modifier **Points d'effort**
3. **Sauvegarder**

### Comment voir toutes mes conceptions assignées ?

En tant qu'infographe :
1. Liste **Conception Maquette**
2. **Filtres** → **Infographe assigné** = votre email
3. **Filtres** → **Statut** ≠ "Validé" et ≠ "Annulé"
4. **Afficher**

### Puis-je valider sans terminer ?

Non, le système empêche de passer au statut "Validé" sans avoir d'abord passé par "Terminé". 

**Message d'erreur** :
```
Erreur de transition de statut

Impossible de valider une conception qui n'a pas été terminée.
Veuillez d'abord passer le statut à 'Terminé'.
```

### Comment voir l'historique des modifications ?

1. Ouvrir la conception
2. Cliquer sur **ⓘ Info** en haut à droite
3. Onglet **Versions** affiche toutes les modifications

### Combien de temps une conception prend-elle selon les points ?

Les points sont indicatifs et dépendent de votre contexte :

**Recommandations générales (temps de travail effectif)** :
- **1 point (Simple)** : 2 à 6 heures
- **2 points (Moyen)** : 8 à 16 heures
- **3 points (Complexe)** : 20 à 40 heures

> 📊 **Analyse** : Après quelques semaines d'utilisation, analysez vos données avec le champ **temps_total** pour ajuster ces estimations à votre réalité.

### Comment est calculé le temps total ?

Le **temps total** est calculé automatiquement par le système :
- **Début du chronomètre** : Quand vous passez au statut "En Cours"
- **Fin du chronomètre** : Quand vous passez au statut "Terminé"
- **Calcul** : Différence entre date/heure fin et date/heure début, en heures

**Exemple** :
```
Date/heure début : 28/10/2025 à 09:30
Date/heure fin   : 29/10/2025 à 14:45
Temps total      : 29.25 heures
```

> ⚠️ **Important** : Le temps inclut les heures hors travail (nuits, week-ends). Ce temps représente le délai total, pas uniquement le temps de travail actif.

### Comment traquer uniquement le temps de travail actif ?

Si vous voulez traquer uniquement le temps de travail effectif (sans les pauses, nuits, etc.) :

**Option 1 : Utiliser les Notes internes**
- Noter manuellement le temps réel dans les notes internes
- Exemple : "Temps réel : 6h30"

**Option 2 : Pause et Reprise**
- Passer en statut "En Pause" pendant les pauses longues
- ⚠️ Nécessiterait une modification du système (non implémenté actuellement)

**Option 3 : Analyse manuelle**
- Exporter les données
- Calculer le temps en tenant compte des horaires de travail (8h-17h par exemple)

## 🎓 Bonnes Pratiques

### ✅ À FAIRE

1. **Assigner immédiatement** : Assigner les conceptions dès leur création
2. **Estimer précisément** : Utiliser les bons points d'effort pour une charge équilibrée
3. **Mettre à jour régulièrement** : Changer les statuts au fur et à mesure
4. **Documenter** : Utiliser les notes internes pour traçabilité
5. **Lier les maquettes** : Toujours lier la maquette finale créée
6. **Respecter les priorités** : Traiter les urgentes en premier
7. **Communiquer** : Utiliser les commentaires pour coordination
8. **Valider rapidement** : Ne pas laisser des conceptions terminées en attente

### ❌ À ÉVITER

1. ❌ Laisser des conceptions non assignées
2. ❌ Ne pas mettre à jour les statuts
3. ❌ Sous-estimer ou surestimer systématiquement
4. ❌ Oublier de lier la maquette finale
5. ❌ Ne pas documenter les problèmes rencontrés
6. ❌ Ignorer les priorités urgentes
7. ❌ Valider sans vérification approfondie

## 🎨 Codes Couleurs des Statuts

Dans la liste des conceptions :

- 🔵 **Nouveau** : Conception créée, en attente d'assignation/début
- 🟠 **En Cours** : Infographe travaille dessus
- 🟣 **Terminé** : Conception finalisée, en attente de validation
- 🟢 **Validé** : Conception validée et prête
- 🔴 **Annulé** : Conception annulée

## 📊 Indicateurs de Performance

### Métriques à Suivre (Responsables)

**Hebdomadairement** :
- Nombre de conceptions créées
- Nombre de conceptions validées
- Temps moyen entre création et validation
- Répartition de la charge par infographe
- **Temps total travaillé par infographe**

**Mensuellement** :
- Répartition par points d'effort (combien de 1, 2, 3)
- Taux d'urgence (% de conceptions urgentes)
- **Temps moyen par type de complexité (analyse du champ temps_total)**
- **Temps réel vs estimation (points d'effort)**
- Nombre de conceptions annulées
- **Total heures travaillées par équipe**

**Analyses avancées avec le temps_total** :
- Comparer les estimations (points) avec le temps réel
- Identifier les conceptions qui prennent plus de temps que prévu
- Optimiser les estimations futures basées sur l'historique
- Calculer la productivité par infographe (conceptions/heure)

### Créer un Rapport

1. Aller dans **Report Builder**
2. Sélectionner **Conception Maquette**
3. Choisir les champs :
   - Client
   - Article
   - Infographe assigné
   - Points d'effort
   - Statut
   - Date création
   - Date début
   - Date fin
   - **Temps total** ⭐
   - Date validation
4. Ajouter des filtres (ex: Mois en cours, Statut = "Terminé" ou "Validé")
5. **Générer** et **Sauvegarder**

**Exemple de rapport utile** : "Temps par complexité"
- Filtrer : Statut = "Terminé" ou "Validé"
- Grouper par : Points d'effort
- Calculer : Moyenne de Temps total
- Résultat : Temps moyen réel pour chaque niveau de complexité

## 🚀 Fonctionnalités Avancées

### Recherche Globale

Dans la barre de recherche Frappe :
- Taper le numéro : `CONC-2025-00001`
- Taper le client : `ACME`
- Taper l'article : `CLI-ACME-BOX-001`

### Export des Données

1. Liste **Conception Maquette**
2. Appliquer les filtres souhaités
3. Menu **Actions** → **Export**
4. Choisir le format (Excel, CSV)
5. Télécharger

### Tableaux de Bord Personnalisés

Créer un dashboard avec :
- Nombre de conceptions par statut (graphique)
- Charge par infographe (graphique)
- Conceptions urgentes (liste)
- Temps moyen de traitement (KPI)

## 🔗 Intégrations

### Lien avec Customer

Chaque conception est liée à un client. Pour voir toutes les conceptions d'un client :
1. Ouvrir la fiche **Customer**
2. Section **Liens** ou **Connexions**
3. Voir la liste des conceptions

### Lien avec Item (Article)

Pour voir toutes les conceptions d'un article :
1. Ouvrir la fiche **Item**
2. Section **Liens**
3. Voir les conceptions liées

### Lien avec Maquette

Une fois la maquette liée :
- Accès direct depuis la conception
- Voir les spécifications couleurs (CMJN, Pantone)
- Consulter le fichier maquette image

## 📚 Pour Aller Plus Loin

- Créer des dashboards personnalisés pour votre équipe
- Configurer des permissions avancées par département
- Automatiser avec des scripts (ex: notifications Slack)
- Intégrer avec un outil de gestion de projet externe

---

**Version** : 1.0.0  
**Dernière mise à jour** : 29 octobre 2025  
**Développé par** : AURES Technologies  
**Support** : support@aures.dz

## 💡 Conseils par Rôle

### Pour les Responsables Prepresse

🎯 **Vos priorités** :
- Assigner équitablement la charge entre infographes
- Surveiller les conceptions urgentes
- Valider rapidement les conceptions terminées
- Analyser les métriques pour optimiser les délais

### Pour les Infographes

🎨 **Vos priorités** :
- Mettre à jour les statuts en temps réel
- Documenter votre travail dans les notes
- Signaler rapidement les blocages
- Lier systématiquement les maquettes finales

### Pour les Commerciaux

👔 **Ce que vous pouvez faire** :
- Consulter l'avancement des conceptions de vos clients
- Voir qui travaille sur quoi
- Connaître les délais estimés
- Communiquer avec l'équipe via commentaires

---

**Besoin d'aide ?** Contactez votre Responsable Prepresse ou le support technique.

