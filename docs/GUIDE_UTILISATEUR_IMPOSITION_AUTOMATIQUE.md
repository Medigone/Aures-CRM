# Guide d'utilisation - Imposition automatique (Moteur v1)

## Objectif

Depuis l'Étude de Faisabilité, le moteur lit le PDF de découpe porté par le Tracé, calcule
toutes les dispositions possibles sous contraintes machine, et propose **quatre lignes de
décision**. Sur choix de l'ingénieur, il crée l'enregistrement `Imposition` et génère le PDF
d'imposition à l'échelle 1:1.

**L'outil propose, l'ingénieur décide.** Aucun scénario n'est appliqué sans validation humaine.

## Prérequis

1. Un **Tracé** lié à l'Étude, portant le PDF Esko (`Fichier Tracé`).
   Convention de couleurs obligatoire : **noir = coupe**, **rouge = rainage**, **bleu = cotation**
   (le bleu est ignoré).
2. Une **Machine impression** (`Machine prévue` sur l'Étude) et, de préférence, une
   **Machine découpe**. Sur chaque machine doivent être renseignés : format mini/maxi laize et
   développement, `Marge de pince`, `Marge arrière`, `Lisière mini`.
   > La contrainte bloquante est presque toujours la platine de découpe, pas la presse :
   > le moteur retient l'**intersection** des deux jeux de contraintes.
3. Un **Support Technique** pour le couple support / grammage de l'article
   (`Item.custom_support` + `Item.custom_grammage`). Il fournit le `Pont mini`, le
   `Prix à la tonne` et les `Formats de feuilles` en stock.

## Lancer un calcul

1. Ouvrez l'Étude de Faisabilité, bouton **Imposition → Calculer l'imposition**.
2. Le dialogue est pré-rempli : machine impression, machine découpe, pont mini, trait commun
   autorisé (coché), sens fibre (`Libre`), quantité, et le **format de référence**
   (dernière Imposition connue pour cet article).
3. `Lancer le calcul` : le traitement part en tâche de fond (2 à 10 s selon la forme).
   Le `Statut du calcul` passe à `En cours`, puis la fiche se rafraîchit toute seule.

## Lire le résultat

La section **Imposition automatique** affiche d'abord le contrôle visuel :

- `Développé calculé` laize x déplacement — à recouper avec le Tracé ;
- `Surface utile` (cm²) ;
- `Remplissage bbox` : **sous 75 %, il y a du potentiel d'emboîtement ; au-delà de 85 %, la
  forme est quasi rectangulaire et le moteur n'a presque rien à gagner.**

Puis la table **Scénarios**, qui répond à quatre logiques différentes — et non aux quatre
meilleurs taux de chutes :

| Scénario | Critère |
|---|---|
| **A — Matière minimale** | surface de feuille par pose la plus faible |
| **B — Charge machine minimale** | nombre de feuilles le plus faible, puis matière |
| **C — Format en stock** | meilleure matière parmi les formats du support, sans refente |
| **RÉFÉRENCE** | le format habituellement utilisé, pour comparaison |

> Sur un dossier à fort volume, le nombre de feuilles pèse souvent plus lourd que la matière :
> sur un cas réel de 1 M d'étuis, une solution gagnant 3,1 % de carton imposait +19 % de
> passages presse et platine — donc mauvaise en coût complet. C'est le rôle du scénario B.

Chaque ligne affiche son pas, son trait commun, ses restes de marge et ses contraintes en clair
dans la colonne `Contraintes et alertes` (« format absent du stock — nécessite une refente en
772,5 mm », « reste 0,30 mm en déplacement — une rangée peut être perdue, sensible au pont »).

Le **Journal de calcul** (section repliée) trace la lecture du tracé, le recoupement du
développé, les bornes machine retenues et le diagnostic du trait commun.

## Créer l'Imposition

1. Cochez **une seule** ligne `Retenu`.
2. Bouton **Imposition → Créer l'Imposition**.
3. Le moteur crée un **nouvel** enregistrement `Imposition` (il ne modifie jamais une imposition
   existante, en particulier pas une imposition saisie manuellement), y attache le PDF
   d'imposition 1:1, puis remonte le taux de chutes et le nombre de feuilles dans l'Étude.
4. Le choix est tracé dans le fil de discussion de l'Étude : qui, quand, quel scénario retenu,
   quels scénarios écartés.

L'Imposition créée porte `Origine du calcul = Moteur v1` et le libellé du scénario retenu.

## Quand le moteur refuse de répondre

Un moteur qui se trompe silencieusement est abandonné en trois semaines. Celui-ci s'arrête et
explique :

- **Développé incohérent** avec les dimensions saisies sur le Tracé (écart > 0,5 mm) : aucun
  scénario n'est proposé.
- **Contour non refermable** : message rappelant la convention de couleurs.
- **Couleur inattendue** dans le PDF : avertissement dans le journal de calcul — un élément de
  découpe est probablement absent de la couche noire.
- **Aucune disposition admissible** : le journal indique quelle contrainte bloque (laize,
  déplacement ou sens fibre), jamais un tableau vide.
- **Poses hors feuille** à la génération du PDF : exception, pas de fichier faux.

## Limites de la v1

Hors périmètre : croix de repérage, gammes de contrôle, marques de coupe, cartouche de dossier,
export CF2 / DXF, impositions groupées multi-références, découpes intérieures multiples.
Le tête-bêche n'est pas proposé : la disposition est toujours un réseau régulier, condition de
fabricabilité en découpe forme (filets droits et continus, éjection).
