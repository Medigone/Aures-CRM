# Guide Utilisateur : Module de Production

## 🎯 Vue d'ensemble

Le module de production permet de gérer l'intégralité du processus de fabrication, depuis la définition des routes de production jusqu'à la traçabilité complète des unités produites avec QR codes.

## 🚀 Démarrage Rapide

### Accès au Module

1. Ouvrir le **Workspace Production** depuis le menu principal
2. Trois sections principales :
   - **Production** : Gestion quotidienne
   - **Raccourcis** : Accès rapides aux ordres
   - **Configuration** : Paramètres

## 📋 Étape 1 : Configurer les Routes de Production

### Qu'est-ce qu'une Route ?

Une route est un **template** définissant les étapes standard pour un type de production (ex: Offset 4 couleurs, Flexo 6 couleurs).

### Créer une Route

1. Aller dans **Production → Route de Production**
2. Cliquer **Nouveau**
3. Remplir :
   - **Nom de la route** : "Offset 4C Standard"
   - **Procédé** : Offset / Flexo / Hélio
   - **Type de finition** : Standard / Vernis / etc.
   - **Route active** : ✓ Cocher
4. Ajouter les étapes dans le tableau :

| Ordre | Nom Étape | Type | Workstation | Passages | Durée (h) |
|-------|-----------|------|-------------|----------|-----------|
| 1 | Impression | Impression | Presse-01 | 1 | 2.5 |
| 2 | Découpe | Découpe | Decoupe-01 | 1 | 1.0 |
| 3 | Pliage | Finition | Plieuse-01 | 1 | 0.5 |
| 4 | Collage | Finition | Collage-01 | 1 | 0.75 |

5. **Sauvegarder**

### ⚠️ Passages Multiples

Si vous avez 6 couleurs sur une machine 5 couleurs :
- Mettre **Nombre de passages = 2**
- L'ordre créera automatiquement "Impression - Passage 1" et "Impression - Passage 2"

## 📦 Étape 2 : Créer un Ordre de Production

### Depuis une Étude Technique

1. Ouvrir une **Étude Technique** soumise
2. Cliquer sur **Créer Ordre de Production** (bouton Production)
3. L'ordre est créé automatiquement avec :
   - Référence à l'étude, commande, client, article
   - Étapes copiées depuis la route du procédé
   - Passages multiples gérés automatiquement
   - Statut : Nouveau

### Ordre Créé !

Vous êtes redirigé vers l'Ordre de Production nouvellement créé.

## 📅 Étape 3 : Planifier l'Ordre

### Planification Automatique

1. Dans l'ordre (statut **Nouveau**), cliquer **Planifier Automatiquement**
2. Le système :
   - Répartit les étapes dans le temps
   - Utilise les durées estimées
   - Ajoute des buffers entre étapes
   - Calcule la date de fin prévue

### Planification Manuelle

Pour chaque étape :
1. Cliquer **Planifier → [Nom étape]**
2. Saisir :
   - Date/heure début
   - Date/heure fin
   - Workstation (modifiable)
   - Opérateur planifié
3. **Planifier**

### ⚠️ Alertes

- Si date fin prévue > délai livraison : **Alerte rouge**
- Si priorité "Très Urgente" : **Alerte rouge dans dashboard**

## 📊 Dashboard Visuel

L'ordre affiche un dashboard temps réel :

```
Progression: 50%
█████████████████████████░░░░░░░░░░░░░░

┌───────────────────────────────────────────────┐
│ # │ Étape          │ Statut    │ Temps        │
├───┼────────────────┼───────────┼──────────────┤
│ 1 │ Impression P1  │ Terminée  │ Réel: 2.3h ✓ │
│ 2 │ Impression P2  │ En cours  │ Prévu: 2.5h  │
│ 3 │ Découpe        │ En attente│ Prévu: 1.0h  │
│ 4 │ Pliage         │ En attente│ Prévu: 0.5h  │
└───────────────────────────────────────────────┘
```

**Codes couleurs** :
- 🔵 En attente
- 🟠 En cours
- 🟢 Terminée
- 🔴 En pause

## ✅ Étape 4 : Soumettre l'Ordre

1. Une fois planifié, cliquer **Soumettre**
2. Statut passe à **Planifié**
3. L'ordre est verrouillé et prêt pour production

## 🏭 Étape 5 : Exécuter la Production

### Démarrer une Étape

1. Cliquer **Démarrer → [Nom étape]**
2. Confirmer
3. L'étape passe en **En cours**
4. Date/heure début réelle est enregistrée
5. Si c'est la première étape, l'ordre passe en **En Production**

### Terminer une Étape

1. Cliquer **Terminer → [Nom étape]**
2. Saisir dans le dialogue :
   - **Quantité OK** : nombre de pièces bonnes
   - **Quantité rebutée** : nombre de pièces défectueuses
   - **Observations** : notes éventuelles
3. Cliquer **Terminer**
4. L'étape passe en **Terminée**
5. Durée réelle et écart sont calculés automatiquement
6. Si toutes les étapes sont terminées, l'ordre passe en **Terminé**

### Mettre en Pause

Si un problème survient :
1. Cliquer **Pause → [Nom étape]**
2. Saisir la **raison** de la pause
3. L'étape et l'ordre passent en **En Pause**

