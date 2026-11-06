/** Règles de la page Demandes de faisabilité : types, vues, colonnes, avancement et ajout d'articles. */
import type { CommentSummary } from '@/types'
import { formatAmount } from './clients'
import { formatDay } from './display'
import type { FilterField } from './filters'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export type DemandeView = 'all' | 'confirm' | 'etude' | 'chiffrer' | 'devis' | 'commande' | 'closes'

export const DEMANDE_VIEWS: { key: DemandeView; label: string }[] = [
	{ key: 'all', label: 'Toutes' },
	{ key: 'confirm', label: 'À confirmer' },
	{ key: 'etude', label: 'En étude' },
	{ key: 'chiffrer', label: 'À chiffrer' },
	{ key: 'devis', label: 'Devis établis' },
	{ key: 'commande', label: 'Commandées' },
	{ key: 'closes', label: 'Closes' },
]

export const DEMANDE_TYPES = ['Premier Tirage', 'Retirage', 'Essai Blanc'] as const
export type DemandeType = (typeof DEMANDE_TYPES)[number]
const TYPE_LABELS: Record<string, string> = { 'Premier Tirage': 'Premier tirage', Retirage: 'Retirage', 'Essai Blanc': 'Essai blanc' }
export const typeLabel = (type?: string | null) => TYPE_LABELS[type || ''] || type || ''

export interface DemandeRow {
	name: string
	modified: string
	tags: string[]
	cloche: boolean
	status: string
	type: string | null
	client: string
	client_label: string
	articles: string | null
	articles_count: number
	procede: string | null
	urgence: string
	livraison: string | null
	commercial: string | null
	ticket: string | null
	bon_commande: string | null
	creation: string | null
	cree_par: string | null
}

export interface DemandesResponse extends ListResponse {
	demandes: DemandeRow[]
	counts: Record<DemandeView, number>
	page_length: number
}

export interface DemandeLine {
	name: string
	article: string
	designation: string
	quantite: number
	est_creation: number
	procede: string | null
	date_livraison: string | null
}

export interface DemandeEtude {
	name: string
	doctype: string
	status: string
	article: string
	article_parent: string | null
	designation: string
	quantite: number
}

export interface DemandeSale {
	name: string
	status: string
	date: string | null
	total: number | null
}

export type DemandeAction = 'confirm' | 'edit' | 'devis' | 'close' | 'retirage' | 'cancel'

export interface DemandeDetail {
	name: string
	modified: string
	tags: string[]
	can_write: boolean
	status: string
	type: string | null
	client: string
	client_label: string
	wilaya: string | null
	commercial: string | null
	ticket: string | null
	ticket_info: { name: string; request_type: string; status: string } | null
	urgence: string
	livraison: string | null
	creation: string | null
	cree_par: string | null
	bon_commande: string | null
	demande_origin: string | null
	procede: string | null
	lines: DemandeLine[]
	etudes: DemandeEtude[]
	devis: DemandeSale[]
	commandes: DemandeSale[]
	actions: DemandeAction[]
	cancel_blocking: DemandeEtude[]
	comments: CommentSummary
}

export interface DemandeOptions {
	types: string[]
	can_create: boolean
	filter_fields: FilterField[]
}

export interface ArticleChoice {
	name: string
	designation: string
	reference: string | null
	procedes: string[]
	support: string | null
	format: string | null
	bat: string | null
	last_quantity: number
	compose: number
	/** Raison de ne pas pouvoir l'ajouter, quel que soit le procédé de la demande. */
	unavailable: string | null
}

export interface TicketDemandeContext {
	ticket: string
	state: string
	procede: string | null
	reason: string | null
	request_type: string
	client: string
	client_label: string
	description: string | null
	urgence: string
	livraison: string
	from_echeance: boolean
	devis_rapproche: string | null
}

export interface DemandeValues {
	client: string
	type: string
	date_livraison: string
	n_bon_commande: string
	lines: { article: string; quantite: number; est_creation: number }[]
}

const articlesText = (row: DemandeRow) => (row.articles ? `${row.articles}${row.articles_count > 1 ? ` +${row.articles_count - 1}` : ''}` : '')

