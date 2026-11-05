# Poste de bureau Aures (`/bureau`)

Application de bureau pour les équipes internes, à côté du Desk. Le premier module sert au back office (rôle `Administrateur Ventes`).
Cahier des charges de la V1 et maquette : voir les liens transmis au projet.

## Lot 1 (livré) : lecture
- **Liste de travail** : recherche, filtres combinables, choix de la vue avec ses compteurs dans le panneau Filtres, tri par urgence puis échéance.
- **Ticket** : en-tête, étape active, demande du commercial, urgence à décider, créance, rapprochement et liste de contrôle, en lecture seule.
- **Colonne de droite** : timeline, documents (ouverts dans une nouvelle fenêtre), cycle du dossier (ouvert sur le Desk).
- **Accès** : `Administrateur Ventes`, `System Manager`, `Administrator`. Les autres comptes reçoivent un refus, dans la page comme dans l'API.

## Lot 2 (livré) : traitement
- **Workflow** : Démarrer, Mettre en pause, Reprendre, Débloquer, Terminer, Annuler. Le serveur dit quelles actions sont permises ; le blocage créance passe par la carte Créance, qui exige un motif.
- **Décisions** : urgence (niveau accordé, commentaire obligatoire pour refuser), créance, rapprochement avec commentaire, liste de contrôle, attribution.
- **Fichiers** : ajout de fichiers privés au ticket ; chacun peut retirer ce qu'il a joint, tant que le ticket est ouvert.
- **Temps réel** : l'événement `aures_bureau_update` (`aurescrm/bureau_events.py`) ne porte que des identifiants ; la file et le ticket ouvert se rechargent.
- **Conflits** : chaque action envoie la date `modified` affichée. Si le ticket a changé entre-temps, l'action est refusée et l'écran se recharge, sans perdre la saisie.

Les créations (demande de faisabilité, dossier essai à blanc, commande, article) restent sur le Desk jusqu'aux lots 3 et 4.

## Liste, aperçu et fiche

- **Liste** (`/bureau`) : tableau pleine largeur, trié par urgence puis échéance, ou par la colonne choisie. Recherche et filtres combinables en haut, avec le choix de la vue en tête du panneau Filtres. L'étape de chaque ligne vient de `compute_steps` ; `_queue_documents` lit les cycles en une seule fois, et un test vérifie que la liste et la fiche donnent la même étape.
- **Aperçu** (`/bureau?apercu=TC-…`) : tiroir à droite, par-dessus la liste, sans fond grisé. La liste reste cliquable pour changer de ticket. Un double clic sur une ligne ouvre directement la fiche.
- **Fiche** (`/bureau/ticket/TC-…`) : pleine page, avec retour à la liste et passage au ticket voisin de la vue affichée. Depuis l'aperçu, cliquer sur une étape ouvre la fiche à cette étape (`?etape=`).
- La liste reste montée pendant qu'une fiche est ouverte : sa sélection et son défilement sont conservés.

## Pagination et tri

- `get_queue` lit toute la vue avec peu de colonnes, la trie côté serveur, puis calcule les étapes de la seule page demandée. Il renvoie aussi le total et `names`, l'ordre de toute la vue, pour aller au ticket voisin depuis la fiche.
- **Tailles** : 20 (par défaut), 100 ou 500 lignes par page. Le choix reste sur l'appareil, et la vue et la page restent dans l'adresse (`?vue=mine&page=3`).
- **Tri** : par colonne, ou urgence puis échéance par défaut. L'étape ne trie pas : elle se calcule ligne par ligne. Les lignes sans valeur restent à la fin dans les deux sens.
- **Sélection** : la case de tête coche la page affichée. Changer de page, de vue ou de taille vide la sélection.
- **Colonnes** : Commercial et Créance s'ajoutent par le menu Colonnes. **Exporter** écrit en CSV toute la vue avec les colonnes affichées, au format d'Excel en français.

## Créer un ticket

- « Nouveau ticket » ouvre une fenêtre par-dessus la liste (`shared/components/FormDialog.vue`, `bureau/src/components/NewTicketDialog.vue`). `create_ticket` passe par `doc.insert()`, avec les validations et les droits habituels.
- **Commercial** : celui du client (`custom_commercial_attribué`), modifiable. **Urgence** : fixée par le type, comme le veut le serveur : la fenêtre l'annonce, sans la laisser choisir.
- **Après la création** : la nouvelle ligne est surlignée sur la vue À traiter, avec un lien vers sa fiche. « Créer et en saisir un autre » garde le client, le site, le commercial et le canal.
- **Pièces jointes** : envoyées après la création. Un échec ne perd pas le ticket, et le message le signale.

