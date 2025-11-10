État des lieux
-
Gestion des stocks
État des lieux opérationnel et diagnostic initial de la gestion des stocks
Date d’émission : Novembre 2025
Introduction
Dans le cadre du déploiement progressif du système de gestion intégré d’Aures Emballages,
la direction a décidé de lancer une mission d’état des lieux dédiée à la gestion des stocks et
des entrepôts.
Cette mission constitue une étape préparatoire essentielle avant la digitalisation complète
du processus logistique au sein de l’ERP.
L’objectif est de comprendre en détail le fonctionnement actuel des flux physiques et
informationnels , d’identifier les écarts entre la pratique et les procédures souhaitées, et de
recueillir l’ensemble des données nécessaires à la conception d’un module “Stock” fidèle à
la réalité du terrain.
La mission consiste à effectuer les visites des différents entrepôts, documenter les
processus observés, et proposer des pistes d’amélioration concrètes.
Les constats et recommandations issus de ce travail serviront de base à la modélisation du
futur système ERP , garantissant une transition fluide et adaptée aux besoins opérationnels
d’Aures Emballages.
Période de mission : 4 Semaines
Date d’émission : Novembre 2025
1) Finalité de la mission
Établir un état des lieux exhaustif de la gestion des stocks sur tous les sites (réception,
stockage, transferts, sorties vers production et expédition), afin de :
●
Comprendre les pratiques réelles et les écarts par rapport aux procédures
existantes.
●
Identifier les points de douleur (erreurs, retards, ruptures, double saisie, absence de
traçabilité, etc.).
●
Préparer un cahier des besoins ERP (Doctypes, workflows, règles de contrôle) et
un plan de déploiement réaliste.
2) Livrables attendus
1. Fiches de visite par entrepôt (avec photos, schémas de flux, checklists remplies).
2. Cartographie des flux (Entrée → Stock → Production/Expédition,
inter‑sites).
+ transferts
3. Diagnostic synthèse : forces, faiblesses, risques, priorités d’amélioration.
4. Cahier des besoins ERP – Stock :
○
Doctypes à créer/adapter, champs clés, règles (lots, péremption, unités).
○
Workflows standardisés (réception, sortie, transfert, ajustement, inventaire
tournant).
○
Interfaces nécessaires (impression d’étiquettes/QR, mobile, import/export).
5. Plan d’actions (priorisé : court / moyen / long terme) avec indicateurs de réussite et
jalons de mise en œuvre.
Date d’émission : Novembre 2025
Critères d’acceptation
●
●
●
Données terrain vérifiées auprès des responsables d’entrepôt.
Recommandations hiérarchisées et chiffrées (effort, impact, risques).
Cohérence avec les contraintes métier (imprimerie/emballage) et la réalité
opérationnelle.
3) Périmètre de l’état des lieux
●
●
●
Sites : lister tous les entrepôts et zones (MP, semi‑fini, emballages, produits finis,
retours, rebut).
Familles d’articles : papier/carton, encres, clichés, outillages (formes de découpe),
consommables, pièces de rechange, PFI (Produit Fini Intermédiaire), PF (Produit
Fini).
Flux :
●
●
○
○
○
○
Entrées : réception fournisseurs → contrôle qualité
(documentation, délais, acteurs, saisie).
→ mise en stock
Transferts internes : entre dépôts/zones/sites (qui demande ? qui valide ?
comment trace‑t‑on ?).
Sorties : vers production/OF, échantillons, expédition clients, rebuts.
Ajustements : casse, inventaire, corrections.
Supports actuels : Excel, papier, photos WhatsApp (si existant).
Traçabilité : lots, DLU (Date Limite d’Utilisation), numéros de série, liens
commande/OF, étiquetage/QR.
Date d’émission : Novembre 2025
4) Planning indicatif (4 semaines)
Semaine Étapes Livrables
1 Cadrage et préparation des
visites
Plan de tournée, modèles de fiches, liste
contacts
2 Visites et collecte (tous
entrepôts)
Fiches de visite + photos + relevés
3 Analyse et cartographie des flux Diagrammes, risques, causes racines
4 Cahier des besoins ERP & plan
d’actions
Spécifications, priorités, feuille de route
5) Méthode sur site (checklist opérationnelle)
Avant la visite
●
Confirmer les interlocuteurs (chef dépôt, préparateurs, contrôleur qualité, expédition).
●
Imprimer la Fiche de visite Entrepôt (Annexe A) et préparer un plan du site.
Pendant la visite
●
●
●
●
Prendre des photos des zones clés (réception, picking, transfert, emballage,
expédition) ; noter les références sensibles (pas de données client sur photos si
possible).
Chronométrer 1–2 cycles complets (réception → mise en stock) et (demande →
sortie → livraison interne/externe).
Relever : documents utilisés, validations, délais, erreurs fréquentes, contournements,
files d’attente.
Vérifier l’étiquetage (lot, DLU, emplacement), les règles FEFO/FIFO, la propreté et la
sécurité.
Après la visite
●
●
Compléter la check‑list, ajouter les constats « points forts / points faibles ».
Faire valider la synthèse par le responsable de site.
Date d’émission : Novembre 2025
6) Données à capturer (minimum)
●
●
●
●
●
●
Entrepôt & zones : codes, surfaces, capacités (palettes, linéaires), contraintes
(température, sécurité).
Articles : familles, unités, conditionnements, volumétrie (réceptions/jour,
sorties/jour), rotation (A/B/C).
Documents : modèles de bons (réception/sortie), supports Excel, formulaires papier,
cachets/signatures.
Délais : moyenne et variabilité (réception, mise en stock, préparation, expédition).
Qualité : non conformités, rebuts, écarts inventaire, causes racines.
Système : outils actuels, double saisie, imports/exports, nomenclatures, identifiants
(SKU, lot, emplacement).
7) Risques typiques & pistes d’amélioration
Risque / Pain point Impact Piste ERP / Process
Absence de
lot/étiquetage
Rupture traçabilité,
litiges
Doctype Lot + impression étiquette +
scan à chaque mouvement
Entrées non validées Stocks fantômes Workflow réception (contrôle qualité
obligatoire)
Transferts non tracés Écarts entre dépôts Document « Transfert Inter‑Entrepôt » +
approbation
Inventaire annuel
massif
Ruptures &
immobilisation
Inventaire tournant mensuel par zone
(mobile)
Double saisie
Excel/ERP
Erreurs, pertes de
temps
Vue unique ERP + import contrôlé +
suppression des fichiers parallèles
Mauvais emplacements Temps de picking Codification emplacements +
FEFO/FIFO automatiques
Date d’émission : Novembre 2025
8) Pré‑spécifications ERP (base de travail)
Doctypes (briques minimales)
●
●
●
●
●
●
Entrepôt (zones, capacité, responsable, géolocalisation optionnelle).
Emplacement (allée, travée, niveau, type : palette, picking, quarantaine…).
Article (SKU, famille, unité, conditionnement, DLU/lot, gabarit d’étiquette).
Lot (n° lot, DLU, article, quantités, historique mouvements).
Mouvements de stock : Réception, Sortie, Transfert, Ajustement, Retour.
Inventaire (tournant, contrôle, écarts, justification, validation).
Workflows clés
●
●
●
●
Réception (commande fournisseur → contrôle qualité → mise en stock → étiquetage
→ validation).
Sortie vers production (OF/BL interne → préparation → contrôle → transfert →
consommation/livraison).
Transfert inter‑sites (demande → approbation → transport → réception site B).
Inventaire tournant (planning → comptage mobile → écarts → ajustement autorisé).
Intégrations / UI
●
●
●
●
Impression d’étiquettes (QR/Code‑barres) directement depuis les documents.
Scan via mobile (mouvements, inventaires, vérification lots).
Règles FEFO/FIFO automatiques au picking.
Rapports standards : Valorisation, Rotation, Ruptures probables, Lents dormants.
Date d’émission : Novembre 2025
9) Plan d’actions priorisé (exemple)
1. Court terme (0–4 semaines) : standardiser bons de réception/sortie, créer
codification des emplacements, étiquetage provisoire.
2. Moyen terme (1–3 mois) : déployer lot/FEFO, activer transferts tracés, lancer
inventaire tournant.
3. Long terme (3–6 mois) : mobilité (scan), intégration production/OF, tableaux de
bord, suppression des Excel parallèles.
10) Gouvernance & règles
●
Point hebdo de 30 min avec le manager (suivi des visites, blocages, arbitrages).
●
Canal de communication : Raven (canal #stocks‑etat‑des‑lieux) pour partager
comptes rendus & photos.
●
Confidentialité : pas de diffusion externe des documents et photos.
11) Validation de la mission
●
Démarrage :
/
/
__
__
__
— Signature manager : ................................
●
Clôture :
/
/
__
__
__
— Signature gestionnaire : .............................
Date d’émission : Novembre 2025
Annexes (modèles prêts à l’emploi)
Annexe A — Fiche de visite Entrepôt
Site / Entrepôt : ................................ Date : ............. Visiteur : ........................
1. Organisation & zones
●
Plan des zones (MP / PF / Semi‑fini / Quarantaine / Retours / Rebut)
●
Capacité estimée (palettes / linéaires)
●
Signalétique & propreté
2. Entrées (Réception)
●
●
●
Contrôle qualité à l’entrée
Documents utilisés (BL, Certificat, etc.)
Saisie (ERP / Excel / Papier)
●
Délai moyen réception → mise en stock :
min
____
3. Stockage & Emplacements
●
●
●
Codification claire (allée‑travée‑niveau)
Étiquetage lot / DLU
Règles FIFO/FEFO appliquées
4. Sorties / Picking
●
●
●
Demande formalisée (OF / BL interne)
Contrôle avant sortie
Traçabilité (scan / bon signé)
Date d’émission : Novembre 2025
5. Transferts inter‑sites
●
Demande & approbation
●
Preuve de livraison (document / scan)
6. Inventaires
●
Fréquence (tournant / annuel)
●
Écarts et traitement
7. Outils & documents
●
Modèles Excel
●
Formulaires papier
●
Rapports utilisés
8. Points forts / Points faibles
●
+
: ........................................................................................................
●
–
: ........................................................................................................
Photos / Schémas joints : Oui / Non
Validation Responsable Entrepôt : Nom & Signature ................................
Date d’émission : Novembre 2025
Annexe B — Relevé « spot‑check » d’inventaire
Article : .................... Réf/SKU : ............ Lot : ............ DLU : ............
Emplacement identifié : ............ Quantité système :
____
Écart :
____
Cause probable : ........................................
Action corrective proposée : .....................................................
Quantité physique :
____
Annexe C — Cartographie rapide d’un flux
Flux : (ex. Réception → Mise en stock)
Étapes : 1) ______
2) ______
3) ______
4) ______
Acteurs : (réceptionniste, CQ, magasinier, cariste, etc.)
Documents / Système : (BL, OF, ERP, Excel)
Délais observés :
______
Irritants / risques :
______
Idées d’amélioration :
______
Date d’émission : Novembre 2025