export const DEMANDE_COLUMNS: Column<DemandeRow>[] = [
	{ key: 'name', label: 'Demande', width: 110, sortable: true, text: (row) => row.name },
	{ key: 'client_label', label: 'Client', width: 120, grow: 1, sortable: true, text: (row) => row.client_label },
	{ key: 'articles', label: 'Articles', width: 140, grow: 1.6, sortable: true, text: articlesText },
	{ key: 'type', label: 'Type', width: 88, sortable: true, text: (row) => typeLabel(row.type) },
	{ key: 'status', label: 'Statut', width: 164, sortable: true, text: (row) => row.status },
	{ key: 'procede', label: 'Procédé', width: 64, sortable: true, text: (row) => row.procede || '' },
	{ key: 'urgence', label: 'Urg.', width: 52, sortable: true, text: (row) => row.urgence },
	{ key: 'livraison', label: 'Livraison', width: 84, sortable: true, text: (row) => formatDay(row.livraison) },
	{ key: 'commercial', label: 'Commercial', width: 96, sortable: true, text: (row) => row.commercial || '' },
	{ key: 'tags', label: 'Tags', width: 90, sortable: false, text: tagsText },
	{ key: 'ticket', label: 'Ticket', width: 124, sortable: true, optional: true, text: (row) => row.ticket || '' },
	{ key: 'bon_commande', label: 'Bon de commande', width: 130, sortable: true, optional: true, text: (row) => row.bon_commande || '' },
	{ key: 'creation', label: 'Créée le', width: 92, sortable: true, optional: true, text: (row) => formatDay(row.creation) },
	{ key: 'cree_par', label: 'Créée par', width: 120, sortable: true, optional: true, text: (row) => row.cree_par || '' },
]

export const DEFAULT_DEMANDE_COLUMNS = DEMANDE_COLUMNS.filter((column) => !column.optional).map((column) => column.key)

/** La colonne Demande reste toujours affichée ; une clé inconnue, venue d'un ancien réglage, est ignorée. */
export function visibleDemandeColumns(keys: string[]) {
	return DEMANDE_COLUMNS.filter((column) => column.key === 'name' || keys.includes(column.key))
}

export function demandeSortText(sort: Sort | null) {
	const column = sort && DEMANDE_COLUMNS.find((item) => item.key === sort.key)
	return column ? `Tri : ${column.label.toLowerCase()}` : 'Tri : les plus récentes'
}

const STUDY_DONE = ['Réalisable', 'Non Réalisable', 'Annulée']
const AFTER_CONFIRM = ['Confirmée', 'En Cours', 'Partiellement Finalisée', 'Finalisée', 'Devis Établis', 'Commandé', 'Fermée']

export interface DemandeStep {
	key: 'demande' | 'etudes' | 'devis' | 'commande'
	label: string
	done: boolean
	/** Prochaine étape à faire : c'est elle qui ressort. */
	next: boolean
	sub: string
}

function plural(count: number, one: string, many: string) {
	return `${count} ${count > 1 ? many : one}`
}

/** Les études qui comptent : une étude annulée ne reste pas à attendre. */
export const studiesDone = (demande: Pick<DemandeDetail, 'etudes'>) => demande.etudes.filter((etude) => STUDY_DONE.includes(etude.status)).length

export function demandeSteps(demande: DemandeDetail): DemandeStep[] {
	const confirmed = AFTER_CONFIRM.includes(demande.status)
	const total = demande.etudes.length
	const finished = studiesDone(demande)
	const studied = confirmed && total > 0 && finished === total
	const hasDevis = demande.devis.length > 0
	const hasOrder = demande.commandes.length > 0
	const canDevis = ['Finalisée', 'Partiellement Finalisée'].includes(demande.status)
	const steps: Omit<DemandeStep, 'next'>[] = [
		{ key: 'demande', label: 'Demande', done: confirmed, sub: confirmed ? 'Confirmée' : demande.status === 'Annulée' ? 'Annulée' : 'À confirmer' },
		{ key: 'etudes', label: 'Études', done: studied, sub: !total ? 'Pas encore lancées' : `${finished} sur ${plural(total, 'terminée', 'terminées')}` },
		{ key: 'devis', label: 'Devis', done: hasDevis, sub: hasDevis ? plural(demande.devis.length, 'devis', 'devis') : canDevis ? 'À créer' : 'Aucun' },
		{ key: 'commande', label: 'Commande', done: hasOrder, sub: hasOrder ? plural(demande.commandes.length, 'commande', 'commandes') : 'Aucune' },
	]
	const closed = ['Annulée', 'Fermée'].includes(demande.status)
	const nextKey = closed ? null : !confirmed ? 'demande' : canDevis && !hasDevis ? 'devis' : !studied ? 'etudes' : null
	return steps.map((step) => ({ ...step, next: step.key === nextKey }))
}

