# Guide d'utilisation — Atelier d'imposition

## Objectif

L'atelier d'imposition est une **page Desk autonome**. On y dépose un PDF de tracé Esko, on
coche les formats de feuille à comparer, et le moteur évalue chaque format (plus, si demandé,
les formats sur mesure optimaux). **Aucun gagnant n'est désigné** : le tableau est trié, affiche
les écarts, l'ingénieur tranche.

L'Étude de Faisabilité reste un point d'entrée parmi d'autres : le bouton *Atelier d'imposition*
ouvre la page avec le contexte pré-rempli. Le résultat remonte sur l'Étude uniquement lorsqu'une
Imposition est créée depuis un calcul lié.

## Prérequis

1. Un **PDF Esko** (déposé directement, ou porté par un Tracé existant).
   Convention : **noir = coupe**, **rouge = rainage**, **bleu = cotation** (ignoré).
2. Une **machine impression** et, de préférence, une **machine découpe**, avec l'onglet
   **Format feuille** renseigné (mini/maxi laize et développement, pince, marge arrière, lisière).
   La contrainte bloquante est presque toujours la platine de découpe : le moteur retient
   l'**intersection** des deux jeux de bornes.
3. Un **Support Technique** (couple support / grammage de l'article) pour le pont mini, le prix
   à la tonne et les formats en stock. Sans support, on peut quand même calculer — les formats
   viennent alors des impositions existantes et du maxi machine.

## Ouvrir l'atelier

- Menu **Prépresse → Atelier d'imposition**
- ou depuis une Étude de Faisabilité, bouton **Imposition → Atelier d'imposition**
- ou l'URL `/app/atelier-imposition/<nom-du-calcul>` (partageable)

## Déroulement

1. **Déposer le PDF** (ou choisir un Tracé). Article et client sont optionnels pour étudier ;
   ils deviennent obligatoires pour **créer l'Imposition**.
2. Renseigner machines, pont, sens fibre, trait commun, quantité (barre du haut).
3. **Cocher les formats** à étudier, groupés par origine (stock, impositions existantes, maxi
   machine). Laisser cochée l'option *formats sur mesure optimaux* pour comparer aussi les
   formats calculés pile pour la forme.
4. **Calculer**. Le traitement part en tâche de fond (quelques secondes). On peut quitter la
   page : au retour, le calcul en cours est repris.
5. Lire le **tableau comparatif** : poses, grille, pas, chutes, feuilles, tonnage, **coût pour
   1 000**. Cliquer un en-tête pour trier. Les écarts en % se lisent par rapport à la première
   ligne (ou à la ligne retenue).
6. L'**aperçu SVG** reprend les vraies lignes de coupe (noir) et de rainage (rouge), posées
   comme le PDF 1:1 (`lisière + i × pas`, `pince + j × pas`). Molette pour zoomer.
7. **Simulation** : tester un format ou une grille sans relancer le calcul (< 50 ms).
   *Garder ce scénario* l'ajoute au tableau. Changer le pont, le sens fibre ou le trait commun
   demande un **recalcul** (les pas changent). Changer la quantité se recale par simulation.
8. Retenir **une** ligne, puis **Créer l'Imposition** (article + client requis). Une nouvelle
   fiche Imposition est créée, jamais une existante n'est écrasée. Un avertissement s'affiche
   si cette fiche peut devenir l'Idéale reprise par les Calculs Devis.

## Lecture du tableau

| Origine | Signification |
|---|---|
| Format étudié / Stock / Imposition existante / Maxi machine | un format que vous avez coché |
| Sur mesure | A matière minimale, B charge machine minimale, C format en stock |
| Simulation | une évaluation faite après coup, conservée si vous l'avez gardée |

Le **remplissage bbox** du développé : sous 75 %, il y a du potentiel d'emboîtement ; au-delà
de 85 %, la forme est quasi rectangulaire.

Sur un dossier à fort volume, le nombre de feuilles pèse souvent plus lourd que la matière.
C'est le rôle du scénario B et de la colonne *feuilles* / *coût pour 1 000*.

## Historique

Chaque clic sur **Calculer** crée un enregistrement `Calcul Imposition`. L'historique en bas
de page liste les calculs de l'article (ou du tracé). Cliquer une ligne recharge l'écran **et**
remet les filtres aux valeurs de ce calcul.

## Quand le moteur refuse

Il s'arrête et explique, plutôt que de proposer un résultat approximatif :

- PDF illisible, non vectoriel, ou sans chemin noir/rouge ;
- développé calculé incohérent avec les deux cotes du Tracé (écart > 0,5 mm) ;
- aucun format coché et sur mesure décoché ;
- format hors bornes machine (écarté **avec mention** dans le journal) ;
- aucune pose ne tient.

Les couleurs hors convention (autre que noir/rouge/bleu) sont signalées en avertissement :
une découpe peut manquer.

## Permissions

Chargé / Responsable Étude Faisabilité et System Manager : lecture, écriture, création.
Technicien et Responsable Prepresse : lecture. La suppression des calculs est réservée aux
responsables et au System Manager.
