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
| Commentaires et activité | `shared/components/ActivityFeed.vue`, `shared/activity.ts`, `aurescrm/api/activity.py` |

Les surfaces, encres et contours gris (`--surface-*`, `--ink-*`, `--outline-*`) viennent de frappe-ui.

## Les règles

- **Aucune couleur écrite en dur.** Chaque couleur a un jeton, en clair et en sombre. `bureau/src/lib/tokens.spec.ts` fait échouer les tests si une couleur apparaît ailleurs que dans `shared/tokens.css`.
- **Une application ne redéfinit ni `text-base` ni la hauteur d'un bouton.** Elle choisit sa densité sur `<html>` : `data-density="poste"` (souris, 13 px, contrôles de 32 px) ou `data-density="terrain"` (doigt, 15 px, contrôles de 48 px). Sans attribut, c'est Terrain.
- **Une seule action principale à l'écran**, en `primary`. Le bleu `accent` sert aux liens, au focus et à la sélection.
- **Rond pour un état, rectangle pour une action.**

## État de la bascule

1. **Socle** : fait. `/bureau` a la forme nette et le thème sombre. La PWA garde ses formes actuelles, le temps de passer à son tour aux modèles communs : les lignes concernées sont signalées dans `shared/tokens.css`.
2. **Coquille** : fait sur `/bureau`. Barre du haut et menu de gauche dans `shared/`. La PWA garde sa navigation pour l'instant.
3. **Liste** : pagination, états et barre d'outils faits sur les tickets et les clients, avec `useServerList` et `FilterBuilder` communs. `QueueList.vue` et `ClientList.vue` partagent encore leur gabarit par copie : à fondre en un composant à la prochaine liste.
4. **Fiche** : fil, en-tête et menu `⋯` faits sur les tickets. Le modèle de référence est fait sur les clients (`ClientView.vue`, classes `.record-tabs`, `.ref-table`, `.kv`).
5. **PWA** : passage aux jetons et aux modèles, écran par écran.