### Reprendre

1. Cliquer **Reprendre → [Nom étape]**
2. L'étape et l'ordre passent en **En cours** / **En Production**

## 📦 Étape 6 : Créer des Unités de Production (Palettes)

### Qu'est-ce qu'une Unité ?

Une unité = une palette, bobine, lot ou caisse physique qu'on veut tracer individuellement.

### Créer une Unité

1. Aller dans **Production → Unite de Production**
2. Cliquer **Nouveau**
3. Remplir :
   - **Ordre de Production** : sélectionner l'ordre
   - **Type d'unité** : Palette / Bobine / Lot
   - **Quantité** : nombre de pièces sur la palette
   - **Poids**, **Dimensions** (optionnel)
   - **Numéro lot matière première** : traçabilité amont
4. **Sauvegarder**

### QR Code Automatique

Dès la sauvegarde :
- Un **QR code** est généré automatiquement
- Format : `OP-2025-001-P-001-251025`
- Le QR pointe vers le document dans Frappe

### Imprimer l'Étiquette

1. Cliquer **Imprimer Étiquette**
2. Une fenêtre s'ouvre avec :
   - Numéro unique
   - Informations ordre/article
   - QR code
3. Imprimer et coller sur la palette

## 📱 Étape 7 : Scanner et Tracer les Unités

### Scanner l'Entrée dans une Étape

Quand une palette arrive à une étape :

1. Ouvrir l'**Unite de Production** (via QR ou recherche)
2. Cliquer **Scanner → Scanner Entrée Étape**
3. Saisir :
   - **Nom de l'étape** : "Découpe"
   - **Opérateur** : sélectionner
4. Cliquer **Scanner**
5. L'entrée est enregistrée avec timestamp

### Scanner la Sortie de l'Étape

Quand la palette sort de l'étape :

1. Cliquer **Scanner → Scanner Sortie Étape**
2. Saisir :
   - **Nom de l'étape** : "Découpe"
   - **Quantité OK**
   - **Quantité rebut**
   - **Observations** (optionnel)
3. Cliquer **Scanner**
4. La sortie est enregistrée
5. L'historique est mis à jour

### Consulter l'Historique

L'onglet **Historique des étapes** affiche :
- Toutes les étapes franchies
- Dates/heures entrée et sortie
- Opérateurs
- Quantités traitées

## 🔍 Étape 8 : Suivre et Analyser

### Raccourcis Workspace

- **Ordres en Production** : voir tous les ordres actifs
- **Ordres Urgents** : filtrer par priorité
- **Ordres à Planifier** : ordres nouveaux non planifiés
- **Ordres en Pause** : ordres bloqués

### Dashboard Ordre

- **Progression** : % d'avancement
- **Temps** : prévu vs réel, écarts par étape
- **Quantités** : OK, rebutées, taux de rebut
- **Statuts** : état de chaque étape en temps réel

### Auto-refresh

Si un ordre est **En Production**, le dashboard se rafraîchit automatiquement toutes les **30 secondes**.

## 🎛️ Fonctions Avancées

### Modifier la Planification

Même après soumission, vous pouvez :
1. Cliquer **Planifier → [Nom étape]** sur une étape
2. Modifier dates, workstation, opérateur
3. **Planifier**

### Ajouter des Matières

Sur chaque étape, onglet **Matières** :
1. Cliquer **Ajouter ligne**
2. Sélectionner :
   - **Type** : Entrant / Sortant
   - **Item** : article consommé ou produit
   - **Numéro lot fournisseur**
   - **Quantités**
3. Sauvegarder

### Ajouter des Photos

Chaque étape peut avoir des **Photos** attachées :
- Cliquer sur le champ **Photos**
- Télécharger l'image
- Utile pour contrôle qualité

## 📞 Support et Questions Fréquentes

### Comment annuler un ordre ?

1. Ouvrir l'ordre
2. Menu **Actions → Annuler**
3. Statut passe à **Annulé**

### Que faire si je me suis trompé de workstation ?

Modifier la planification de l'étape (voir Fonctions Avancées).

### Puis-je avoir plusieurs passages sur différentes machines ?

Oui ! Dans la Route, créez plusieurs étapes :
- Étape 1 : Impression - Passage 1 (Machine A)
- Étape 2 : Impression - Passage 2 (Machine B)

### Comment voir l'historique de modifications ?

Chaque DocType a un suivi des modifications activé. Cliquer sur **Info** (ⓘ) dans le formulaire.

## 🎓 Bonnes Pratiques

1. **Créer des routes standards** pour chaque type de production
2. **Planifier dès la création** pour anticiper les ressources
3. **Scanner systématiquement** les palettes pour traçabilité
4. **Saisir les observations** en cas de problème
5. **Vérifier le dashboard** régulièrement pendant production
6. **Marquer en Urgente** les ordres prioritaires
7. **Utiliser les pauses** pour tracer les arrêts machines

## 📚 Pour Aller Plus Loin

- Consulter la documentation technique : `module_production_implementation.md`
- Configurer les permissions par rôle
- Créer des rapports personnalisés
- Exporter les données pour analyse

---

**Besoin d'aide ?** Contactez le support technique AURES.

