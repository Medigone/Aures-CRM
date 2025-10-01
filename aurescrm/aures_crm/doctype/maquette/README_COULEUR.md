# Gestion des Couleurs - Doctype Maquette

## Vue d'ensemble

Ce document décrit la fonctionnalité de gestion des couleurs pour le Doctype **Maquette**, permettant de gérer les couleurs en imprimerie selon trois modes :

1. **CMJN** (Quadrichromie / Process Color)
2. **Pantone uniquement** (Couleurs directes / Spot Colors)
3. **CMJN + Pantone** (Combinaison des deux)

## Architecture

### Doctypes principaux

#### 1. Maquette (parent)
Doctype principal qui contient :
- **mode_couleur** : Sélection du mode de couleur (`CMJN`, `Pantone uniquement`, `CMJN + Pantone`)
- **resume_couleurs** : Résumé automatique et lisible des couleurs (lecture seule)
- **profil_icc_sortie** : Fichier ICC pour le contrôle qualité (optionnel)
- **tolerance_delta_e** : Tolérance ΔE pour le contrôle qualité (optionnel)
- **nombre_couleurs_process** : Compteur auto des canaux CMJN (lecture seule)
- **nombre_spot_colors** : Compteur auto des couleurs Pantone (lecture seule)

#### 2. Maquette CMJN Ligne (child table)
Table enfant pour les détails CMJN :
- **canal** : Canal CMJN (`C`, `M`, `J`, `N`) - requis
- **taux_max_encrage** : Taux maximum d'encrage en % (optionnel)
- **remarque** : Note libre (optionnel)

#### 3. Maquette Spot Color (child table)
Table enfant pour les couleurs Pantone/Spot :
- **code_spot** : Code Pantone (ex: "PANTONE 186 C") - requis
- **nom_couleur** : Nom descriptif de la couleur (optionnel)
- **fournisseur_encre** : Fournisseur de l'encre (optionnel)
- **remarque** : Note libre (optionnel)

## Modes de couleur

### 1. Mode CMJN
Utilisé pour l'impression en quadrichromie (process color).

**Exigences :**
- Au moins 1 ligne dans `cmjn_details`
- Recommandé : 4 lignes (C, M, J, N)

**Exemple de résumé :** `"CMJN (4)"`

### 2. Mode Pantone uniquement
Utilisé pour l'impression en couleurs directes uniquement.

**Exigences :**
- Au moins 1 couleur dans `spot_colors`
- `cmjn_details` doit être vide

**Exemple de résumé :** `"Pantone (2) — PANTONE 186 C, PANTONE 877 C"`

### 3. Mode CMJN + Pantone
Combinaison des deux : quadrichromie + couleurs directes (ex: CMJN + vernis Pantone).

**Exigences :**
- Au moins 1 ligne dans `cmjn_details`
- Au moins 1 couleur dans `spot_colors`

**Exemple de résumé :** `"CMJN (4) + Pantone (2) — PANTONE 186 C, PANTONE 877 C"`

## Fonctionnalités

### Visibilité dynamique
Les sections CMJN et Pantone s'affichent/masquent automatiquement selon le `mode_couleur` sélectionné.

### Pré-remplissage automatique
Lors de la sélection d'un mode incluant CMJN, si `cmjn_details` est vide, les 4 canaux (C, M, J, N) sont automatiquement créés.

### Synchronisation des compteurs
Les champs `nombre_couleurs_process` et `nombre_spot_colors` sont automatiquement mis à jour à chaque modification des tables enfants.

### Nettoyage des codes Pantone
Les codes Pantone dans `spot_colors` sont automatiquement :
- Mis en majuscules
- Débarrassés des espaces superflus

### Génération du résumé
Le champ `resume_couleurs` est automatiquement généré et inclut :
- Le nombre de couleurs process
- Le nombre de couleurs Pantone
- La liste des codes Pantone

### Validations

#### Côté client (JavaScript)
- Avertissement si le mode CMJN n'a pas exactement 4 canaux
- Synchronisation en temps réel des compteurs

#### Côté serveur (Python)
- **Erreur bloquante** si mode CMJN sans aucune ligne CMJN
- **Erreur bloquante** si mode Pantone sans aucune couleur spot
- Avertissement (non bloquant) si CMJN n'a pas 4 canaux

## Exemples d'utilisation

### Exemple 1 : Maquette CMJN simple

```json
{
  "mode_couleur": "CMJN",
  "cmjn_details": [
    {"canal": "C", "taux_max_encrage": 95},
    {"canal": "M", "taux_max_encrage": 90},
    {"canal": "J", "taux_max_encrage": 90},
    {"canal": "N", "taux_max_encrage": 95}
  ],
  "nombre_couleurs_process": 4,
  "resume_couleurs": "CMJN (4)"
}
```

### Exemple 2 : Maquette Pantone uniquement

