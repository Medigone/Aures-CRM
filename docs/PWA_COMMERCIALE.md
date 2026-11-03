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

## Lots suivants
2. Saisie hors-ligne (file de mutations idempotente) : visites (workflow, GPS, notes, recouvrement + photo), RDV, appels, prospects.
3. Tickets commerciaux, suivi devis / commandes / fabrication, BAT hors-ligne, réclamations, créances.
4. Notifications push (VAPID), temps réel, objectifs Pilotage Commercial.

## Développement et déploiement
- Code : `commercial/` (Vue 3 + frappe-ui + Vite). API : `aurescrm/api/commercial_mobile.py`. Entrée : `aurescrm/www/commercial.py`, renderers `aurescrm/www/commercial_page.py` (déclarés dans `hooks.py`).
- `yarn install` à la racine de l'app, puis `bench build --app aurescrm` (lance `yarn build`) ; le build va dans `aurescrm/public/commercial/` et `aurescrm/www/commercial.html` (non commités).
- Dev : `yarn dev:commercial` (proxy vers bench) ; tests : `cd commercial && yarn test && yarn typecheck`.
