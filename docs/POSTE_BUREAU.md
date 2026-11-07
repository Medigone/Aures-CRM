# Poste de bureau Aures (`/bureau`)

Application de bureau pour les équipes internes, à côté du Desk. Le premier module sert au back office (rôle `Administrateur Ventes`).
Cahier des charges de la V1 et maquette : voir les liens transmis au projet.

## Accueil (`/bureau`)
Tableau de bord du back office, dont la mission est de transformer les requêtes en actions et de garder les données à jour. La liste des tickets est passée à `/bureau/tickets`, et les anciens liens (`/bureau?vue=…`) y sont renvoyés.

- **Flux** : une barre de statuts par étape (Tickets, Demandes, Études, Devis, Commandes), le total à droite, les couleurs de statut de chaque document, et les retards en rouge. Au survol ou à l'appui, une part donne son nombre et son statut.
- **À transformer en action** : À décider, À prendre en charge, À transformer en document. Le filtre Toute l'équipe / À moi est dans l'en-tête de la file, le seul bloc qu'il touche. Le serveur dit quelle action chaque ligne permet ; sinon, elle ouvre la fiche, avec un bouton discret qui donne sa raison au survol et au clavier.
- **Données à mettre à jour** : à côté de la file, chaque manque ouvre la liste déjà filtrée (`?filtres=` en JSON, ou `?vue=`), ou le Desk (`↗`).
- **Tendances** : sous la file : tickets reçus et clos par mois (mois de clôture lu dans l'historique du ticket), ancienneté des tickets ouverts, complétude des fiches. Le masquage est retenu par navigateur.

Règles dans `aurescrm/api/bureau_accueil.py` (seuil « sans mouvement » : `STALE_DAYS`), mise en forme dans `bureau/src/lib/accueil.ts`. Un bloc disparaît pour un rôle qui ne lit pas le document.

## Lot 1 (livré) : lecture
- **Liste de travail** : recherche, filtres combinables, choix de la vue avec ses compteurs dans le panneau Filtres, tri par urgence puis échéance.
- **Ticket** : en-tête, demande du commercial, urgence à décider, pièces du dossier, créance, rapprochement, en lecture seule.
- **Colonne de droite** : timeline, documents (ouverts dans une nouvelle fenêtre), cycle du dossier (ouvert sur le Desk).
- **Accès** : `Administrateur Ventes`, `System Manager`, `Administrator`. Les autres comptes reçoivent un refus, dans la page comme dans l'API.

## Lot 2 (livré) : traitement
- **Workflow** : Démarrer, Mettre en pause, Reprendre, Débloquer, Terminer, Annuler. Le serveur dit quelles actions sont permises ; le blocage créance passe par la carte Créance, qui exige un motif.
- **Décisions** : urgence (niveau accordé, commentaire obligatoire pour refuser), créance, rapprochement avec commentaire, liste de contrôle, attribution.
- **Fichiers** : ajout de fichiers privés au ticket ; chacun peut retirer ce qu'il a joint, tant que le ticket est ouvert.
- **Temps réel** : l'événement `aures_bureau_update` (`aurescrm/bureau_events.py`) ne porte que des identifiants ; la file et le ticket ouvert se rechargent.
- **Conflits** : chaque action envoie la date `modified` affichée. Si le ticket a changé entre-temps, l'action est refusée et l'écran se recharge, sans perdre la saisie.

Le dossier essai à blanc et la commande se créent encore sur le Desk. La demande de faisabilité se crée sur le poste depuis un ticket, l'article depuis sa liste.

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
- **Dates** : toutes les listes proposent dans le menu Colonnes et dans Trier « Créé le » (champ `creation`) et « Modifié le » (`modified`). Tickets, demandes et clients y ajoutent leur date propre : Date du ticket, Date de la demande, Client depuis. Un article n'a pas de date de document.
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
- **Onglets** : Aperçu, Fiche technique, Sous-articles (article composé), Prépresse, Affaires. Le fil Commentaires et activité reste sous le contenu, hors des onglets. Un article général n'a ni fiche technique ni prépresse, et son action principale est Modifier.
- **Tickets** : un ticket ne porte pas d'article. Il se retrouve par sa demande de faisabilité, son dossier d'essai ou son devis rapproché. Un ticket sans aucune de ces pièces n'apparaît donc pas sur la fiche, et Nouveau ticket ne préremplit que le client.
- **Devis et commandes** : une ligne par ligne d'article : la quantité et le prix sont ceux de l'article, pas le total de la pièce.
- **Nouvel article** : désignation, groupe, et pour un article client, le client et le procédé. Le code vient de `custom_item_naming`. Un client n'a qu'un article de ce nom.
- **Envoi de fichiers** : `shared/components/FileUploader.vue`, commun aux fiches article, client et ticket et à la création de ticket. La PWA garde son propre choix de pièces : ses saisies partent hors ligne dans la file d'envoi. Plusieurs fichiers à la fois (trois en parallèle), avancement par fichier, annulation et reprise. La limite vient du serveur (`get_max_file_size`, 25 Mo par défaut ; nginx bloque au-delà de 50 Mo).
- **Modifier** : seuls les champs changés partent, avec la date `modified` affichée. Le client et le type d'article ne se changent pas depuis /bureau, car ils décident du code.
- **Prépresse** : une chaîne (tracé, maquette, imposition ou cliché, BAT) et la prochaine étape, puis la maquette en service, le BAT en vigueur et les historiques repliés. Référencer, activer, créer une nouvelle version et créer le BAT passent par les mêmes méthodes que les boutons du Desk, avec le droit d'écriture sur le document, et leurs conséquences s'annoncent avant.
- **Documents** : tous les fichiers de l'article, une ligne par fichier. Le menu d'une ligne le range comme image, BAT (le champ `custom_fiche_technique_article`) ou tracé. Un dépôt marche partout sur la fiche, et l'envoi reste visible d'un onglet à l'autre.
- **Encore sur le Desk** : l'étude de faisabilité, la création du tracé, de la maquette, de l'imposition et de l'étude technique, et la validation du BAT.

## Demandes de faisabilité

Page `/bureau/demandes`, avant Devis, pour suivre le cycle : Tickets, Demandes, Études, Devis, Commandes. Serveur : `aurescrm/api/bureau_demandes.py`. Les règles restent dans `demande_faisabilite.py`.

- **Accès** : `Chargé Devis` et `Responsable Devis` ouvrent aussi le poste. Chargé Devis lit les demandes sans les écrire ; seuls les rôles Devis et System Manager créent le devis. Un rôle sans droit de lecture sur les clients ou les articles reçoit un message d'erreur sur ces pages.
- **Vues** : Toutes, À confirmer, En étude, À chiffrer, Devis établis, Commandées, Closes.
- **Fenêtre** : les articles du client à gauche, la demande à droite. Un clic ajoute une ligne, le curseur passe sur sa quantité, Entrée dans la recherche ajoute le premier article possible. « Reprendre » remet la quantité de la dernière commande. Un même article peut avoir plusieurs quantités, pas deux fois la même.
- **Toujours depuis un ticket** : la liste n'a pas de bouton de création. Le serveur exige un ticket Demande de devis ou Bon de commande, En Cours, avec client et site Offset ou Flexo, et le droit de créer. Le retirage reste une copie d'une demande commandée. Sur le Desk, ces règles ne s'appliquent pas. Le procédé du site masque les autres articles. Sur un bon de commande, créer retire le devis retenu : la fenêtre le signale.
- **Brouillon** : le client et la date de livraison ne se changent plus après la création (`set_only_once` du doctype). La date de l'en-tête s'applique à toutes les lignes.
- **Actions** : Confirmer, Annuler (refusé si une étude a abouti), Créer le devis, Fermer, Retirage. Chacune contrôle droits, version et statut de départ, car les méthodes du doctype ne le font pas toutes. Études, devis et commandes s'ouvrent encore sur le Desk.
- **Actions groupées** : modification et suppression réservées aux brouillons (clé `guard` de `BULK_DOCTYPES`). Les tags restent libres.

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

## Cloche

Sur toutes les listes (`DataList`), l'équivalent du cœur du Desk : un rappel visuel propre à chaque personne.

- **Ligne** : la cloche se pose et se retire à droite, sans ouvrir l'aperçu. Elle s'écrit avec `frappe.desk.like.toggle_like`, donc dans `_liked_by` : une cloche sur le poste est un cœur sur le Desk, et inversement. `modified` ne bouge pas.
- **En-tête** : la cloche de la colonne n'affiche que les lignes marquées par la personne connectée. C'est un filtre comme un autre (`cloche`) : pastille, panneau Filtres, compteurs des vues, export.
- **Retrait sous filtre** : la ligne reste à l'écran jusqu'au prochain rechargement, pour pouvoir se raviser.

## Tags

- **Liste** : colonne en lecture seule, visible par défaut sur les clients et à ajouter par le menu Colonnes sur les tickets, faute de largeur. Elle montre les premiers tags puis le nombre restant, et tous au survol. Un filtre « Tag » existe sur les deux listes.
- **Tiroir et fiche** : au même endroit, sous la ligne d'identification. Avec le droit d'écriture, on retire un tag d'un clic et on en ajoute un parmi ceux qui existent, ou un nouveau (`add_doc_tag`, `remove_doc_tag`).
- **Date `modified`** : poser ou retirer un tag ne la change pas, comme sur le Desk.

## Actions d'une fiche

Règle commune à tout `/bureau` : les actions d'un document sont dans la barre `.record-actions` de son en-tête, jamais dans un encart d'étape ou une carte de résumé. L'ordre est toujours le même : `Attribution` (sur un ticket), puis les actions, puis le menu `⋯`. Il y a une seule action principale à l'écran, celle de l'étape en cours (`primaryTicketActions`, `demandeHeaderActions`). Les autres restent secondaires.

- **Attribution** (`AttributionButton`) : remplace « Me l'attribuer » et le champ « Pris en charge par ». Le bouton montre la personne actuelle. Son menu propose « Me l'attribuer » et une recherche parmi les personnes. Sans droit, il affiche seulement le nom.
- **Étape consultée** : les actions suivent l'étape en cours du ticket, même si on regarde une autre étape dans la frise.
- **Décisions de ticket** : leurs boutons sont aussi dans la barre, placés par un `Teleport` depuis la carte, dont la saisie reste sur place. Ils apparaissent quand leur carte est affichée, donc selon l'étape consultée.
  - **Urgence** : Refuser l'urgence et Valider. Valider devient l'action principale tant que la décision est en attente.
  - **Créance** : menu `Créance` (`HeaderMenu`). Bloquée ouvre le motif dans la carte, puis Bloquer le ticket ou Annuler le blocage dans la barre.
  - **Rapprochement** : on choisit un devis ou une autre issue et on commente dans la carte, puis Enregistrer la décision. Rien n'est écrit avant ce clic.
- **Restent dans leur carte** : les ajouts propres à une carte (joindre un fichier, créer un sous-article).

## Étapes du ticket

La consigne de l'étape est dans la carte Étapes (`StepTimeline`), sous l'étape regardée : il n'y a plus d'encart au-dessus du dossier. Sur une autre étape que celle en cours, l'en-tête de la carte propose « Revenir à l'étape en cours ». L'onglet Prépresse d'un article garde sa chaîne horizontale, avec sa consigne en une ligne (`.pp-next`) ; l'action de sa prochaine étape va dans la barre d'actions de la fiche.

## Structure des fiches

- **Documents qui avancent (Ticket, Demande, et les futurs Études, Devis, Commandes)** : en-tête pleine largeur avec les actions et les informations (`.record-actions`, `.ticket-facts`), contenu à gauche (`.bureau-center`), carte Étapes à droite (`.bureau-side`).
- **Fiches de référence (Client, Article)** : colonne d'identité à gauche (`.client-side`), onglets et contenu à droite.
- **Commentaires et activité** : toujours sous le contenu (`.record-activity`), quel que soit l'onglet, et il défile avec la page. Il n'a pas de carte autour, comme la timeline du Desk. « Voir le fil » depuis un aperçu amène dessus (`?onglet=activite`, ou `?fil=1` sur le ticket).

## Pièces du dossier

Il n'y a plus de cases à cocher sur `/bureau`. La carte `PiecesCard` montre, pour chaque pièce, le document réel et son statut. Le calcul est dans `aures_crm/doctype/ticket_commercial/ticket_pieces.py`, seule source de la carte et de la règle de Terminer. La carte remplace aussi l'ancienne carte Cycle du dossier.

| Type | Pièces requises | Lues dans |
|---|---|---|
| Bon de commande | Demande de faisabilité, Devis | Demandes du ticket ; devis de ces demandes ou devis retenu |
| Demande de devis | Articles | Lignes des demandes non annulées, sinon vérification signée |
| Essai blanc | Dossier essai à blanc, Articles | Dossier non annulé ; vérification signée |
| Réclamation | Photo, Quantités impactées | Image jointe au ticket ; champ `quantites_impactees` |

- **États** : `ok` (obtenue), `wait` (existe et avance), `missing` (bloque Terminer), `skip` (sans objet). Seul `missing` bloque.
- **Bon de commande** : une demande en brouillon ne compte pas. Avec un devis retenu au rapprochement, la demande est sans objet. La commande se montre pour information.
- **Articles** : quand aucun document ne les porte, le bouton « Articles vérifiés » de l'en-tête enregistre la personne et la date. Le menu `⋯` retire la vérification.
- **Autres pièces** : demande, devis ou commande existants s'ajoutent pour information sur les autres types.
- **Champs `checklist_*`** : en lecture seule. Ils recopient le calcul pour le contrôle de Terminer et les étapes de la file. Le ticket les recalcule à chaque enregistrement, et `sync_ticket_pieces` quand une demande, un dossier, un devis ou un fichier change (`doc_events` de `hooks.py`). Un ticket clos garde ses valeurs.

## Colonnes et vues

Toute liste passe par `DataList` et a ces réglages sans rien de plus à déclarer que `locked-column` et `FILTER_LISTS`.

- **Colonnes** : le bouton Colonnes ouvre un panneau (`TableColumnsPanel`) : densité, puis pour chaque colonne ordre, punaise et interrupteur de visibilité. « Autres champs… » ouvre la fenêtre aux trois volets de l'export (`ColumnsDialog`, `ExportColumns`), pour ajouter tout champ lisible du doctype et de ses tables. Dans le tableau, on glisse un en-tête pour déplacer la colonne, et son bord droit pour la largeur (double-clic : largeur d'origine ; au clavier, les flèches sur le bord).
- **Épinglage et densité** (`lib/tableDisplay.ts`, `tableDisplay.css`) : toute liste `DataList` en bénéficie. La colonne principale est toujours épinglée ; on peut en épingler jusqu'à 5 au total. Ces deux réglages restent dans le navigateur, par liste et par utilisateur, hors des vues enregistrées : ils ne suivent pas sur un autre appareil. « Réinitialiser l'affichage » efface ces réglages et les colonnes retouchées, sans toucher au tri ni aux filtres. Sous 720 px, seule la colonne principale reste fixe.
- **Colonne principale** : `locked-column` (Client, Article, Demande) reste affichée et en tête, car elle porte le nombre de lignes.
- **Champs ajoutés** : leurs clés sont celles du catalogue (`Customer.territory`). Leurs valeurs viennent de `get_export_values`, pour la page affichée, avec les droits de la personne. Ils ne se trient pas : le tri serveur ne connaît que les colonnes déclarées.
- **Vues** : le sélecteur à côté du titre (`ViewSwitcher`) passe d'une vue à l'autre. Une vue retient les colonnes, leur ordre et leurs largeurs, le tri, les filtres et le choix « Afficher », mais pas la recherche. Elles sont dans le doctype `Vue Liste Bureau`, et l'API est dans `aurescrm/api/bureau.py` (`get_list_views`, `save_list_view`, `delete_list_view`, `set_default_list_view`).
- **Droits** : chacun gère ses vues. Seul un System Manager publie, modifie ou supprime une vue pour tout le monde, comme pour les filtres enregistrés. Chacun choisit sa vue par défaut (étoile), rangée dans ses `DefaultValue`.
- **Ouverture** : la dernière vue utilisée sur cet appareil, sinon la vue par défaut, sinon la Vue standard. Une copie dans le navigateur (`aures:bureau:<liste>:v1:<site>:<utilisateur>:vue`) évite d'afficher un instant les colonnes standard. Une adresse avec `?vue=` l'emporte sur le choix « Afficher » de la vue.
- **Vue standard** : elle ne se supprime pas. Ses retouches restent dans le navigateur (`bureau-*-colonnes` et `bureau-*-colonnes:largeurs`). Enregistrer sous depuis cette vue déplace les retouches dans la nouvelle vue et rend à la Vue standard ses colonnes d'origine.
- **Export** : sur une vue enregistrée, la fenêtre part des colonnes de la vue, pas du dernier export.

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