## Clients

- **Adresses** : liste sous `/bureau/clients` (`?vue=creance&page=2&apercu=CLI-…`), fiche sous `/bureau/clients/CLI-…?onglet=affaires`. Même modèle que les tickets : un clic ouvre l'aperçu, un double clic ouvre la fiche, et la liste reste montée pendant la fiche.
- **Serveur** : `aurescrm/api/bureau_clients.py`. `get_clients` lit toute la vue, la trie, puis renvoie une page, le total, `names` et les compteurs des vues. Le tri se fait aussi sur la créance, la dernière visite et les tickets.
- **Créance** : le solde vient de `Creance Client` (créances non soldées), comme dans la PWA, et non de `Suivi Creance`.
- **Dernière visite** : la plus récente à la date du jour ou avant. Une visite à venir ne compte pas.
- **Fiche** : une colonne d'identité à gauche, visible sur tous les onglets (tags, actions, contact, commercial, adresse, profil), cinq onglets au centre (Aperçu, Affaires, Articles, Visites et appels, Informations), et le fil Commentaires et activité à droite, hors des onglets. Sous 1280 px, le fil passe sous le contenu. Un document lié que le rôle ne peut pas lire donne une liste vide, sans erreur.
- **Droits** : ceux du Desk (`get_customer_edit_status`, `can_view_customer_activity`). Sans le droit, Modifier et le fil disparaissent, et le serveur refuse l'écriture.
- **Nouveau prospect** : raison sociale, forme juridique, catégorie, commune et commercial sont obligatoires. La wilaya découle de la commune, et le statut est toujours Prospect. Le commercial devient le principal de la société dans la table d'attributions.
- **Modifier** : seuls les champs changés partent, avec la date `modified` affichée. Si le client a changé entre-temps, l'enregistrement est refusé.
- **Commune** : le nom d'une commune est un identifiant. Le serveur renvoie aussi `commune_label`, seul affiché à l'écran.
- **Encore sur le Desk** : nouvelle visite, nouveau rendez-vous et nouvel appel, ouverts dans une nouvelle fenêtre.

## Articles

- **Adresses** : liste sous `/bureau/articles` (`?vue=sans_bat&page=2&apercu=CLI-…`), fiche sous `/bureau/articles/CLI-…?onglet=prepresse`. Même modèle que les clients.
- **Serveur** : `aurescrm/api/bureau_articles.py`. `get_articles` lit toute la vue, la trie, puis renvoie une page, le total, `names` et les compteurs des vues.
- **Statut** : un article n'a pas de champ de statut. La pastille montre son dernier BAT : le plus récent encore en vigueur, sinon le plus récent devenu obsolète. La vue « Sans BAT validé » écarte les articles généraux.
- **Écart de BAT** : une alerte signale un BAT validé dont la maquette n'est plus la version activée (`bat_gap`). Sans maquette renseignée sur le BAT, rien n'est signalé.
- **Fiche technique** : les champs viennent d'`article_schema`, avec les conditions du Desk évaluées par `shared/fiche.ts`, commun avec la PWA. Un article Offset ne montre que les champs Offset, et seuls les champs renseignés apparaissent à la lecture. `CARD_OF` (`bureau/src/lib/articles.ts`) les range par sujet.
- **Onglets** : Aperçu, Fiche technique, Sous-articles (article composé), Prépresse, Affaires. Le fil Commentaires et activité reste à droite, hors des onglets. Un article général n'a ni fiche technique ni prépresse, et son action principale est Modifier.
- **Tickets** : un ticket ne porte pas d'article. Il se retrouve par sa demande de faisabilité, son dossier d'essai ou son devis rapproché. Un ticket sans aucune de ces pièces n'apparaît donc pas sur la fiche, et Nouveau ticket ne préremplit que le client.
- **Devis et commandes** : une ligne par ligne d'article : la quantité et le prix sont ceux de l'article, pas le total de la pièce.
- **Nouvel article** : désignation, groupe, et pour un article client, le client et le procédé. Le code vient de `custom_item_naming`. Un client n'a qu'un article de ce nom.
- **Envoi de fichiers** : `shared/components/FileUploader.vue`, commun aux fiches article, client et ticket et à la création de ticket. La PWA garde son propre choix de pièces : ses saisies partent hors ligne dans la file d'envoi. Plusieurs fichiers à la fois (trois en parallèle), avancement par fichier, annulation et reprise. La limite vient du serveur (`get_max_file_size`, 25 Mo par défaut ; nginx bloque au-delà de 50 Mo).
- **Modifier** : seuls les champs changés partent, avec la date `modified` affichée. Le client et le type d'article ne se changent pas depuis /bureau, car ils décident du code.
- **Prépresse** : une chaîne (tracé, maquette, imposition ou cliché, BAT) et la prochaine étape, puis la maquette en service, le BAT en vigueur et les historiques repliés. Référencer, activer, créer une nouvelle version et créer le BAT passent par les mêmes méthodes que les boutons du Desk, avec le droit d'écriture sur le document, et leurs conséquences s'annoncent avant.
- **Documents** : tous les fichiers de l'article, une ligne par fichier. Le menu d'une ligne le range comme image, BAT (le champ `custom_fiche_technique_article`) ou tracé. Un dépôt marche partout sur la fiche, et l'envoi reste visible d'un onglet à l'autre.
- **Encore sur le Desk** : l'étude de faisabilité, la création du tracé, de la maquette, de l'imposition et de l'étude technique, et la validation du BAT.

