# Guide d'utilisation - Calcul Devis

## Objectif
Le `Calcul Devis` permet d'estimer le coût de revient et de proposer un prix de vente pour une ligne d'article d'un devis.

Il regroupe :

- les informations du devis, du client et de l'article ;
- les données d'imposition et la quantité de feuilles ;
- le coût du papier ;
- les différentes étapes de production ;
- la marge et le prix proposé.

Ce guide est une référence fonctionnelle destinée aux personnes chargées du chiffrage.

## Comment obtenir un Calcul Devis
Dans le fonctionnement habituel, le Calcul Devis est généré depuis un `Quotation` :

1. Ouvrez le devis.
2. Dans le menu `Actions`, cliquez sur `Générer Calculs Devis`.
3. Le système crée un Calcul Devis pour chaque ligne d'article qui n'en possède pas encore.

Un Calcul Devis peut aussi être généré automatiquement lorsqu'un devis est créé depuis une `Demande Faisabilite` ou un `Dossier Essai Blanc`.

Chaque Calcul Devis correspond à une ligne précise du devis. Deux lignes contenant le même article peuvent donc avoir deux calculs différents.

## Accéder aux Calculs Devis
Vous pouvez ouvrir `Calcul Devis` :

- depuis la recherche globale ;
- depuis la liste `Calcul Devis` du module `Aures CRM` ;
- depuis les documents liés au devis.

## Ordre conseillé de saisie

### 1. Vérifier les informations générales
Vérifiez les champs suivants :

- `Devis`
- `Client`
- `Article`
- `Nom Article`
- `Quantité Commandée`

Ces informations proviennent du devis et ne doivent normalement pas être modifiées dans le Calcul Devis.

### 2. Vérifier les données techniques
Dans l'onglet `Données Techniques`, contrôlez :

- `Imposition`
- `Format d'Impression`
- `Nombre de Poses`
- `Taux de Chutes (Imposition)`
- `Quantité Feuilles Nécessaires`

L'imposition idéale de l'article est reprise lors de la génération lorsqu'elle existe.

Le nombre de poses sert à convertir la quantité commandée en quantité de feuilles. Si l'imposition ou le nombre de poses est incorrect, le coût du papier et les postes calculés par feuille seront également incorrects.

### 3. Renseigner la gâche par poste
La gâche n'est plus un taux unique : elle se saisit **par poste de production**, en nombre de feuilles.

Lors de l'ajout d'un poste depuis un `Bareme Cout Fixe`, le champ `Gâche (feuilles)` est prérempli. Vous pouvez l'ajuster sur la ligne.

Les champs calculés dans la section `Gâche` :

- `Total Gâche (feuilles)` : somme des gâches des postes ;
- `Feuilles avec Gâche` : feuilles nettes + total gâche.

C'est cette dernière quantité qui est utilisée pour :

- le coût total du papier ;
- les postes dont l'unité est `Par feuille`.

Le `Taux de Chutes (Imposition)` reste une information provenant de l'imposition. Il ne remplace pas la gâche des postes.

### 4. Renseigner le papier
Dans l'onglet `Papier` :

1. Sélectionnez le `Support/Papier`.
2. Vérifiez sa désignation.
3. Vérifiez le `Grammage`, le `Format d'Impression`, la `Surface Feuille` et le `Poids Feuille`.
4. Renseignez le `Coût Support (par kg)`.

Le système calcule automatiquement :

- le `Coût Support (par Feuille)` ;
- le `Coût Support Total`.

Si le grammage ou le format d'impression est vide ou incorrect, le coût support ne pourra pas être calculé correctement.

### 5. Ajouter les postes de production
Dans l'onglet `Postes de Production`, ajoutez une ligne pour chaque étape nécessaire :

- impression offset ;
- vernis ;
- pelliculage ;
- découpe forme ;
- prépresse ;
- contrôle ou autre opération facturable.

Le système n'ajoute aucune étape automatiquement à partir des finitions de l'article. Le chargé de devis construit la liste des postes manuellement, ou l'initialise via un modèle.

### 5 bis. Ajouter les postes depuis un modèle
Le `Modele Postes Devis` regroupe une liste ordonnée de barèmes pour un type de produit courant (exemple : `Étui Pharma`).

Pour l'utiliser :

1. Dans l'onglet `Postes de Production`, cliquez sur `Ajouter depuis un modèle`.
2. Sélectionnez un modèle actif.
3. Cliquez sur `Appliquer`.

Le système copie les valeurs courantes de chaque barème (libellé, machine, coûts, gâche, unité) dans de nouvelles lignes de postes. Les postes déjà présents sont conservés. Un barème déjà saisi (même lien ou même libellé) n'est pas ajouté une seconde fois.

Après application, les montants restent figés sur le Calcul Devis. Modifier le modèle ou un barème n'a aucun effet rétroactif.

Pour chaque ligne, renseignez :

