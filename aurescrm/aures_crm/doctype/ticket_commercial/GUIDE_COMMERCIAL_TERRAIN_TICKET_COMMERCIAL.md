# Ticket commercial — Guide à l’usage des commerciaux terrain (Aures Emballages)

Ce document est destiné aux **commerciaux itinérants** et à toute personne en **contact direct chez le client** (visites, salons, livraisons ponctuelles, collecte d’informations sur le terrain). Il complète le guide général `GUIDE_UTILISATION_TICKET_COMMERCIAL.md` en mettant l’accent sur **l’enchaînement visite → saisie → transmission au back-office**.

---

## 1. Pourquoi le ticket commercial est central au front-office

Le **front-office commercial** est le relais entre **ce que le client exprime** et **ce que l’entreprise exécute** (devis, commandes, production, qualité, données maîtres). Hors du bureau, le risque principal est la **perte ou la déformation de l’information** (message vocal, photo sur téléphone, note sur un carnet sans suite dans l’ERP).

Le **ticket commercial** sert à :

- **Formaliser une demande** issue du terrain en une fiche unique, identifiable (numéro `TC-YY-MM-#####`), consultable par les équipes habilitées.
- **Tracer** qui a saisi quoi, pour quel client, avec quelle priorité et quel type de demande — utile pour les litiges, le suivi client et l’amélioration continue.
- **Donner au back-office un dossier exploitable** : contexte, délai, canal d’origine, description structurée, pièces jointes éventuelles.
- **Enclencher la chaîne de valeur** : depuis un ticket, le back-office ou les profils autorisés peuvent préparer des actions ERP (par exemple faisabilité ou article) sans refaire la collecte d’informations auprès du commercial.

En résumé : **un ticket = une intention client clairement posée dans l’ERP**, pas seulement une conversation informelle.

---

## 2. Quand créer un ticket (scénarios terrain)

Créez un ticket **dès que la visite ou l’échange génère une action interne**, même si vous pensez « transmettre plus tard par téléphone ». Exemples typiques :

| Situation sur le terrain | Intérêt du ticket |
|--------------------------|-------------------|
| Le client demande un **devis** ou une **relance de prix** | Priorisation, historique, pièces techniques à centraliser |
| Besoin de **bon de commande** ou de validation administrative | Le sédentaire / admin ventes dispose d’un contexte daté |
| **Nouveau besoin** (création client, nouveau flux, nouveau conditionnement) | Évite les doublons et aligne CRM / ERP |
| **Information production** (contrainte machine, délai, spécification atelier) | Fait remonter le bon niveau de détail sans jeu de téléphone |
| **Mise à jour des données** (contact, adresse de livraison, raison sociale) | Traçabilité des changements |
| **Réclamation** ou non-conformité perçue chez le client | Description + preuves ; base pour traitement qualité / admin |
| **Essai blanc** ou demande technique liée à un futur article | Lien avec les processus faisabilité / article si ouverts depuis le ticket |

Si deux sujets distincts ressortent de la même visite, **deux tickets** sont en général préférables à un seul ticket « fourre-tout ».

---

## 3. Accès rapide depuis le terrain

- **Module Aures CRM** : document **Ticket Commercial**.
- **Espace de travail « Visites »** : raccourci vers les tickets commerciaux (accès pratique depuis le contexte tournées).
- **Recherche globale** (barre du haut) : taper `Ticket Commercial` puis ouvrir la liste ou un document.

Sur mobile ou tablette, privilégiez une **connexion stable** avant d’enregistrer une description longue ou de joindre des fichiers volumineux.

---

## 4. Étapes de création (parcours recommandé)

1. **Nouveau** ticket depuis la liste.
2. Choisir le **Client** (obligatoire) : le **nom client** et le **commercial** affiché sur la fiche sont issus des données client ; assurez-vous que le **bon client** est sélectionné (filiale, raison sociale exacte).
3. Renseigner le **Type** de demande (obligatoire) : choisir la valeur la plus proche du besoin réel.
4. Choisir la **Priorité** (obligatoire) : *Basse*, *Moyenne* (souvent suffisante), *Haute* uniquement si un enjeu fort (risque commande, arrêt ligne client, date butoir critique).
5. Indiquer le **Canal** si pertinent : *Email*, *WhatsApp*, *Raven*, *Autre* (ex. : échange **en face à face** ou **téléphone** → utiliser *Autre* et préciser dans la description).
6. Renseigner l’**Échéance** si le client a une **date cible** (livraison, réponse, envoi d’échantillon). Ce repère aide le back-office ; il peut aussi servir de base pour certaines créations liées (ex. date sur une demande de faisabilité).
7. Rédiger la **Description détaillée** : voir section 6.
8. **Joindre** les fichiers utiles (photos d’étiquettes, bon de commande client scanné, PDF, captures) via la **zone de pièces jointes** standard du document ERPNext (icône trombone / section pièces jointes selon l’interface).
9. **Enregistrer**. Le ticket est visible selon les règles de droits ; le **statut** initial est **Nouveau** et le **workflow** est piloté par le rôle **Administrateur Ventes** (actions *Démarrer*, *Pause*, *Reprendre*, *Terminer*, etc.).

