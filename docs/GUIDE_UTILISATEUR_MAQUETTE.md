## Guide d’utilisation — Maquette

### Objectif
Une **Maquette** sert à gérer et tracer les versions d’un visuel d’article, avec :
- un **aperçu** (image) pour la consultation,
- des informations de **couleur** (CMJN / Pantone),
- un cycle de vie (**référencement**, **activation**, **obsolescence**, **destruction**).

### Où la trouver
Dans la recherche, tapez **Maquette** puis ouvrez :
- une maquette existante, ou
- la liste pour filtrer par **Client**, **Article**, **Statut**, **Mode Couleur**.

---

## 1) Quand une Maquette est créée ?
### Création automatique (cas le plus courant)
Une Maquette peut être **créée automatiquement** lors de la confirmation d’une **Demande de Faisabilité** (une maquette par couple **Client + Article** si elle n’existe pas déjà).

### Création manuelle
Vous pouvez aussi créer une Maquette manuellement si besoin (si elle n'as pas été crée automatiquement).

---

## 2) Ce qu’il faut renseigner (désignations uniquement)

### Informations de base (obligatoires)
- **Client**
- **Article**

### Fichier (recommandé)
- **Fichier Maquette** : image légère pour consultation (aperçu).  
  Important : **ne pas joindre le fichier source** (AI / PSD / PDF de production) ici.
- **Nom Fichier Maquette** : nom du fichier source (texte), si vous devez le tracer.

### Couleurs (selon le cas)
Dans l’onglet **Couleur** :
- **Mode Couleur**
- Si le mode inclut **CMJN** :
  - **Détails CMJN** (au moins 1 ligne)
- Si le mode inclut **Pantone** :
  - **Couleurs Spot** (au moins 1 couleur)

Le **Résumé Couleurs** se remplit automatiquement.

### Suivi / commentaires (selon le cas)
Dans l’onglet **Suivi** :
- **Description des changements** (utile surtout lors d’une nouvelle version)
- **Observations internes** (notes internes)
- **PV Destruction** (lecture seule, si un PV existe)
- **Date Activation** (lecture seule)

---

## 3) Comprendre les statuts

### A référencer
- La maquette existe dans le système mais n’est pas encore “rangée/référencée” correctement.
- C’est généralement le statut initial.

### Référencée
- À utiliser quand le fichier source a été **rangé/renommé** correctement selon l’ID de la maquette.

### Version Activée
- C’est la **version officielle** à utiliser pour la production pour cet article.
- Il ne doit y avoir **qu’une seule** version activée par article.

### Obsolète
- Ancienne version remplacée par une nouvelle version activée.

### Détruite
- Version détruite physiquement (traçabilité via PV si applicable).

---

## 4) Workflow recommandé (étapes simples)

### Étape A — Vérifier les informations
1. Ouvrir la Maquette.
2. Vérifier **Client** et **Article**.
3. Joindre/mettre à jour **Fichier Maquette** (aperçu) si nécessaire.
4. Renseigner l’onglet **Couleur** (Mode Couleur + détails requis).

### Étape B — Marquer comme “Référencée”
À faire uniquement après avoir **renommé/rangé le fichier source** dans le serveur/répertoire des maquettes avec l’**ID** de la maquette.
1. Ouvrir la Maquette.
2. Cliquer **Référencée**.
3. Confirmer.

Résultat : la maquette passe à **Référencée** et l’utilisateur est tracé automatiquement comme “référencé par”.

### Étape C — Activer la version
Quand cette version doit devenir la version officielle :
1. Ouvrir la Maquette (statut **Référencée** ou **Obsolète**).
2. Cliquer **Activer**.
3. Confirmer.

Résultat :
- Cette maquette passe à **Version Activée**.
- S’il existe une autre version déjà activée pour le même article, elle passe automatiquement à **Obsolète**.

### Étape D — Créer une nouvelle version (versioning)
À faire lorsque vous avez une modification à apporter à une version déjà activée.
1. Ouvrir une maquette **Version Activée**.
2. Cliquer **Nouvelle Version**.
3. Saisir une **Description des changements** (obligatoire).
4. Valider.

Résultat :
- Une nouvelle maquette est créée avec une **Version** incrémentée et une **Version d’origine**.
- Si une version était activée, un **PV de destruction** peut être créé automatiquement pour tracer l’ancienne (selon vos règles internes).

---

## 5) Règles importantes à respecter
- **Une seule “Version Activée” par article**.
- Ne joignez dans **Fichier Maquette** qu’une **image d’aperçu**.
- Si **Mode Couleur** inclut CMJN : vous devez avoir des lignes dans **Détails CMJN**.
- Si **Mode Couleur** inclut Pantone : vous devez avoir au moins une ligne dans **Couleurs Spot**.
- Documentez les changements dans **Description des changements** quand vous créez une nouvelle version.

---

## 6) À propos des versions et de l’ID
L’ID de la maquette est généré automatiquement à partir de l’article et du numéro de version (format de type “MAQ-…-V…”).  
La **Version d’origine** permet de remonter à la maquette depuis laquelle la version a été créée.

---

## Questions fréquentes

### Je ne vois pas le bouton “Référencée”
Il apparaît seulement quand la maquette est au statut **A référencer** et déjà enregistrée.

### Je ne vois pas le bouton “Activer”
Il apparaît quand la maquette est **Référencée** (ou parfois **Obsolète** selon vos cas) et déjà enregistrée.

### Je ne peux pas enregistrer le mode couleur
Vérifiez que vous avez rempli les informations requises :
- Mode incluant **CMJN** → ajoutez au moins une ligne dans **Détails CMJN**
- Mode incluant **Pantone** → ajoutez au moins une couleur dans **Couleurs Spot**

---

### Support
En cas de blocage (statut, activation, version), contactez le responsable Pré-presse avec l’ID de la maquette.