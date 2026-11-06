/** Palette de commandes du poste de bureau : ce qu'on peut y lancer et comment on le retrouve. Sans composant ni appel serveur. */
import type { RouteLocationRaw } from 'vue-router'
import { ARTICLE_VIEWS } from './articles'
import { CLIENT_VIEWS } from './clients'
import { DEMANDE_VIEWS } from './demandes'
import { TICKET_VIEWS } from './useQueue'

export type CreateKind = 'ticket' | 'article' | 'client'
export type PaletteSection = 'create' | 'lists' | 'elsewhere'
export type ListKind = 'tickets' | 'clients' | 'articles' | 'demandes'

export type PaletteAction = { type: 'create'; kind: CreateKind } | { type: 'route'; to: RouteLocationRaw } | { type: 'href'; href: string }

export interface PaletteCommand {
	id: string
	section: PaletteSection
	label: string
	/** Liste d'appartenance, affichée à droite d'une vue. */
	hint?: string
	/** Mots qui trouvent aussi la commande, sans être affichés. */
	keywords?: string
	icon: CreateKind | ListKind | 'commandes' | 'devis' | 'creances'
	action: PaletteAction
}

export const SECTION_TITLES: Record<PaletteSection, string> = {
	create: 'Créer',
	lists: 'Listes',
	elsewhere: 'Sur le Desk',
}

function viewCommands(list: ListKind, hint: string, routeName: string, views: readonly { key: string; label: string }[], defaultView: string, keywords: string): PaletteCommand[] {
	return [
		{ id: `list-${list}`, section: 'lists', label: hint, keywords, icon: list, action: { type: 'route', to: { name: routeName } } },
		...views
			.filter((view) => view.key !== defaultView)
			.map(
				(view): PaletteCommand => ({
					id: `list-${list}-${view.key}`,
					section: 'lists',
					label: view.label,
					hint,
					keywords,
					icon: list,
					action: { type: 'route', to: { name: routeName, query: { vue: view.key } } },
				}),
			),
	]
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
	{ id: 'create-ticket', section: 'create', label: 'Nouveau ticket', keywords: 'créer ajouter demande', icon: 'ticket', action: { type: 'create', kind: 'ticket' } },
	{ id: 'create-article', section: 'create', label: 'Nouvel article', keywords: 'créer ajouter produit', icon: 'article', action: { type: 'create', kind: 'article' } },
	{ id: 'create-client', section: 'create', label: 'Nouveau prospect', keywords: 'créer ajouter client', icon: 'client', action: { type: 'create', kind: 'client' } },
	...viewCommands('tickets', 'Tickets', 'Home', TICKET_VIEWS, 'todo', 'ticket liste'),
	...viewCommands('demandes', 'Demandes', 'Demandes', DEMANDE_VIEWS, 'all', 'demande faisabilité liste'),
	...viewCommands('clients', 'Clients', 'Clients', CLIENT_VIEWS, 'all', 'client liste'),
	...viewCommands('articles', 'Articles', 'Articles', ARTICLE_VIEWS, 'all', 'article produit liste'),
	{ id: 'desk-commandes', section: 'elsewhere', label: 'Commandes', keywords: 'bon commande desk', icon: 'commandes', action: { type: 'href', href: '/app/sales-order' } },
	{ id: 'desk-devis', section: 'elsewhere', label: 'Devis', keywords: 'desk', icon: 'devis', action: { type: 'href', href: '/app/quotation' } },
	{ id: 'desk-creances', section: 'elsewhere', label: 'Créances', keywords: 'suivi desk', icon: 'creances', action: { type: 'href', href: '/app/suivi-creance' } },
]

/** Sans accents ni majuscules : « creance » trouve « Créances ». */
export function normalize(text: string) {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
}

/** Garde les commandes qui contiennent tous les mots saisis, dans l'ordre de la liste. */
export function filterCommands(commands: PaletteCommand[], query: string) {
	const words = normalize(query).split(/\s+/).filter(Boolean)
	if (!words.length) return commands
	return commands.filter((command) => {
		const haystack = normalize([command.label, command.hint, command.keywords].filter(Boolean).join(' '))
		return words.every((word) => haystack.includes(word))
	})
}

/** Position suivante du curseur : on revient au début après le dernier élément. */
export function moveCursor(cursor: number, size: number, delta: number) {
	return size ? (cursor + delta + size) % size : 0
}

export function shortcutLabel(platform = navigator.platform) {
	return /mac|iphone|ipad/i.test(platform) ? '⌘ K' : 'Ctrl K'
}