- `Libellé` : nom clair de l'étape ;
- `Machine (info)` : machine envisagée, facultative ;
- `Nombre de passages` : nombre de fois où le poste doit être réalisé ;
- `Coût fixe (calage/lancement)` : coût indépendant du volume pour un passage ;
- `Gâche (feuilles)` : gâche de calage de l'étape (non multipliée par les passages) ;
- `Unité de calcul` : `Par feuille`, `Par 1000 unités` ou `Forfait` ;
- `Coût variable unitaire` : montant correspondant à l'unité choisie ;
- `Description` : précision utile pour le chiffrage.

Le champ `Machine (info)` sert uniquement à la traçabilité. Choisir une machine :

- ne remplit aucun prix ;
- ne calcule pas le nombre de passages ;
- ne modifie pas automatiquement le poste.

### 6. Choisir la bonne unité de calcul

#### Par feuille
À utiliser lorsque le coût dépend du nombre de feuilles avec gâche.

Exemples :

- encre par feuille ;
- pelliculage par feuille ;
- opération répétée sur chaque feuille.

#### Par 1000 unités
À utiliser lorsqu'un tarif est exprimé pour 1 000 produits commandés.

Exemples :

- conditionnement facturé au mille ;
- opération sous-traitée facturée par 1 000 unités.

#### Forfait
À utiliser lorsque le montant variable doit être appliqué une fois par passage, sans dépendre de la quantité.

Exemples :

- forfait de préparation ;
- forfait de contrôle ;
- prestation forfaitaire complémentaire.

Pour éviter un double comptage, ne renseignez pas le même montant à la fois dans `Coût fixe` et dans `Coût variable unitaire` avec l'unité `Forfait`.

### 7. Utiliser le Bareme Cout Fixe
Le `Bareme Cout Fixe` est un aide-mémoire contenant des coûts standards.

Pour l'utiliser :

1. Ouvrez la liste `Bareme Cout Fixe` dans un autre onglet.
2. Recherchez une référence proche du poste à chiffrer.
3. Recopiez manuellement le libellé, le coût fixe, l'unité et le coût variable dans la ligne du Calcul Devis.
4. Adaptez les montants au contexte du devis si nécessaire.

Il n'existe pas de synchronisation automatique. Une modification du barème ne change jamais un Calcul Devis existant.

### 8. Renseigner la marge
Saisissez la `Marge (%)`.

Le système calcule :

- le `Prix unitaire proposé (réf.)` ;
- le `Prix Total Proposé`.

La marge est appliquée sur le coût unitaire. Par exemple, une marge de 20 % transforme un coût unitaire de 10 en un prix unitaire proposé de 12.

Ces montants restent une référence. Ils ne sont pas écrasés si vous ajustez ensuite le prix final.

### 8 bis. Ajuster le prix proposé final
Saisissez manuellement le `Prix proposé final` si vous souhaitez proposer un montant différent de la référence.

Le système calcule alors :

- le `Prix total final` ;
- la `Marge commerciale sur coût (%)` ;
- la `Marge commerciale sur prix (%)`.

Le prix final n'est jamais prérempli ni modifié automatiquement lors d'un recalcul.

### 9. Sauvegarder et valider
Enregistrez le document pour conserver les postes et recalculer les totaux.

Lorsque le chiffrage est terminé et contrôlé, soumettez le Calcul Devis. Un document soumis est verrouillé. Pour le corriger, il faut l'annuler puis l'amender selon les permissions de votre rôle.

## Totaux à contrôler
Avant validation, vérifiez :

- `Coût Support Total`
- `Total Coûts Fixes`
- `Total Coûts Variables`
- `Coût Total`
- `Coût Unitaire`
- `Marge (%)`
- `Prix unitaire proposé (réf.)`
- `Prix Total Proposé`
- `Prix proposé final`
- `Prix total final`
- `Marge commerciale sur coût (%)`
- `Marge commerciale sur prix (%)`

## Bonnes pratiques
- Utilisez un libellé compréhensible pour chaque poste.
- Créez une ligne distincte pour chaque étape ou passage ayant un coût différent.
- Vérifiez systématiquement le nombre de poses et la gâche avant de contrôler les prix.
- Ne considérez pas la machine sélectionnée comme une source automatique de tarifs.
- Consultez le barème comme référence, puis adaptez le montant au devis réel.
- Évitez de mélanger dans une même ligne plusieurs opérations dont les unités de calcul sont différentes.
- Ajoutez une description lorsqu'un montant est exceptionnel ou négocié.

## En cas d'écart de calcul
Contrôlez dans cet ordre :

1. la quantité commandée ;
2. le nombre de poses ;
3. la gâche (feuilles) de chaque poste ;
4. le grammage, le format et le coût du support au kg ;
5. le nombre de passages de chaque poste ;
6. l'unité de calcul de chaque poste ;
7. les coûts fixes et variables ;
8. la marge.

Pour le détail des formules, consultez `docs/METHODE_CALCUL_DEVIS.md`.
