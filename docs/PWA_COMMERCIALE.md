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

## Lots suivants
3. Tickets commerciaux, suivi devis / commandes / fabrication, BAT hors-ligne, réclamations, créances (consultation).
4. Notifications push (VAPID), temps réel, objectifs Pilotage Commercial.

## Développement et déploiement
- Code : `commercial/` (Vue 3 + frappe-ui + Vite). API : `aurescrm/api/commercial_mobile.py`. Entrée : `aurescrm/www/commercial.py`, renderers `aurescrm/www/commercial_page.py` (déclarés dans `hooks.py`).
- `yarn install` à la racine de l'app, puis `bench build --app aurescrm` (lance `yarn build`) ; le build va dans `aurescrm/public/commercial/` et `aurescrm/www/commercial.html` (non commités).
- Après mise à jour : `bench migrate` (doctype **Mutation Commercial**).
- Dev : `yarn dev:commercial` (proxy vers bench) ; tests : `cd commercial && yarn test && yarn typecheck`.
