# Guide utilisateur — Pilotage commercial

Ce guide explique comment utiliser la **fiche de pilotage commercial** dans l’ERP. Il s’adresse aux **managers**, **superviseurs** et **commerciaux** qui consultent ou alimentent ces informations.

---

## 1. À quoi ça sert ?

La fiche **Pilotage commercial** regroupe, **pour un utilisateur (commercial)** :

- son **cadre** : département, profil, zone, manager, type d’activité ;
- son **portefeuille** : nombre de clients attribués, grands comptes, clients actifs, taux de couverture des visites sur le mois ;
- ses **objectifs** (CA, visites, nouveaux clients, etc.) par période ;
- les **résultats calculés** : CA réalisé, visites, transformation, pourcentage d’atteinte des objectifs ;
- le **pilotage managérial** : priorité, reclassification, actions à mener ;
- un **historique** des indicateurs (snapshots).

Les chiffres de vente et d’activité viennent des **données déjà saisies** ailleurs dans le système (clients attribués, factures, visites commerciales). La fiche ne remplace pas la saisie terrain : elle **agrège** et **met à jour** ces informations lors d’un recalcul.

---

## 2. Qui voit quoi ?

En pratique (selon les rôles configurés sur votre site) :

| Profil | En général |
|--------|------------|
| **Commercial itinérant** | Peut **consulter sa propre** fiche de pilotage (celle liée à son compte utilisateur). |
| **Superviseur CRM**, **Administrateur ventes**, **administrateur système** | Peuvent **voir toutes** les fiches et **les modifier** (objectifs, notes, actions, etc.). |

Si un bouton ou une action n’apparaît pas, c’est souvent lié aux **droits** : demander à votre administrateur.

---

## 3. Avant de commencer : référentiels

Deux listes doivent exister (elles sont créées une fois, puis réutilisées) :

1. **Département commercial** — ex. Pharma, Agro, Industrie.  
2. **Profil commercial** — ex. Chasseur, KAM, terrain senior, etc.

**Menu :** cherchez ces intitulés dans la **recherche rapide** (icône loupe) ou dans le module **Aures CRM**, selon l’organisation de votre bureau.

Sans au moins une valeur dans chaque référentiel, vous ne pourrez pas valider une fiche **Pilotage commercial** en statut **Actif**.

---

## 4. Ouvrir le pilotage commercial

- **Raccourci** : depuis l’espace d’accueil **Home**, un lien peut pointer vers **Pilotage commercial** (si votre administrateur l’a activé).
- **Recherche** : tapez **Pilotage commercial** dans la barre de recherche, ouvrez la **liste**, puis la fiche souhaitée.

**Important :** il existe **une fiche par commercial** : le nom du document correspond au **compte utilisateur** (e-mail) du commercial.

---

## 5. Créer une nouvelle fiche

Réservé en général aux **managers** (droits d’écriture).

1. **Pilotage commercial** → **Nouveau**.
2. Renseignez **Utilisateur** : choisissez le **compte utilisateur** Frappe du commercial (pas la fiche « Employé »).
3. **Département commercial** et **Catégorie de profil** : choisissez dans les référentiels.
4. **Statut fiche** :  
   - **Actif** : fiche opérationnelle (champs obligatoires remplis).  
   - **En revue** : préparation ou audit.  
   - **Archivé** : commercial sorti du dispositif de pilotage courant.
5. Complétez l’onglet **Structure commerciale** (type terrain / hybride / interne, orientation portefeuille, zone, manager si besoin).
6. **Enregistrer**.

Tant que la fiche est **Actif**, le département, le profil, le type de commercial et l’orientation portefeuille sont **obligatoires**.

---

## 6. Parcourir les onglets

### Identité
Utilisateur, nom affiché, département, statut de la fiche.

### Structure commerciale
Profil, zone (territoire), type de commercial, responsable hiérarchique, orientation du portefeuille (fidélisation, prospection, mixte).

### Portefeuille
Indicateurs **calculés automatiquement** lors du recalcul :

- nombre de **comptes attribués** (clients dont ce commercial est le référent, selon les règles du CRM) ;
- **grands comptes** ;
- **clients actifs** ;
- **taux de couverture (mois)** : parmi les clients actifs, part de ceux ayant eu au moins une **visite commerciale validée** sur le **mois en cours**.

La **dernière synchro portefeuille** indique quand ces blocs ont été mis à jour.

