# Style commun des applications Aures

Toutes les applications métier (`/commercial`, `/bureau` et les postes à venir) partagent le style **Aures Pli**. Référence visuelle et prototype : [design system Aures Pli](https://claude.ai/artifact/UCmnVs5WC2rfwQNGbKro1H).

## Où sont les valeurs

| Élément | Emplacement |
| --- | --- |
| Couleurs, rayons, ombres, densités | `shared/tokens.css` |
| Composants communs (`.btn`, `.card`, `.field-input`, `.badge`, `.tone-*`, `.urgence-*`) | `shared/styles.css` |
| Tailles et couleurs pour Tailwind | `shared/tailwind.preset.js` |
| Thème clair ou sombre | `shared/theme.ts` |
| Barre du haut et menu de gauche | `shared/components/AppShell.vue`, `shared/shell.ts` |
| Pied de liste et états | `shared/components/ListPager.vue`, `ListState.vue` |
| Gabarit de liste | `bureau/src/components/DataList.vue` |
| Commentaires et activité | `shared/components/ActivityFeed.vue`, `shared/activity.ts`, `aurescrm/api/activity.py` |

Les surfaces, encres et contours gris (`--surface-*`, `--ink-*`, `--outline-*`) viennent de frappe-ui.

## Les règles

- **Aucune couleur écrite en dur.** Chaque couleur a un jeton, en clair et en sombre. `bureau/src/lib/tokens.spec.ts` fait échouer les tests si une couleur apparaît ailleurs que dans `shared/tokens.css`.
- **Une application ne redéfinit ni `text-base` ni la hauteur d'un bouton.** Elle choisit sa densité sur `<html>` : `data-density="poste"` (souris, 13 px, contrôles de 32 px) ou `data-density="terrain"` (doigt, 15 px, contrôles de 48 px). Sans attribut, c'est Terrain.
- **Une seule action principale à l'écran**, en `primary`. Le bleu `accent` sert au focus, à l'étape en cours et à la sélection.
- **Une case à cocher n'est pas bleue.** Contour fin de 1 px en `--control-border`, fond et coche en `primary` une fois cochée. La règle est dans `shared/styles.css` et vaut pour toutes les cases : aucune page ne la redéfinit.
- **Un lien n'est pas bleu sur le poste de bureau.** Il est en encre (`--link-ink`, classes `.ref-link` et `.text-link`), souligné au survol. Ce qui ouvre le Desk porte `↗`, et « Tout voir » en tête de carte est une petite pilule neutre. La PWA garde des liens bleus jusqu'à son étape.
- **Un tag n'est ni une action ni un état** : rectangle gris sans contour, coins de 4 px (`.tag-pill`).
- **Une action est neutre, un état porte une teinte.** En densité Poste, boutons et recherche sont en pilule grise (`--radius-action`, `--btn-*`) ; les statuts et urgences ont un fond léger, un contour fin et une icône ou un point. Champs de formulaire et messages gardent 8 px.

## État de la bascule

1. **Socle** : fait. `/bureau` a la forme nette et le thème sombre. La PWA garde ses formes actuelles, le temps de passer à son tour aux modèles communs : les lignes concernées sont signalées dans `shared/tokens.css`.
2. **Coquille** : fait sur `/bureau`. Barre du haut et menu de gauche dans `shared/`. La PWA garde sa navigation pour l'instant.
3. **Liste** : modèle commun `bureau/src/components/DataList.vue`, utilisé par `QueueList.vue` et `ClientList.vue` : barre d'outils en carte, plateau de lignes de 44 px, menu `⋮`. Plus d'onglets de vues : le choix Afficher est en tête du panneau Filtres. Une nouvelle liste fournit ses colonnes, ses vues, ses cellules et son menu de ligne.
4. **Fiche** : fil, en-tête et menu `⋯` faits sur les tickets. Le modèle de référence est fait sur les clients (`ClientView.vue`, classes `.client-side`, `.record-tabs`, `.ref-table`, `.kv`) : colonne d'identité fixe à gauche, onglets à droite.
5. **PWA** : passage aux jetons et aux modèles, écran par écran.
