# Scripts de Migration (Patches)

Ce dossier contient les scripts de migration pour l'application AuresCRM.

## Patches Disponibles

### migrate_taux_chutes_to_imposition.py

**Date**: Octobre 2025  
**Objectif**: Migrer le champ `taux_chutes` depuis les Etudes Faisabilite existantes vers leurs Impositions liées.

#### Contexte
Le champ `taux_chutes` a été ajouté au doctype Imposition après que des données aient déjà été créées. Ce patch permet de synchroniser les données historiques.

#### Ce que fait le patch
- Recherche toutes les Etudes Faisabilite qui ont une Imposition liée et un `taux_chutes` défini
- Copie le `taux_chutes` vers l'Imposition correspondante
- Ne remplace PAS les valeurs déjà existantes dans Imposition (protection des données)
- Affiche un rapport détaillé des opérations effectuées

#### Exécution du patch

Le patch s'exécutera automatiquement lors de la prochaine migration :

```bash
cd /home/wezri/frappe-bench
bench migrate
```

#### Exécution manuelle (si nécessaire)

Si vous souhaitez exécuter ce patch manuellement :

```bash
cd /home/wezri/frappe-bench
bench execute aurescrm.patches.migrate_taux_chutes_to_imposition.execute
```

#### Vérification après migration

Pour vérifier que la migration s'est bien déroulée :

```bash
# Compter les Etudes Faisabilite avec Imposition
bench console
>>> frappe.db.count("Etude Faisabilite", {"imposition": ["!=", ""]})

# Compter les Impositions avec taux_chutes défini
>>> frappe.db.count("Imposition", {"taux_chutes": [">", 0]})
```

### add_color_fields_to_maquette.py

**Date**: Octobre 2025  
**Objectif**: Ajouter les champs de gestion des couleurs CMJN et Pantone au Doctype Maquette.

#### Contexte
Le Doctype Maquette a été amélioré pour gérer les couleurs en imprimerie, permettant de distinguer les couleurs CMJN (quadrichromie) et Pantone (couleurs directes).

#### Ce que fait le patch
- Recharge les doctypes Maquette, Maquette CMJN Ligne et Maquette Spot Color
- Vérifie que les nouveaux champs sont bien créés :
  - `mode_couleur` : Sélection du mode (CMJN, Pantone uniquement, CMJN + Pantone)
  - `resume_couleurs` : Résumé automatique des couleurs
  - `profil_icc_sortie` : Fichier ICC pour le contrôle qualité
  - `tolerance_delta_e` : Tolérance ΔE
  - `cmjn_details` : Table enfant pour les canaux CMJN
  - `spot_colors` : Table enfant pour les couleurs Pantone
- Ne modifie **aucune donnée existante** (les anciennes maquettes restent intactes)
- Affiche un rapport de migration

#### Exécution du patch

Le patch s'exécutera automatiquement lors de la prochaine migration :

```bash
cd /home/wezri/frappe-bench
bench migrate
```

#### Exécution manuelle (si nécessaire)

```bash
bench execute aurescrm.patches.add_color_fields_to_maquette.execute
```

#### Documentation complète

Consultez le fichier `aurescrm/aures_crm/doctype/maquette/README_COULEUR.md` pour la documentation complète de la fonctionnalité.

## Comment créer un nouveau patch

1. Créer un nouveau fichier Python dans ce dossier
2. Ajouter une fonction `execute()` qui contient la logique de migration
3. Ajouter le chemin du patch dans `patches.txt`
4. Exécuter `bench migrate`

Exemple :
```python
import frappe

def execute():
    # Votre logique de migration ici
    frappe.db.commit()
```