Tant que le statut n’est pas **Terminé** ou **Annulé**, vous pouvez en général **compléter ou corriger** votre ticket (dans la limite de vos droits « propriétaire » sur le document).

---

## 5. Champs utiles à connaître (référence terrain)

| Champ | Rôle pour vous |
|--------|----------------|
| **Client** | Point d’ancrage de toute la suite ; erreur ici = mauvaise commande ou mauvais interlocuteur interne. |
| **Type** | Catégorise la demande pour le routage et les tableaux de bord. Valeurs prévues : *Création*, *Bon de commande*, *Demande de devis*, *Information Production*, *Mise à jour données*, *Réclamation*, *Essai Blanc*, *Autre*. |
| **Priorité** | Signal d’urgence ; à utiliser avec parcimonie pour rester crédible. |
| **Canal** | Mémoire de l’origine de la demande ; utile si le client réclame une trace. |
| **Échéance** | Date à laquelle le client attend une suite mesurable. |
| **Description détaillée** | Cœur du ticket : tout ce que le back-office ne peut pas deviner. |
| **Créé par** | Identifie l’auteur de la saisie (vous ou un collègue). |
| **Commercial** (affiché) | Rappel du commercial **rattaché au client** dans la base ; vérifiez la cohérence avec la réalité du compte. |

Les champs **Assigné à** et boutons **Attribuer** sont réservés au profil **Administrateur Ventes** : le terrain ne « force » pas l’assignation ; en cas d’urgence, utilisez la **priorité** et la **description** pour signaler le besoin.

---

## 6. Rédiger une description « prête back-office »

Après une visite, une bonne description répond implicitement à :

- **Qui** chez le client (nom, fonction, téléphone ou email si utile).
- **Quoi** exactement (références article, quantités, dimensions, ancien / nouveau conditionnement).
- **Quand** le client attend une réponse ou une livraison.
- **Où** livrer ou contacter si différent du siège habituel.
- **Pièces / preuves** : indiquer ce qui est joint (photo étiquette, N° de lot, etc.).

Évitez les intitulés vagues du type « devis à faire » sans quantité ni délai.

---

## 7. Après le ticket : actions possibles sur la fiche

Selon vos **droits** dans l’ERP, des boutons **Créer** peuvent apparaître sur le ticket (tant qu’il n’est pas clos de façon définitive) :

- **Demande de faisabilité** : ouvre une nouvelle demande en préremplissant notamment le **client** et une **date de livraison** (à partir de l’échéance du ticket si elle est renseignée).
- **Article** : ouvre un nouvel article avec le **client** prérempli.

Ces raccourcis réduisent les **re-saisies** et les erreurs lorsque le terrain a déjà posé le bon client sur le ticket.

---

## 8. Suivi côté commercial terrain

- La **liste** affiche notamment client, commercial, type, priorité et statut.
- Utilisez les **filtres** (client, statut, type, priorité) pour préparer une **tournée** ou un **rappel client** (« tout ce qui est encore Nouveau / En cours pour ce compte »).
- Les **couleurs de statut** dans le workflow permettent un coup d’œil rapide : *Nouveau*, *En Cours*, *Pending*, *Terminé*, *Annulé*.

Les profils **Commercial itinérant** et **Commercial sédentaire** voient en principe les tickets dont ils sont **propriétaires** (création) selon la configuration des droits ; le **back-office Administrateur Ventes** a une vision élargie et fait avancer les états.

---

## 9. Bonnes pratiques spécifiques terrain

1. **Saisir tôt** : idéalement avant de quitter le parking ou le site, pendant que les détails sont frais.
2. **Un besoin = un ticket** (sauf dossiers indissociables).
3. **Photos nettes** pour réclamations ou identifications (étiquette, emballage secondaire, palette).
4. **Cohérence canal** : si le client a tout envoyé par WhatsApp, indiquez *WhatsApp* et résumez ou copiez l’essentiel dans la description (sans données personnelles inutiles).
5. **Ne pas surestimer la priorité Haute** : le back-office traite d’abord ce qui est crédiblement urgent.

---

## 10. FAQ courte

**Puis-je modifier mon ticket après enregistrement ?**  
Oui tant qu’il n’est pas en lecture seule (statuts **Terminé** ou **Annulé** verrouillent le formulaire).

**Qui fait passer le statut de Nouveau à En cours ?**  
Le rôle **Administrateur Ventes**, via le workflow (action *Démarrer*, etc.).

**Le client existe encore mal dans l’ERP : que faire ?**  
Utilisez le type le plus adapté (*Création* ou *Mise à jour données*) et décrivez précisément les corrections ; ne validez pas une commande sur un mauvais compte client.

**Je n’ai pas accès aux boutons Créer (faisabilité / article) :**  
C’est lié à vos droits ERP ; transmettez via le ticket : le back-office pourra enchaîner.

---

## 11. Document de référence métier

Une synthèse Front-Office (document Word « Synthèse – Front-Office Commercial ») peut compléter ce guide sur les **missions** et **rôles** ; si ce document est mis à jour, vérifiez que les **types de demande** et **processus** décrits y sont toujours alignés avec ce guide technique.

---

**Version :** 1.0 — **Public :** commerciaux terrain Aures Emballages — **ERP :** Aures CRM / Ticket Commercial.
