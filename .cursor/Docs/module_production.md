Plan : Module de Gestion de Production

Vue d'ensemble

Création d'un système de production modulaire permettant de :

Définir des routes de production par type d'article (options/finitions)

Suivre chaque étape avec entrants/sortants, opérateurs et temps

Gérer les priorités et pauses de production

Lier avec (BOM, Stock)

Architecture des DocTypes

1. Route de Production (Template)

DocType : Route de Production

Définit le template d'étapes pour un type de procédé/finition

Champs principaux :

Nom de la route

Procédé (Offset, Flexo, etc.)

Type de finition

Description

Child Table : Étapes de la route

Child Table : Etape Route

Ordre/séquence

Nom de l'étape (Impression, Découpe, Pliage, Collage, etc.)

Type d'étape

Poste de travail (Workstation)

Durée estimée

Besoins en matières (optionnel)

2. Ordre de Production (Principal)

DocType : Ordre de Production

Document principal qui suit toute la production

Champs principaux :

Références :

Etude Technique (link)

Sales Order (link)

Client (fetch)

Article (fetch)

BAT (fetch)

Statut global :

Statut : Nouveau / En Production / En Pause / Terminé / Annulé

Étape actuelle

Priorité (Normale / Urgente / Très Urgente)

Temps :

Date début prévue

Date fin prévue

Date début réelle

Date fin réelle

Temps total (calculé)

Production :

Quantité à produire

Quantité produite

Quantité rebutée

Route de production (link)

Child Table : Étapes de production

Child Table : Etape Production

Numéro d'étape

Nom de l'étape

Statut : En attente / En cours / Terminée / En pause

Opérateurs :

Opérateur (User)

Responsable (User)

Superviseur (User)

Temps :

Date/heure début

Date/heure fin

Durée (calculé)

Temps d'arrêt

Matières :

Entrants (JSON/Text ou Child Table séparée)

Sortants (JSON/Text ou Child Table séparée)

Consommation matière

Poste de travail :

Workstation (link)

Machine

Résultats :

Quantité traitée

Quantité OK

Quantité rebutée

Observations/Notes

Photos/Pièces jointes

3. Unité de Production (Palette/Lot)

DocType : Unite de Production

Document de traçabilité pour chaque palette/lot

Champs principaux :

Identification :

Numéro unique (auto-généré)

QR Code (généré automatiquement)

Code-barres

Ordre de Production (link)

Contenu :

Type d'unité (Palette, Bobine, Lot, etc.)

Article (link)

Quantité (nombre de pièces sur la palette)

Poids

Dimensions

Traçabilité :

Numéro de lot matière première

Date/heure création

Étape actuelle

Statut : En production / Terminée / En attente / Rebutée

Localisation actuelle (Workstation/Zone)

Production :

Quantité OK

Quantité défectueuse

Observations par étape

Opérateur actuel

Child Table : Historique des étapes

Child Table : Historique Etape Unite

Étape

Date/heure entrée

Date/heure sortie

Opérateur

Quantité traitée

Quantité OK

Quantité rebut

Observations

Scan QR (timestamp)

4. Standards industrie emballage

Numérotation de lot ISO :

Format : [Ordre]-[Palette]-[Date]

Exemple : OP-2025-001-P-001-251023

Traçabilité complète du papier à l'expédition

Conformité réglementaire :

Enregistrement des lots matières premières

Historique complet par palette

5. Tables enfants additionnelles

Child Table : Matiere Etape Production

Type (Entrant / Sortant)

Item (link)

Numéro de lot fournisseur

Quantité demandée

Quantité consommée/produite

Unité

Warehouse (si intégré stock)

Date péremption (si applicable)

Intégration avec système existant

Modification Etude Technique

Ajouter dans /home/wezri/frappe-bench/apps/aurescrm/aurescrm/aures_crm/doctype/etude_technique/:

Bouton "Créer Ordre de Production" (visible après soumission)

Fonction create_ordre_production() dans le .py

Lien vers Ordre de Production créé

Modification Sales Order

Ajouter :

Liste des Ordres de Production liés

Statut de production agrégé

Intégration

Lien avec BOM (Bill of Materials) pour matières premières

Lien avec Workstation pour postes de travail

Optionnel : Stock Entry pour mouvements de matières

Fonctionnalités clés

1. Création automatique depuis Etude Technique

# etude_technique.py
@frappe.whitelist()
def create_ordre_production(etude_name):
    etude = frappe.get_doc("Etude Technique", etude_name)
    
    # Déterminer la route selon procédé/article
    route = get_route_for_item(etude.article, etude.procede)
    
    # Créer ordre de production
    ordre = frappe.get_doc({
        "doctype": "Ordre de Production",
        "etude_technique": etude.name,
        "sales_order": etude.commande,
        "client": etude.client,
        "article": etude.article,
        "quantite_a_produire": etude.quantite,
        "route_production": route,
        "status": "Nouveau"
    })
    
    # Copier les étapes depuis la route
    # ...
    ordre.insert()

2. Gestion des étapes

Client Script pour :

Démarrer une étape (bouton)

Terminer une étape (bouton)

Mettre en pause (bouton)

Saisir opérateurs et résultats

Calcul automatique des temps

3. Dashboard et reporting

Ordres en cours

Étapes en cours par opérateur

Temps moyen par étape

Retards et priorités

Rendement production

Structure fichiers à créer

aurescrm/aures_crm/doctype/
├── route_de_production/
│   ├── route_de_production.json
│   ├── route_de_production.py
│   └── route_de_production.js
├── etape_route/
│   ├── etape_route.json
│   └── etape_route.py
├── ordre_de_production/
│   ├── ordre_de_production.json
│   ├── ordre_de_production.py
│   └── ordre_de_production.js (avec client scripts)
├── etape_production/
│   ├── etape_production.json
│   └── etape_production.py
└── matiere_etape_production/ (optionnel)
    ├── matiere_etape_production.json
    └── matiere_etape_production.py

Workflow de mise en œuvre

Créer les DocTypes de base : Route de Production + child tables

Créer Ordre de Production + child tables

Ajouter logique métier : calculs temps, statuts, validations

Intégration Etude Technique : bouton création + fonction

Client Scripts : interfaces utilisateur pour opérateurs

Permissions : rôles Production, Opérateur, Superviseur

Tests : workflow complet sur un exemple réel

Points d'attention

Statuts cohérents : Un ordre en pause doit pouvoir reprendre

Calcul temps : Utiliser datetime pour précision

Traçabilité : Logs de changements d'opérateurs et statuts

Performance : Index sur champs de recherche fréquents

Évolutivité : Préparer contrôle qualité pour plus tard