export interface DemandeNext {
	eyebrow: string
	title: string
	text: string
	/** Action principale de l'encart, quand cette personne peut la lancer. */
	action?: DemandeAction
	actionLabel?: string
}

/** Encart de la fiche : ce qu'il y a à faire maintenant, selon le statut. */
export function demandeNext(demande: DemandeDetail): DemandeNext | null {
	const has = (action: DemandeAction) => demande.actions.includes(action)
	const realisable = demande.etudes.filter((etude) => etude.status === 'Réalisable').length
	const count = demande.etudes.length
	switch (demande.status) {
		case 'Brouillon':
			return {
				eyebrow: 'Prochaine étape',
				title: 'Confirmer la demande',
				text: "La confirmation crée une étude de faisabilité par article, et la maquette de chaque article qui n'en a pas. La demande ne se modifie plus ensuite.",
				...(has('confirm') ? { action: 'confirm' as const, actionLabel: 'Confirmer' } : {}),
			}
		case 'Confirmée':
		case 'En Cours':
			return {
				eyebrow: 'En attente du service technique',
				title: count > 1 ? 'Les études de faisabilité sont en cours' : "L'étude de faisabilité est en cours",
				text: "Rien à faire ici pour l'instant. Le devis se débloque quand plus aucune étude n'est en cours et qu'au moins une a abouti.",
			}
		case 'Partiellement Finalisée':
		case 'Finalisée': {
			const scope = realisable > 1 ? `les ${realisable} articles réalisables` : 'le seul article réalisable'
			return {
				eyebrow: has('devis') ? 'Prochaine étape' : 'En attente du service devis',
				title: 'Créer le devis',
				text: has('devis') ? `Le devis reprend ${scope} et génère les calculs. Il s'ouvre ensuite sur le Desk pour le chiffrage.` : 'Le devis se crée par les rôles Chargé Devis et Responsable Devis.',
				...(has('devis') ? { action: 'devis' as const, actionLabel: 'Créer le devis' } : {}),
			}
		}
		default:
			return null
	}
}

/** Étude de cette ligne : un composé en a une par sous-article, la plus en retard fait foi. */
export function lineStudyStatus(demande: Pick<DemandeDetail, 'etudes'>, line: Pick<DemandeLine, 'article' | 'quantite'>) {
	const own = demande.etudes.filter((etude) => (etude.article === line.article && !etude.article_parent && etude.quantite === line.quantite) || etude.article_parent === line.article)
	if (!own.length) return null
	return (own.find((etude) => !STUDY_DONE.includes(etude.status)) ?? own.find((etude) => etude.status === 'Non Réalisable') ?? own[0]).status
}

export const saleTotal = (sale: DemandeSale) => (sale.total === null ? '—' : formatAmount(sale.total))

/* Ajout d'articles dans la fenêtre. */

export interface DraftLine {
	id: number
	article: string
	designation: string
	last_quantity: number
	quantity: string
	est_creation: boolean
}

export type CatalogAction = 'add' | 'more' | 'locked'

export interface CatalogRow extends ArticleChoice {
	action: CatalogAction
	actionLabel: string
	inDemande: boolean
	detail: string
	locked: boolean
}

/** Le procédé de la demande : celui du site du ticket, sinon celui du premier article ajouté. */
export function expectedProcede(ticketProcede: string | null | undefined, lines: DraftLine[], articles: ArticleChoice[]) {
	if (ticketProcede) return ticketProcede
	const first = lines[0] && articles.find((article) => article.name === lines[0].article)
	return first?.procedes[0] ?? null
}

const matchesProcede = (article: ArticleChoice, procede: string | null) => !procede || article.procedes.every((value) => value === procede)

