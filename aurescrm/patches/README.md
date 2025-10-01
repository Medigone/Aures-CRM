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

