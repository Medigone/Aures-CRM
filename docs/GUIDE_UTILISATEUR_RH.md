# Guide d'utilisation - Ressources Humaines

## Objectif
Ce guide explique comment utiliser au quotidien le module `Ressources Humaines` : créer et gérer une fiche employé, comprendre son statut, consulter l'historique et l'organigramme.

Ce guide est volontairement simple et non technique. Pour la présentation complète du module et les prérequis de mise en route, voir [PRESENTATION_MODULE_RH.md](PRESENTATION_MODULE_RH.md).

## Accéder au module
Depuis le Bureau (Desk), ouvrez l'espace de travail `Ressources Humaines` (icône équipe). Vous y trouvez :
- des compteurs (employés actifs / sortis / pré-intégrés) ;
- des raccourcis vers les employés, les référentiels, l'organigramme et les rapports.

## Avant de créer un employé : vérifier les référentiels
Avant de saisir une fiche, assurez-vous que les éléments suivants existent déjà (sinon, créez-les d'abord) :
- **Département RH** — s'il n'existe pas encore, créez-le (`Département RH` > `Nouveau`) : nom, département parent éventuel, responsable.
- **Poste RH** — idem, avec un niveau (Direction, Responsable, Superviseur, Agent, Technicien, Opérateur, Support, Autre).
- **Site RH** — le lieu de travail. Un site peut avoir un site parent (ex. un atelier rattaché à une usine).
- **Type Contrat RH** — CDI, CDD, Stage, etc. (liste déjà pré-remplie, à compléter si besoin).

Ces quatre référentiels sont indépendants les uns des autres et se créent en quelques champs.

## Créer une fiche employé
1. Ouvrez `Employe` > `Nouveau`.
2. Renseignez l'onglet **Statut RH** : nom, prénom, coordonnées, statut.
   - Le `Nom complet` se génère automatiquement (vous n'avez rien à saisir).
   - À la création, le statut par défaut est `Pré-intégré` : c'est normal pour un dossier en préparation, avant l'arrivée effective.
3. Renseignez l'onglet **Affectation** : département, poste, site, type de contrat, responsable hiérarchique.
4. Complétez si besoin les **Informations administratives** (NIN, pièce d'identité, CNAS, compte bancaire) et joignez les **Documents** (contrat, CV, diplôme...).
5. Enregistrez.

## Comprendre le statut de l'employé
Le champ `Statut` prend l'une de ces quatre valeurs :

`Pré-intégré` → `Actif` → `Inactif` / `Sorti`

- **Pré-intégré** : dossier créé, employé pas encore en poste. Peu de champs obligatoires.
- **Actif** : l'employé travaille effectivement. Passer à ce statut **exige** d'avoir renseigné : date d'entrée, département, poste, site et type de contrat. Si l'un de ces champs manque, l'enregistrement est bloqué avec un message indiquant les champs à compléter.
- **Sorti** : l'employé a quitté l'entreprise. Passer à ce statut **exige** une date de sortie et un motif de sortie (démission, fin de contrat, licenciement, retraite, abandon de poste, autre).
- **Inactif** : suspension temporaire (pas de champs obligatoires spécifiques).

Quelques contrôles automatiques :
- La date de sortie ne peut pas être antérieure à la date d'entrée.
- Un employé ne peut pas être son propre responsable hiérarchique.
- Le matricule, le NIN et le numéro CNAS doivent être uniques : si l'un de ces numéros est déjà utilisé par un autre employé, le système refuse l'enregistrement et indique lequel.

## Gérer une sortie
1. Ouvrez la fiche de l'employé concerné.
2. Passez le `Statut` à `Sorti`.
3. Renseignez la `Date de sortie` et le `Motif de sortie` (obligatoires).
4. Ajoutez une observation si utile.
5. Enregistrez : le mouvement de sortie est tracé automatiquement (voir ci-dessous), vous n'avez rien d'autre à faire.

## L'historique des mouvements (automatique)
Chaque fois qu'un changement d'affectation est enregistré sur une fiche employé — département, poste, site, responsable hiérarchique ou statut — le système crée **automatiquement** une entrée dans `Mouvement Employe`, avec l'ancienne et la nouvelle valeur.

Vous n'avez donc **pas besoin de créer ces mouvements manuellement** ; ils sont visibles dans la liste `Mouvements Employé` (raccourci du tableau de bord) et servent de registre officiel des entrées, sorties, changements de poste/département/site et réintégrations.

Un mouvement peut aussi être créé manuellement (par exemple pour tracer une correction administrative sans changement d'affectation réel), via `Mouvement Employe` > `Nouveau`.

## Utiliser l'organigramme
Ouvrez le raccourci `Organigramme` depuis le tableau de bord. Trois vues sont disponibles :

- **Hiérarchie** : arbre des employés selon leur responsable hiérarchique. Vous pouvez filtrer sur un employé précis pour voir uniquement sa chaîne hiérarchique jusqu'à la direction.
- **Départements** : arbre des départements, avec l'effectif de chacun (cumulé avec ses sous-départements).
- **Sites** : arbre des sites, avec l'effectif de chacun.

Un clic sur un nœud (employé, département ou site) ouvre directement sa fiche. Les couleurs des départements et des sites (attribuées automatiquement, modifiables dans leur fiche) permettent de repérer rapidement les regroupements.

Vous pouvez filtrer l'organigramme par statut, département ou site.

## Consulter les rapports
Trois rapports sont accessibles depuis le tableau de bord :
- **Registre des employés** : liste complète, filtrable par statut, département, poste, site ou type de contrat. Utile pour un export.
- **Employés actifs par département** : effectif actif par département, avec graphique.
- **Employés par site** : effectif actif par site, avec graphique.

## Bonnes pratiques
- Complétez toujours l'onglet **Affectation** avant de passer un employé au statut `Actif` : cela évite les blocages à l'enregistrement.
- Ne modifiez pas manuellement le `Nom complet` : il est généré automatiquement à partir du nom et du prénom.
- Utilisez le statut `Pré-intégré` pour préparer un dossier avant l'arrivée réelle, et ne passez à `Actif` que le jour effectif de prise de poste (la `Date d'entrée` doit correspondre).
- N'oubliez pas de renseigner le `Motif de sortie` dès le passage au statut `Sorti` : c'est obligatoire pour enregistrer la fiche.
- Laissez le système gérer l'historique des mouvements : ne créez une entrée manuelle dans `Mouvement Employe` que pour un cas particulier non couvert par un changement d'affectation classique.

## Qui a accès à quoi
- **RH Manager** : accès complet (création, modification, suppression).
- **RH User** : création et modification des fiches, sans suppression.
- **RH Viewer** / **Direction** : consultation uniquement (fiches, organigramme, rapports).

## Questions / blocages
En cas de doute sur une fiche employé ou un blocage à l'enregistrement, contactez : _à compléter_.
