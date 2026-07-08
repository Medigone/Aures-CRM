## Guide d’utilisation — BAT (Bon À Tirer)

### Objectif
Le **BAT** sert à **valider l’aspect visuel et technique** d’un article avant production, en conservant une traçabilité claire :
- validation **électronique** (BAT-E),
- validation **physique** (BAT-P),
- historique des versions et statut (Nouveau / Validé / Obsolète).

---

## 1) Quand un BAT est créé
Un BAT est généralement créé :
- **depuis une Étude Technique** (pré-presse), ou
- **manuellement** par le service Pré-presse si nécessaire.

Les informations **Client**, **Article**, **Tracé**, **Maquette** et leurs fichiers liés sont en grande partie **récupérées automatiquement**.

---

## 2) Ce que vous devez renseigner (désignations uniquement)

### Informations à vérifier
- **Client** / **Nom Client**
- **Article** / **Désignation Article**
- **Étude Technique** (si le BAT est lié à une étude)

### Informations importantes à compléter
- **Code BAT Client** : référence/version côté client (si communiquée par le client).
- **Image BAT** : image **Tracé + Maquette** (sans en-tête), utilisée pour visualiser le BAT.
- **Fichier Validé** : document/fichier **validé par le client** (obligatoire pour valider un BAT-E).

### Documents liés (consultation)
Dans **Documents Liés**, vous retrouvez typiquement :
- **Tracé** + **Dimensions Tracé** + **Fichier Tracé**
- **Maquette** + **Fichier Maquette**

---

## 3) Comprendre les statuts

### Nouveau
BAT créé, en attente de validation client.

### BAT-E Validé (validation électronique)
Le client a validé **électroniquement** (email, PDF signé, validation digitale…).

### BAT-P Validé (validation physique)
Le client a validé **physiquement** (échantillon papier / signature sur tirage / bon physique).

### Obsolète
BAT remplacé par une version plus récente (il ne doit plus être utilisé).

---

## 4) Workflow recommandé (étapes simples)

### Étape A — Préparer le BAT
1. Ouvrir le BAT.
2. Vérifier **Client** et **Article**.
3. Renseigner **Code BAT Client** si disponible.
4. Joindre **Image BAT** (aperçu Tracé + Maquette).
5. Joindre **Fichier Validé** dès que vous avez la validation client (même avant de “valider” le BAT).

### Étape B — Valider le BAT-E
Quand la validation électronique est reçue :
1. Vérifier que **Fichier Validé** est bien joint.
2. Cliquer **BAT-E Validé**.
3. Sauvegarder (le système trace automatiquement “BAT électronique Validé par”).

Règle : **sans “Fichier Validé”, on ne peut pas valider BAT-E**.

### Étape C — Valider le BAT-P
Quand la validation physique est confirmée :
1. S’assurer que le BAT est déjà au statut **BAT-E Validé**.
2. Cliquer **BAT-P Validé** et confirmer.
3. Le système trace automatiquement “BAT physique Validé par”.

Règle importante : il ne peut y avoir **qu’un seul BAT-P Validé** par article à la fois.
- Si un autre BAT-P est déjà validé sur le même article, vous devez d’abord le passer en **Obsolète**.

### Étape D — Marquer un BAT comme Obsolète
À faire dès qu’une nouvelle version remplace l’ancienne :
1. Ouvrir le BAT (BAT-E Validé ou BAT-P Validé).
2. Cliquer **Obsolète** et confirmer.
3. Le système trace automatiquement “BAT Obsolète par”.

---

## 5) Bonnes pratiques
- Toujours joindre une **Image BAT** claire (sans en-tête) pour consultation rapide.
- Conserver dans **Fichier Validé** la preuve de validation client (PDF validé, bon signé, etc.).
- Utiliser **Code BAT Client** pour reprendre exactement la référence utilisée dans les échanges client.
- Mettre l’ancien BAT en **Obsolète** avant d’en valider un nouveau en BAT-P pour le même article.
- En cas de doute, vérifier dans **Documents Liés** que le **Tracé** et la **Maquette** correspondent bien à la version en cours.

---

## 6) À propos de l’ID et des versions
L’ID du BAT est généré automatiquement avec :
- l’article,
- la date,
- et un numéro de version (V1, V2, …) si plusieurs BAT sont créés le même jour pour le même article.

---

## Questions fréquentes

### Je ne vois pas le bouton “BAT-E Validé”
Il apparaît lorsque le BAT est au statut **Nouveau** et déjà enregistré.

### Le système refuse “BAT-E Validé”
Vérifiez que **Fichier Validé** est joint.

### Le système refuse “BAT-P Validé”
Deux causes fréquentes :
- le BAT n’est pas encore **BAT-E Validé**,
- il existe déjà un autre **BAT-P Validé** pour le même article : passez l’ancien en **Obsolète**, puis validez le nouveau.

### Quand utiliser “Obsolète” ?
Dès qu’un BAT n’est plus la référence (nouvelle version, changement maquette/tracé, correction client), mettez l’ancien BAT en **Obsolète** pour éviter toute confusion en production.