```json
{
  "mode_couleur": "Pantone uniquement",
  "spot_colors": [
    {
      "code_spot": "PANTONE 186 C",
      "nom_couleur": "Rouge vif",
      "fournisseur_encre": "Flint Group"
    },
    {
      "code_spot": "PANTONE 877 C",
      "nom_couleur": "Argent métallique",
      "fournisseur_encre": "Siegwerk"
    }
  ],
  "nombre_spot_colors": 2,
  "resume_couleurs": "Pantone (2) — PANTONE 186 C, PANTONE 877 C"
}
```

### Exemple 3 : Maquette CMJN + Pantone

```json
{
  "mode_couleur": "CMJN + Pantone",
  "cmjn_details": [
    {"canal": "C"},
    {"canal": "M"},
    {"canal": "J"},
    {"canal": "N"}
  ],
  "spot_colors": [
    {
      "code_spot": "PANTONE 877 C",
      "nom_couleur": "Vernis argent"
    }
  ],
  "nombre_couleurs_process": 4,
  "nombre_spot_colors": 1,
  "resume_couleurs": "CMJN (4) + Pantone (1) — PANTONE 877 C",
  "profil_icc_sortie": "/files/icc_profiles/fogra39.icc",
  "tolerance_delta_e": 2.5
}
```

## Contrôle qualité

### Profil ICC
Le champ `profil_icc_sortie` permet d'attacher un fichier de profil ICC pour définir l'espace colorimétrique de sortie (ex: FOGRA39, FOGRA51, etc.).

**Format accepté :** Fichiers `.icc` ou `.icm`

### Tolérance ΔE
Le champ `tolerance_delta_e` permet de définir la tolérance d'écart colorimétrique acceptable.

**Valeurs courantes :**
- ΔE < 1.0 : Différence non perceptible à l'œil nu
- ΔE < 2.0 : Très bonne qualité
- ΔE < 3.0 : Qualité acceptable pour l'impression commerciale
- ΔE > 5.0 : Différence visible

## Migration

### Exécution du patch

Le patch de migration s'exécute automatiquement lors de la commande :

```bash
cd /home/wezri/frappe-bench
bench migrate
```

### Exécution manuelle (si nécessaire)

```bash
bench execute aurescrm.patches.add_color_fields_to_maquette.execute
```

### Impact sur les données existantes

Les maquettes existantes **ne sont pas affectées** :
- Les nouveaux champs restent vides (`mode_couleur` = null)
- Aucune donnée n'est modifiée ou supprimée
- Les maquettes existantes peuvent être mises à jour manuellement

## Bonnes pratiques

### 1. Choix du mode couleur
- **CMJN** : Pour l'impression standard (magazines, brochures, etc.)
- **Pantone uniquement** : Pour l'impression en tons directs (logos, packaging haut de gamme)
- **CMJN + Pantone** : Pour combiner process et couleurs spéciales (vernis, métallisés)

### 2. Canaux CMJN
- Toujours utiliser les 4 canaux (C, M, J, N) en mode CMJN
- Définir `taux_max_encrage` si vous suivez le TAC (Total Area Coverage)
- TAC typique : 300-330% pour l'offset, 240-280% pour le flexo

### 3. Codes Pantone
- Utiliser la nomenclature officielle : "PANTONE XXX C" ou "PANTONE XXX U"
- Suffixe **C** : Coated (papier couché)
- Suffixe **U** : Uncoated (papier non couché)
- Suffixe **M** : Matte (papier mat)

### 4. Profils ICC
- Utiliser des profils standards (FOGRA39, FOGRA51, GRACoL, etc.)
- Conserver les profils dans un dossier centralisé
- Documenter le profil utilisé dans les remarques

## Filtres et vues

### Colonnes en List View
- `mode_couleur` : Affiche le mode de couleur
- `nombre_spot_colors` : Nombre de couleurs spot
- `resume_couleurs` : Résumé complet des couleurs

### Filtres rapides
- Filtrer par `mode_couleur` pour trouver rapidement les maquettes CMJN, Pantone ou mixtes

## Support et maintenance

### Fichiers modifiés
- `/doctype/maquette/maquette.json` : Définition du doctype principal
- `/doctype/maquette/maquette.py` : Logique serveur et validations
- `/doctype/maquette/maquette.js` : Logique client et interface dynamique
- `/doctype/maquette_cmjn_ligne/` : Child doctype CMJN
- `/doctype/maquette_spot_color/` : Child doctype Spot Color
- `/patches/add_color_fields_to_maquette.py` : Patch de migration
- `/patches.txt` : Référence du patch

### Tests
Les tests unitaires se trouvent dans :
- `/doctype/maquette/test_maquette_couleur.py`

Pour exécuter les tests :

```bash
cd /home/wezri/frappe-bench
bench run-tests --app aurescrm --doctype "Maquette"
```

## Changelog

### Version 1.0 (Octobre 2025)
- ✅ Ajout du mode couleur (CMJN, Pantone uniquement, CMJN + Pantone)
- ✅ Child tables pour CMJN et Spot Colors
- ✅ Génération automatique du résumé couleurs
- ✅ Contrôle qualité avec profil ICC et tolérance ΔE
- ✅ Validations côté client et serveur
- ✅ Patch de migration idempotent

## Contact

Pour toute question ou problème, contactez l'équipe de développement AuresCRM.