function normalized(text: string) {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
}

/**
 * Liste de gauche. Depuis un ticket, le site impose le procédé : les articles d'un autre procédé sont masqués et comptés.
 * Sans ticket, ils restent visibles et grisés, car retirer le premier article rend le choix à nouveau possible.
 */
export function catalogRows(articles: ArticleChoice[], lines: DraftLine[], options: { procede: string | null; fromTicket: boolean; query: string }) {
	const { procede, fromTicket, query } = options
	const words = normalized(query).split(/\s+/).filter(Boolean)
	const masked = fromTicket ? articles.filter((article) => !article.unavailable && !matchesProcede(article, procede)) : []
	const rows = articles
		.filter((article) => !masked.includes(article))
		.filter((article) => {
			const haystack = normalized([article.designation, article.name, article.reference].filter(Boolean).join(' '))
			return words.every((word) => haystack.includes(word))
		})
		.map((article): CatalogRow => {
			const inDemande = lines.some((line) => line.article === article.name)
			const wrong = !matchesProcede(article, procede) || article.procedes.length > 1
			const locked = Boolean(article.unavailable) || wrong
			return {
				...article,
				inDemande,
				locked,
				action: locked ? 'locked' : inDemande ? 'more' : 'add',
				actionLabel: article.unavailable ? 'Non disponible' : wrong ? `${article.procedes.join(', ')} : autre demande` : inDemande ? '+ Autre quantité' : '+ Ajouter',
				detail: [article.compose ? 'Composé' : '', article.unavailable, article.support, article.format].filter(Boolean).join(' · '),
			}
		})
	return { rows, masked: masked.length, maskedProcede: masked[0]?.procedes[0] ?? null }
}

/** Identifiants des lignes qui répètent un article avec la même quantité : la première reste valable. */
export function duplicateLines(lines: DraftLine[]) {
	const seen = new Set<string>()
	const duplicates = new Set<number>()
	for (const line of lines) {
		if (!line.quantity) continue
		const key = `${line.article}|${line.quantity}`
		if (seen.has(key)) duplicates.add(line.id)
		seen.add(key)
	}
	return duplicates
}

export const digitsOnly = (value: string) => value.replace(/\D/g, '')

export function formatDraftQuantity(value: string) {
	return value ? formatAmount(Number(value)) : ''
}

export interface DraftState {
	lines: DraftLine[]
	date: string
	type: string
	bonCommande: string
	client: string | null
}

/** Ce qui empêche de créer : un seul message, le plus utile d'abord. Aucun blocage : `blocking` est faux. */
export function draftStatus({ lines, date, type, bonCommande, client }: DraftState) {
	const duplicates = duplicateLines(lines).size
	const missing = lines.filter((line) => !line.quantity).length
	const todo = (text: string) => ({ text, tone: 'todo' as const, blocking: true })
	if (!client) return { text: 'Choisissez le client.', tone: 'plain' as const, blocking: true }
	if (!lines.length) return { text: 'Ajoutez au moins un article.', tone: 'plain' as const, blocking: true }
	if (duplicates) return { text: plural(duplicates, 'doublon à corriger', 'doublons à corriger'), tone: 'error' as const, blocking: true }
	if (missing) return todo(plural(missing, 'quantité à saisir', 'quantités à saisir'))
	if (!date) return todo('Date de livraison à saisir')
	if (type === 'Retirage' && !bonCommande.trim()) return todo('Nº de bon de commande à saisir')
	return { text: `${plural(lines.length, 'ligne', 'lignes')}, en brouillon jusqu'à la confirmation.`, tone: 'plain' as const, blocking: false }
}

export function draftValues(state: DraftState): DemandeValues {
	return {
		client: state.client ?? '',
		type: state.type,
		date_livraison: state.date,
		n_bon_commande: state.type === 'Retirage' ? state.bonCommande.trim() : '',
		lines: state.lines.map((line) => ({ article: line.article, quantite: Number(line.quantity), est_creation: line.est_creation ? 1 : 0 })),
	}
}

export const BAT_TONES: Record<string, string> = { 'BAT-E Validé': 'bat-green', 'BAT-P Validé': 'bat-green', 'BAT en cours': 'bat-amber' }
