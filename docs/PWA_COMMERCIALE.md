# PWA commerciale Aures (`/commercial`)

Application mobile installable pour l'équipe commerciale (Commercial Itinérant / Sédentaire, Superviseur CRM).
Elle reprend l'architecture de MediConnect Field : instantané hors-ligne dans IndexedDB, service worker et synchro page par page.

## Lot 1 (livré)
- **Aujourd'hui** : rendez-vous et visites du jour, appels à rappeler, clients à proximité (GPS, 5 km, non vus depuis 30 j), clients actifs sans visite depuis 60 j.
- **Clients** : portefeuille du commercial (attribution legacy + table d'attributions), recherche, filtre statut, tri nom / dernière visite / proximité.
- **Fiche client** : appeler, email, itinéraire ; onglets Articles, Infos, Contacts, Historique (visites, RDV, appels).
- **Articles du client** (`Item.custom_client`, type « Client ») : recherche, filtre par procédé, dernier BAT.
- **Fiche article** :
  - caractéristiques techniques regroupées par section du Desk ;
  - fiche technique et tracé de découpe ;
  - sous-articles ;
  - historique (devis, commandes, BAT, maquettes, réclamations du client), chargé en ligne et gardé pour le hors-ligne.
- **Réglages** : données sur l'appareil, synchro, thème, déconnexion (efface les données locales).

## Lot 2 (livré) : saisies hors-ligne
- **Visites** : planifier ou démarrer une visite. Au démarrage, l'heure et la position GPS sont enregistrées comme preuve de présence.
  - Pendant la visite : notes avec dictée vocale et type de visite.
  - **Recouvrement** : créance du client, montants réclamé et encaissé, résultat, paiement, relance, photo du document. Les règles sont celles du Desk, vérifiées dès la saisie.
  - Terminer (le document est validé selon le workflow), supprimer un brouillon, annuler une visite terminée.
- **Semaine** : planning du dimanche au samedi (semaine passée et deux semaines suivantes), avec visites et rendez-vous, et planification par jour.
- **Rendez-vous** : création, report, changement de statut, « Démarrer la visite » (crée la visite et termine le RDV).
- **Appels** : noter un appel (type, résultat, notes, rappel) et traiter les rappels depuis Aujourd'hui.
- **Prospects** : création avec wilaya, commune et position GPS, et contrôle des doublons. Le prospect est attribué à son créateur.
- **Position d'un client** : enregistrée sur place depuis la fiche client.
- **Synchronisation** : saisies en attente, saisies à corriger (réessayer ou abandonner), et blocage des saisies d'un autre compte.

### Fonctionnement de la file d'envoi
- Chaque saisie s'affiche immédiatement, puis elle est envoyée à `aurescrm.api.commercial_mobile.push_mutations` dans l'ordre de saisie.
- Côté serveur (`aurescrm/api/commercial_mutations.py`), chaque action est appliquée dans un savepoint, puis inscrite au journal **Mutation Commercial**. Une action renvoyée deux fois n'est pas rejouée.
- Une action peut viser un document créé hors-ligne et pas encore envoyé : elle passe alors l'identifiant de l'action de création (`visite_ref`, `client_ref`…), que le serveur résout grâce au journal.
- Une erreur passagère est réessayée après 15 s, 30 s, 1 min, etc. (au plus 30 min d'écart). Après 5 essais, ou dès un refus (validation, droits), la saisie passe dans « À corriger ».
- Une session expirée efface l'instantané mais garde les saisies non envoyées. À la déconnexion, l'application prévient s'il en reste.
- Visite Commerciale : la date suit désormais le jour du début de visite, et non le jour de la synchro.

## Lot 3 (livré) : processus commercial
- **Onglet Suivi** : tickets, devis, commandes et réclamations du portefeuille, avec filtre « en cours / tous » et recherche hors-ligne. Les mêmes listes figurent dans l'onglet **Affaires** de la fiche client.
- **Tickets commerciaux** :
  - **Création**, même hors-ligne : client, type, priorité, canal, site de production, échéance, description dictée, photos et PDF (6 au plus, 5 Mo chacun).
  - **Raccourcis** : depuis la fiche article (« Retirage », « Devis », « Ticket », préremplis avec l'article) et depuis la visite.
  - **Suivi** : statut, prise en charge, statut créance et **cycle** (demandes de faisabilité, études, devis, commandes). Le cycle est chargé en ligne puis gardé sur l'appareil.
  - **Urgence** : demande U1 à U3 avec motif, et retrait de la demande. Les fonctions whitelistées existantes appliquent les règles. La validation reste à l'Administration des ventes.
- **Réclamations** :
  - Le commercial les déclare par un **ticket de type « Réclamation »**, depuis la fiche client ou la visite. La visite d'origine est citée dans la description, et les photos sont jointes au ticket.
  - Les fiches **Réclamations Clients** de Coordination sont consultables, sans saisie possible.
- **Devis** : lignes, montant, validité, statut de commande, commandes liées.
- **Commandes** : BC client, livraison prévue, % livré et facturé, et **avancement de fabrication** (dossier, études techniques, ordres de production avec quantités produites).
- **Créances** : solde, statut et relance dans l'onglet Affaires. Les mouvements sont consultés en ligne puis gardés sur l'appareil.
- **Aujourd'hui → À traiter** : urgences validées ou refusées, tickets bloqués pour créance, réclamations en retard, relances de créances dues.
- **BAT et fichiers hors-ligne** :
  - Les fichiers sont gardés dans le Cache Storage `commercial-contents` (25 Mo par fichier, 200 Mo au total).
  - Après chaque synchro, le dernier BAT des articles des clients qui ont une visite ou un RDV cette semaine est préchargé (30 fichiers au plus).
  - Le bouton « Garder hors-ligne » est disponible sur les BAT, les fiches techniques et les tracés.

API : `aurescrm/api/commercial_affaires.py` fournit les sections `tickets`, `devis`, `commandes`, `reclamations`, `bats`, ainsi que `get_ticket_cycle` et `get_creance_detail`. Les actions `ticket_create`, `ticket_update`, `ticket_urgence_request` et `ticket_urgence_cancel` sont dans `commercial_mutations.py`.

## Lot 4 (livré) : notifications, temps réel, objectifs
- **Notifications push** :
  - **Transport** : Web Push VAPID repris de MediConnect, sans `pywebpush`. Le code est dans `aurescrm/push/`, et les doctypes sont **Parametres Push Commercial** et **Abonnement Push Commercial**.
  - **Activation** :
    1. Dans le Desk, ouvrez **Parametres Push Commercial** et cochez « Activer les notifications push ». Les clés VAPID se génèrent au premier usage. Vous pouvez aussi les fixer dans `site_config` (`aures_vapid_private_key`, `aures_vapid_public_key`, `aures_vapid_subject`).
    2. Chaque commercial active ensuite les notifications dans **Réglages** de l'application. Sur iPhone, l'application doit d'abord être ajoutée à l'écran d'accueil.
  - **Événements envoyés au commercial concerné**, jamais à l'auteur du changement :
    - **Tickets** : prise en charge, urgence validée ou refusée, blocage créance, ticket terminé.
    - **Devis** : devis validé, envoyé aux commerciaux du client.
    - **BAT** : nouveau BAT, BAT-E ou BAT-P validé.
    - **Commandes** : commande confirmée, production terminée (ordre de production).
    - **Réclamations** : réclamation traitée ou non traitée.
  - Chaque commercial peut couper une catégorie. Rien n'est envoyé pendant que l'application est à l'écran, et un même sujet n'est notifié qu'une fois toutes les 2 minutes.
- **Temps réel** :
  - `aurescrm/commercial_events.py`, branché sur `doc_events["*"]` (`on_change`, `on_trash`), publie `aures_commercial_update` aux commerciaux du client (attribution legacy et table d'attributions) et aux utilisateurs du document. L'envoi a lieu après le commit, une fois par document.
  - L'application recharge son instantané par rafales regroupées : 3 s après l'événement, puis au plus une fois toutes les 10 s. Elle ignore ses propres saisies.
- **Mes objectifs** (`/objectifs`, et une carte dans Aujourd'hui) : le Pilotage Commercial du commercial, en lecture seule.
  - Cibles de la période en cours, avec progression.
  - Indicateurs : CA, visites, conversion, couverture, clients actifs.
  - Prochaine revue, actions ouvertes du manager.
  - Visites terminées ce mois-ci sur l'appareil.
  - Les indicateurs sont recalculés chaque nuit (`refresh_all_pilotage_kpis`).

## Développement et déploiement
- Code : `commercial/` (Vue 3 + frappe-ui + Vite). API : `aurescrm/api/commercial_mobile.py`. Entrée : `aurescrm/www/commercial.py`, renderers `aurescrm/www/commercial_page.py` (déclarés dans `hooks.py`).
- `yarn install` à la racine de l'app, puis `bench build --app aurescrm` (lance `yarn build`) ; le build va dans `aurescrm/public/commercial/` et `aurescrm/www/commercial.html` (non commités).
- Après mise à jour : `bench migrate` (doctypes **Mutation Commercial**, **Parametres Push Commercial**, **Abonnement Push Commercial**).
- Dev : `yarn dev:commercial` (proxy vers bench) ; tests : `cd commercial && yarn test && yarn typecheck`.
