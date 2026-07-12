# Présentation du module Ressources Humaines

## Objectif
Le module `Ressources Humaines` centralise les informations du personnel : fiches employés, rattachement à un département/poste/site, suivi des contrats, historique des mouvements (embauche, changement de poste, sortie...) et visualisation de l'organisation via un organigramme interactif.

Il ne remplace pas encore un logiciel de paie ou de gestion des congés : c'est aujourd'hui un **référentiel RH** (qui travaille où, sous quel statut, avec quel responsable) plus un **suivi d'historique**.

## À qui s'adresse ce module
- **Équipe RH** : saisie et mise à jour des fiches employés, gestion des référentiels (départements, postes, sites, types de contrat).
- **Direction / Managers** : consultation (organigramme, rapports, tableau de bord), sans forcément de droit de modification.

## Fonctionnalités principales

### 1. Fiche Employé (`Employe`)
Fiche centrale de chaque collaborateur, organisée en onglets :
- **Statut RH** : identité, coordonnées, statut (`Pré-intégré`, `Actif`, `Inactif`, `Sorti`), date d'entrée / de sortie, motif de sortie.
- **Affectation** : département, poste, site, type de contrat, responsable hiérarchique.
- **Informations administratives** : NIN, pièce d'identité, numéro CNAS, compte bancaire.
- **Documents** : pièces jointes classées par type (contrat, diplôme, CV, certificat médical, etc.).
- **Données système** : lien éventuel avec un compte utilisateur ERP.

Le `Nom complet` est généré automatiquement (prénom + nom, avec mise en forme automatique : nom en majuscules, prénom avec majuscule initiale).

### 2. Référentiels RH
Quatre listes de base à administrer par l'équipe RH :
- `Département RH` (avec hiérarchie parent/enfant, responsable, couleur)
- `Poste RH` (avec niveau : Direction, Responsable, Superviseur, Agent, Technicien, Opérateur, Support, Autre)
- `Site RH` (avec hiérarchie parent/enfant, type de site, responsable, couleur)
- `Type Contrat RH` (CDI, CDD, Stage, etc.)

Les `Département RH` et `Site RH` reçoivent automatiquement une **couleur distincte** à la création (utilisée dans l'organigramme), modifiable manuellement si besoin.

### 3. Suivi des mouvements (`Mouvement Employe`)
Chaque changement d'affectation d'un employé (département, poste, site, responsable hiérarchique, statut) génère **automatiquement** une entrée d'historique, avec l'ancienne et la nouvelle valeur. Ceci constitue le registre des entrées, sorties, changements de poste/département/site et réintégrations, sans action manuelle de l'équipe RH.

### 4. Organigramme interactif
Page dédiée (`Organigramme`) proposant trois vues :
- **Hiérarchie** : arbre des employés selon leur responsable hiérarchique (avec filtre pour zoomer sur un employé et voir sa chaîne hiérarchique jusqu'à la direction).
- **Départements** : arbre des départements avec effectif par département (cumulé avec les sous-départements).
- **Sites** : arbre des sites avec effectif par site.

Filtrable par statut, département, site ou employé.

### 5. Rapports
- `Registre des employés` : liste complète filtrable (statut, département, poste, site, type de contrat).
- `Employés actifs par département` : effectif actif par département, avec graphique.
- `Employés par site` : effectif actif par site, avec graphique.

### 6. Tableau de bord (Workspace `Ressources Humaines`)
Page d'accueil du module avec compteurs (employés actifs / sortis / pré-intégrés) et raccourcis vers toutes les fonctionnalités ci-dessus.

## Automatisations clés (aucune action manuelle requise)
- Génération du `Nom complet` et normalisation nom/prénom.
- Calcul du champ `Actif pour opérations` selon le statut.
- Contrôle des champs obligatoires selon le statut (ex. : département/poste/site/type de contrat obligatoires si `Actif` ; date et motif de sortie obligatoires si `Sorti`).
- Contrôle d'unicité du matricule, du NIN et du numéro CNAS.
- Création automatique d'un `Mouvement Employe` à chaque changement d'affectation.
- Attribution automatique d'une couleur aux départements et aux sites.

## Rôles et accès

| Rôle | Droits |
|---|---|
| `RH Manager` | Accès complet (création, modification, suppression) sur toutes les données RH |
| `RH User` | Création et modification, sans suppression |
| `RH Viewer` | Lecture seule |
| `Direction` | Lecture seule (accès transverse) |
| `System Manager` | Accès complet, administration du système |

## Prérequis avant de démarrer

1. **Attribution des rôles** : chaque membre de l'équipe RH doit avoir le rôle `RH Manager` ou `RH User` selon son niveau de responsabilité ; les managers/direction qui doivent seulement consulter reçoivent `RH Viewer` ou `Direction`.
2. **Comptes utilisateurs** : chaque personne devant utiliser le module doit disposer d'un compte utilisateur ERP actif avec accès au Bureau (Desk).
3. **Vérification des référentiels de base** (déjà pré-remplis à l'installation, à valider/compléter) :
   - Types de contrat : CDI, CDD, Stage, Apprentissage, Temporaire, Prestataire, Autre.
   - Départements : Direction Générale, Commercial, Back-Office, Prépresse, Production, Qualité, Maintenance, Finance, Administration, Ressources Humaines.
   - Un site par défaut (« Siège / Usine principale ») — à compléter avec les sites réels de l'entreprise.
4. **Création des postes** (`Poste RH`) : à faire entièrement par l'équipe RH, aucun poste n'est pré-rempli.
5. **Décisions organisationnelles à préparer avant la saisie en masse** :
   - Qui est responsable de quel département / site (pour renseigner `Responsable du département` / `Responsable du site`).
   - La chaîne hiérarchique de chaque employé (`Responsable hiérarchique`), utilisée par la vue Hiérarchie de l'organigramme.
6. **Documents administratifs** : avoir sous la main les pièces à joindre aux fiches employés (CNI, contrat, CV, etc.) si la saisie initiale doit inclure les documents.

## Hors périmètre actuel
Le module ne couvre pas aujourd'hui : la paie, les congés, le pointage, l'évaluation ou la formation des employés. Ces éléments sont prévus pour évoluer plus tard en s'appuyant sur la fiche `Employe` comme référentiel central.
