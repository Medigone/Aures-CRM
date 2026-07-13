# Questionnaire — Vernis dans le process Offset

Objectif : recueillir les règles métier réelles pour ajuster les doctypes `Machine` et `Item`,
et le calcul de passages presse (`aurescrm/passages.py`), sur tout ce qui touche au vernis.

Remplis directement les réponses sous chaque question (texte libre, tableau, ou coche `[x]`).
Pas besoin de tout remplir en une fois — reviens vers moi dès qu'une section est prête,
on peut traiter section par section.

---

## A. Rappel de l'existant (pour contexte, pas de réponse attendue)

- `Machine.vernis` = une seule case « la presse a une tour vernis ».
- `Machine.total_couleurs` = nb couleurs recto + nb couleurs verso (nombre de groupes encre physiques).
- `Item` a 7 cases indépendantes dans la section « Options Vernis » : Acrylique, UV, Sélectif,
  Drip off, Mat gras, Vernis Sérigraphique, Zone sans vernis.
- Règle actuelle de calcul : Acrylique / UV / Drip off passent par la tour vernis (sinon +1 groupe
  encre) ; Mat gras et la partie « grasse » du Drip off consomment toujours 1 groupe encre ;
  Sérigraphique = hors ligne, aucun impact ; **Sélectif et Zone sans vernis ne sont pas utilisés
  du tout aujourd'hui**.

---

## B. Presses offset (`Machine`)

### B1. Tour vernis — capacités réelles

Aujourd'hui une seule case « Vernis » dit oui/non. Dans la réalité, une tour vernis peut-elle
être limitée à certains types de vernis (ex. acrylique uniquement, pas d'UV) ?

- [ ] Oui, il faut distinguer les capacités par presse
- [ ] Non, si une presse a une tour vernis elle peut tout faire (acrylique, UV, drip off)

Si oui, liste tes presses offset avec tour vernis et précise pour chacune ce qu'elle peut appliquer :

| Machine | Acrylique | UV | Gras (via tour) |
|---|---|---|---|
|  |  |  |  |
|  |  |  |  |

### B2. Séchage HUV

Le vernis UV nécessite un séchage adapté (lampes UV/HUV).

- Combien de tes presses sont équipées de séchage UV/HUV ? _______
- Faut-il ajouter un champ « Type de séchage » (Classique / UV / HUV / IR...) sur `Machine`
  pour bloquer/alerter si on tente d'affecter un article « UV » à une presse sans séchage adapté ?
  - [ ] Oui  - [ ] Non, pas nécessaire

### B3. Groupe encre vs tour vernis

Confirme la mécanique physique : la tour vernis est-elle **toujours un groupe séparé** des
groupes encre (donc `total_couleurs` ne la compte jamais), ou existe-t-il des presses où un
groupe encre peut être transformé/utilisé comme tour vernis (et donc vient en déduction de
`total_couleurs` disponible pour l'encre) ?

Réponse : ___________________________________________

### B4. Vernis sérigraphique hors ligne

- Avez-vous une ou plusieurs machines dédiées au vernis sérigraphique hors ligne ?
  - [ ] Oui, combien : _____   - [ ] Non, sous-traité / autre atelier
- Si oui, faut-il créer un type d'équipement « Vernisseuse » sur `Machine` pour pouvoir la
  suivre dans le Planning Production (charge, statut) comme les presses offset ?
  - [ ] Oui  - [ ] Non, pas besoin de la planifier dans l'ERP

### B5. Impact sur temps / coût

Le fait d'utiliser le vernis (tour ou groupe supplémentaire) change-t-il :
- Le temps de calage ? [ ] Oui [ ] Non — si oui, de combien / comment le calculer : ____________
- La vitesse de production (vitesse_max) ? [ ] Oui [ ] Non
- Un coût matière à part (le vernis lui-même) ? [ ] Oui [ ] Non — actuellement suivi où : ________

---

## C. Article (`Item`)

### C1. Vernis sélectif (`custom_sélectif`)

- Un vernis sélectif (dépose uniquement sur certaines zones) nécessite-t-il toujours un
  groupe encre dédié (plaque spécifique), même quand il est acrylique/UV et qu'il y a une
  tour vernis sur la presse ?
  - [ ] Oui, toujours +1 groupe même avec tour   - [ ] Non, peut passer par la tour normalement
  - [ ] Ça dépend : préciser ____________________________________________

### C2. Zone sans vernis (`custom_zone_sans_vernis`)

- Cette case a-t-elle un impact sur le nombre de passages / groupes, ou est-ce une information
  uniquement utile en prépresse/façonnage (masque, réserve) sans effet sur le calcul presse ?
  - [ ] Impact sur le calcul : préciser lequel ____________________________
  - [ ] Aucun impact, info descriptive seulement

### C3. Combinaisons possibles / interdites

Coche les combinaisons **physiquement impossibles** sur un même article (pour qu'on bloque
la saisie en cas d'erreur) :

- [ ] Mat gras + Vernis Sérigraphique
- [ ] Acrylique + UV (en même temps, hors drip off)
- [ ] Sélectif + Drip off
- [ ] Autre (préciser) : ____________________________

### C4. Champ « Nbr. Couleurs » (texte libre)

Le champ actuel est un texte libre parsé par un regex fragile (« CMJN » → 4, « CMJN + 2 » → 6...).
`Maquette` a déjà des champs structurés (couleurs process / couleurs spot).

- [ ] Garder le champ texte libre tel quel (habitude de saisie, flexible)
- [ ] Remplacer par 2 champs structurés (Int couleurs process + Int couleurs spot), comme sur Maquette
- [ ] Autre proposition : ____________________________

### C5. Priorité Maquette vs Article

Règle actuelle : la Maquette en statut « Version Activée » prime toujours sur les couleurs
de l'article, même si l'article a été modifié plus récemment que la maquette.

- [ ] Règle correcte, à garder telle quelle
- [ ] À revoir : préciser le cas problématique ____________________________

---

## D. Flux général

### D1. Où se décide le vernis pour une commande

- Le vernis est-il une caractéristique **fixe de l'article** (référentiel), ou peut-il varier
  d'une commande à l'autre pour le même article (parfois vernis, parfois non) ?
  - [ ] Toujours fixe sur l'article
  - [ ] Peut varier par commande/OF — préciser où ça devrait alors se saisir : ______________

### D2. Autres endroits impactés

En dehors d'Étude Technique / Dossier Fabrication / Planning Production, y a-t-il d'autres
documents où l'info vernis doit être exploitée (devis, achat matière première vernis, BOM) ?

Réponse : ___________________________________________

### D3. Priorités

Parmi les points B/C/D ci-dessus, quels sont les 2-3 sujets les plus urgents à traiter en premier ?

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________