### Discipline opérationnelle
- **Préparation hebdomadaire** et **respect des processus** : à renseigner ou ajuster **manuellement** (évaluation managériale).
- **Score discipline CRM** : calculé à partir de ces éléments et de l’activité visites par rapport à l’objectif.
- **Dernier contrôle managérial** : date de la dernière revue.

### Objectifs
- Table **Objectifs par période** : c’est ici que vous fixez les **cibles** (CA, visites, nouveaux clients, couverture, transformation) avec des **dates de début et de fin** et un type de période (mensuel, trimestriel, annuel).
- Les lignes du **mois en cours** alimentent les champs récapitulatifs au-dessus (objectifs CA mensuel / annuel, visites, nouveaux clients).
- **Verrouillé** : une ligne cochée **Verrouillé** n’est plus recalculée automatiquement (période clôturée).

**Conseil :** ne pas chevaucher deux lignes **pour la même métrique** et le **même type de période** sur des dates qui se recoupent ; le système refusera l’enregistrement.

### Statistiques
Résultats du **mois en cours** après recalcul : CA réalisé, % d’atteinte, visites, taux de transformation, date de dernière mise à jour des KPI.

### Reclassification / pilotage
- **Statut de reclassification** : positionnement managérial (stable, à surveiller, etc.).
- **Priorité managériale** et **score de priorité** : mis à jour **automatiquement** selon la performance, la discipline, les retards d’actions, etc.
- **Prochaine revue** : date cible pour le manager.
- **Actions à mener** : tableau des actions (type, priorité, échéance, personne assignée, statut).

### Commentaires
**Observations** (texte court) et **notes managérielles** (texte riche pour les comptes rendus de revue).

### Historique KPI
Tableau des **snapshots** : photographie des principaux indicateurs à une date donnée. Une ligne est créée ou mise à jour **chaque jour** lors d’un recalcul (pour le suivi dans le temps).

---

## 7. Mettre à jour les chiffres : « Recalculer les KPI »

Les indicateurs du portefeuille et des statistiques ne se mettent pas tous seuls à chaque frappe sur l’écran.

1. Ouvrez la fiche **Pilotage commercial**.
2. Cliquez sur le bouton **Recalculer les KPI** (visible si vous avez le **droit de modification** sur ce document).
3. La page se recharge avec les valeurs à jour.

**Fréquence recommandée :** après des changements importants (attribution clients, nombreuses factures ou visites). En complément, un **traitement automatique quotidien** peut recalculer toutes les fiches actives (selon la configuration de votre site).

---

## 8. Tableaux de bord

Des graphiques peuvent être ajoutés au bureau (ex. répartition par **département commercial** ou par **niveau de priorité**). Ils s’appuient sur les fiches **Pilotage commercial**. Demandez à votre administrateur de les attacher au **tableau de bord** ou à l’**espace de travail** que vous utilisez.

---

## 9. Bonnes pratiques

1. **Une fiche par commercial** : ne créez pas de doublon pour le même utilisateur.
2. **Objectifs réalistes et datés** : une ligne par période claire (ex. du 1er au dernier jour du mois pour un objectif mensuel).
3. **Verrouiller** les périodes passées pour figer le réalisé affiché sur la ligne d’objectif.
4. **Tenir à jour** les actions et la date de **prochaine revue** pour que le score de priorité reflète le suivi réel.
5. Les **commerciaux** : vérifier que vos **clients** sont bien attribués dans le CRM et que vos **visites** sont **soumises** ; sinon les KPI seront sous-estimés.

---

## 10. Questions fréquentes

**Pourquoi mon CA ou mes visites affichent zéro ?**  
Vérifiez qu’il existe des **factures de vente validées** ou des **visites commerciales validées** sur la période, pour des **clients** qui vous sont attribués, puis lancez **Recalculer les KPI**.

**Puis-je changer le commercial sur une fiche ?**  
Le document est lié à un **utilisateur** précis ; en cas de changement de personne, l’usage habituel est de **clôturer** l’ancienne fiche (statut **Archivé**) et d’en créer une **nouvelle** pour le nouvel utilisateur.

**Le responsable hiérarchique peut-il être le même que le commercial ?**  
Non, le système bloque cette situation.

---

*Document à destination des utilisateurs métier. Pour l’installation technique ou les évolutions, s’adresser à l’équipe informatique.*