## Commentaires et activité

- Le fil (`shared/components/ActivityFeed.vue`, `aurescrm/api/activity.py`) lit `Comment`, `Version` et `Communication`, les mêmes sources que la timeline du Desk. Un commentaire écrit ici se lit sur le Desk, et inversement.
- `@` mentionne une personne au format du Desk, qui lui envoie sa notification. Chacun modifie et supprime ses seuls commentaires.
- **Le texte seul est affiché** : aucun HTML ne quitte le serveur. Une image ou une mise en forme écrite sur le Desk ne s'affiche donc pas ici.
- Les champs masqués du formulaire n'apparaissent pas dans l'historique, sauf ceux de `SHOWN_HIDDEN_FIELDS` (le statut).

## Actions groupées

Toute liste construite sur `DataList` les obtient en déclarant `bulk-doctype`, et son DocType dans `BULK_DOCTYPES` (`aurescrm/api/bureau_bulk.py`). C'est aujourd'hui le cas des tickets et des clients. Le serveur refuse tout autre DocType.

- **Sélection** : cases à cocher, Tout cocher sur la page (jusqu'à 500 lignes), Shift + clic pour un intervalle, Ctrl + clic sur la ligne. Une action ne touche jamais une ligne cachée. Changer de vue, de page, de recherche, de filtre ou de tri vide la sélection.
- **Actions communes** : Modifier (un champ, une valeur), Tags (ajout seulement), Exporter (CSV des lignes cochées, colonnes affichées), Supprimer (avec le droit `delete` et une confirmation).
- **Actions des tickets** : attribuer (`bulk_assign`), Démarrer et Mettre en pause (`bulk_action`). Terminer, Annuler et la créance restent ticket par ticket : ils dépendent d'une liste de contrôle ou d'un motif, ou sont difficiles à défaire.
- **Champs de Modifier** : ceux du Desk, recalculés par le serveur à chaque écriture. Ne sont pas proposés : un champ masqué, en lecture seule, virtuel, `set_only_once`, l'état du workflow, un champ sans droit de niveau, un champ recopié par `fetch_from`, et les types sans saisie ici (éditeur riche, fichier, signature). Chaque DocType exclut en plus les champs qui ont leurs propres règles : créance, rapprochement et liste de contrôle des tickets, raison sociale des clients. Le commercial d'un client passe par la table d'attributions.
- **Envoi** : par lots de 50 depuis le navigateur, 100 lignes au plus par requête. Chaque ligne est validée à part avec sa date `modified` : un refus n'empêche pas les autres, et l'écran liste les lignes non traitées avec leur raison. Un lot en erreur arrête la suite, et l'écran indique ce qui n'est pas parti.
- **Suppression** : un document soumis ou lié à d'autres est refusé. Le Desk garde une copie dans `Deleted Document`. Le dossier Nextcloud d'un client supprimé reste en place.
- **Tags** : les mêmes que sur le Desk (`_user_tags`). Voir ci-dessous.

## Tags

- **Liste** : colonne en lecture seule, visible par défaut sur les clients et à ajouter par le menu Colonnes sur les tickets, faute de largeur. Elle montre les premiers tags puis le nombre restant, et tous au survol. Un filtre « Tag » existe sur les deux listes.
- **Tiroir et fiche** : au même endroit, sous la ligne d'identification. Avec le droit d'écriture, on retire un tag d'un clic et on en ajoute un parmi ceux qui existent, ou un nouveau (`add_doc_tag`, `remove_doc_tag`).
- **Date `modified`** : poser ou retirer un tag ne la change pas, comme sur le Desk.

## Disposition et densité

- Sur ordinateur, la page ne défile pas : la liste et le détail du ticket ont chacun leur défilement, et l'en-tête du ticket reste visible. En dessous de 900 px de large, la page reprend le défilement et l'aperçu prend tout l'écran.
- Les tailles viennent de la densité Poste (`data-density="poste"` dans `bureau/index.html`, valeurs dans `shared/tokens.css`) : texte courant de 13 px, boutons et champs de 32 px (variable `--ctl`, 44 px sur écran tactile). Voir `docs/STYLE_AURES.md`.
- Le thème suit celui de l'appareil. Le menu du compte force clair ou sombre, sous la clé `bureau-theme`.
- **Coquille** (`shared/components/AppShell.vue`) : barre du haut et menu de gauche. Le menu démarre replié sous 1 440 px de large, pour laisser la place au tableau, et garde ensuite le choix de l'utilisateur (clé `bureau-menu`). Sur téléphone, il devient une barre en bas de l'écran.
- **Menu** : les entrées sans écran dans le poste de bureau (Commandes, Devis, Créances, Articles) ouvrent le Desk dans une nouvelle fenêtre.
- **Palette de commandes** (`Cmd K` ou `Ctrl K`, ou clic sur la barre du haut) : créer un ticket, un article ou un prospect depuis n'importe quelle page, ouvrir une liste ou l'une de ses vues, et chercher les tickets (ouverts et clos), les clients et les articles. Les listes de commandes sont dans `bureau/src/lib/palette.ts`. L'adresse commande la vue : `/clients?vue=prospect` ouvre les prospects, même depuis la page Clients.
- Une classe dont le nom est composé à l'exécution (`urgence-${niveau}`) doit figurer dans `safelist`, sinon le build la retire.

## Organisation du code
| Élément | Emplacement |
| --- | --- |
| Application Vue | `bureau/` |
| Socle partagé avec la PWA commerciale | `shared/` |
| Page et informations de démarrage | `aurescrm/www/bureau.py` |
| Connexion | `bureau/src/pages/LoginPage.vue`, `bureau/src/components/LoginLayout.vue` |
| API et calcul des étapes | `aurescrm/api/bureau.py` |
| API des clients | `aurescrm/api/bureau_clients.py` |
| API des articles | `aurescrm/api/bureau_articles.py` |
| Temps réel | `aurescrm/bureau_events.py` |
| Tests serveur | `aurescrm/tests/test_bureau.py` |

Les étapes de la timeline se calculent dans une seule fonction : `compute_steps`.

## Construire et tester
```bash
yarn install
bench build --app aurescrm
bench --site aurescrm.intrapro.net run-tests --module aurescrm.tests.test_bureau
```
```bash
cd bureau && yarn test && yarn typecheck
```

`aurescrm/public/bureau/` et `aurescrm/www/bureau.html` sont générés et ne sont pas commités.

## Connexion

Le poste a sa page, `/bureau/connexion`, sur la même base que celle de `/commercial`. Un visiteur sans session y est envoyé avec la page demandée (`?redirect-to=`), et la déconnexion y ramène. La session reste celle du site : se connecter ici connecte aussi au Desk, et se déconnecter déconnecte des deux. `/login` reste la page du Desk.

Si la session expire pendant le travail, le prochain appel au serveur renvoie vers cette page, avec la page en cours pour y revenir. Le signal est un refus 401 ou 403 accompagné du champ `session_expired` de Frappe ou de l'absence du cookie `user_id` : un simple refus de droit, session valide, ne déconnecte personne. Ce qui était en cours de saisie est perdu.

Un compte connecté sans le rôle voit le refus d'accès dans `App.vue`, avec « Changer de compte ».
