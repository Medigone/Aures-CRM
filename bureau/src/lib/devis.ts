/** Règles de la page Devis : types, vues et colonnes. Un devis naît d'une demande ; ici on le retrouve et on le consulte. */
import type { CommentSummary, Step } from '@/types'
import { formatQuantity, formatRate } from './articles'
import { formatDay } from './display'
import type { FilterField } from './filters'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export const DEVIS_DOCTYPE = 'Quotation'
export const DEVIS_PRINT_FORMAT = 'Devis Aures'

/** Le PDF remis au client, tel que le moteur d'impression le produit. */
export function devisPdfUrl(name: string) {
	const query = new URLSearchParams({ doctype: DEVIS_DOCTYPE, name, format: DEVIS_PRINT_FORMAT, no_letterhead: '1' })
	return `/api/method/frappe.utils.print_format.download_pdf?${query.toString()}`
}

export type DevisView = 'all' | 'chiffrer' | 'valider' | 'valides' | 'expirent' | 'commandes' | 'clos'

export const DEVIS_VIEWS: { key: DevisView; label: string }[] = [
	{ key: 'all', label: 'Tous' },
	{ key: 'chiffrer', label: 'À chiffrer' },
	{ key: 'valider', label: 'À valider' },
	{ key: 'valides', label: 'Validés' },
	{ key: 'expirent', label: 'Expirent sous 7 jours' },
	{ key: 'commandes', label: 'Commandés' },
	{ key: 'clos', label: 'Perdus, expirés, annulés' },
]

export type DevisType = 'Premier Tirage' | 'Retirage' | 'Essai Blanc'
const TYPE_LABELS: Record<string, string> = { 'Premier Tirage': 'Premier tirage', Retirage: 'Retirage', 'Essai Blanc': 'Essai blanc' }
export const devisTypeLabel = (type?: string | null) => TYPE_LABELS[type || ''] || type || ''

export interface DevisRow {
	name: string
	modified: string
	creation: string
	tags: string[]
	cloche: boolean
	status: string
	client: string
	client_label: string
	articles: string | null
	articles_count: number
	lignes: number
	chiffrees: number
	chiffrage: number
	total: number
	total_ttc: number
	statut_commande: string | null
	commande: number
	date: string | null
	valable: string | null
	livraison: string | null
	urgence: string
	commercial: string | null
	demande: string | null
	ticket: string | null
	type: string
	cree_par: string | null
}

export interface DevisResponse extends ListResponse {
	devis: DevisRow[]
	counts: Record<DevisView, number>
	page_length: number
}

export interface DevisOptions {
	doctype: string
	filter_fields: FilterField[]
}

export interface DevisLine {
	name: string
	article: string
	designation: string
	quantite: number
	unite: string | null
	/** Absents pour qui ne lit pas les prix du devis. */
	prix: number | null
	montant: number | null
	chiffree: boolean
}

export type DevisAction = 'prix' | 'valider' | 'commande' | 'perdu' | 'annuler'

export interface DevisSale {
	name: string
	status: string
	date: string | null
	total: number | null
}

export interface DevisDetail {
	name: string
	modified: string
	creation: string
	tags: string[]
	can_write: boolean
	can_print: boolean
	status: string
	docstatus: number
	type: string
	client: string
	client_label: string
	commercial: string | null
	urgence: string
	date: string | null
	valable: string | null
	livraison: string | null
	demande: string | null
	ticket: string | null
	cree_par: string | null
	lignes: DevisLine[]
	chiffrees: number
	total: number
	taxes: number
	total_ttc: number
	statut_commande: string | null
	commande: number
	commandes: DevisSale[]
	actions: DevisAction[]
	/** Ce qui empêche de valider, quand la personne le peut. */
	blocked: string[]
	raisons_perte: string[]
	perte: { raisons: string[]; precisions: string | null } | null
	comments: CommentSummary
}

export const moneyText = (value?: number | null) => (value === null || value === undefined ? '' : formatRate(value))
export const percentText = (value?: number | null) => (value === null || value === undefined ? '' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`)

/** Avancement du chiffrage : « 3/4 », vide sans ligne. */
export const chiffrageText = (row: Pick<DevisRow, 'lignes' | 'chiffrees'>) => (row.lignes ? `${row.chiffrees}/${row.lignes}` : '')

/** Ce qu'il reste à faire sur un brouillon, lu dans ses prix ; rien une fois validé. */
export function devisStage(row: Pick<DevisRow, 'status' | 'lignes' | 'chiffrees'>) {
	if (row.status !== 'Draft') return null
	if (!row.lignes || row.chiffrees < row.lignes) return { label: 'À chiffrer', tone: 'tone-blue' }
	return { label: 'À valider', tone: 'tone-amber' }
}

/** Commande : la part commandée d'un devis validé. Un brouillon ou un devis clos n'en a pas. */
export function commandeText(row: Pick<DevisRow, 'status' | 'commande' | 'statut_commande'>) {
	if (row.status === 'Draft' || row.status === 'Cancelled') return ''
	if (!row.commande) return row.statut_commande || 'Non commandé'
	return `${Math.round(row.commande)} %`
}

const articlesText = (row: DevisRow) => (row.articles ? `${row.articles}${row.articles_count > 1 ? ` +${row.articles_count - 1}` : ''}` : '')

export const DEVIS_COLUMNS: Column<DevisRow>[] = [
	{ key: 'name', label: 'Devis', width: 160, minWidth: 148, sortable: true, text: (row) => row.name },
	{ key: 'client_label', label: 'Client', width: 130, minWidth: 88, grow: 1, sortable: true, text: (row) => row.client_label },
	{ key: 'articles', label: 'Articles', width: 150, minWidth: 88, grow: 1.6, sortable: true, text: articlesText },
	{ key: 'chiffrage', label: 'Chiffrage', width: 96, minWidth: 80, sortable: true, text: chiffrageText },
	{ key: 'total', label: 'Total HT', width: 112, minWidth: 88, sortable: true, end: true, text: (row) => moneyText(row.total) },
	{ key: 'status', label: 'Statut', width: 140, minWidth: 112, sortable: true, text: (row) => row.status },
	{ key: 'commande', label: 'Commande', width: 104, minWidth: 80, sortable: true, text: commandeText },
	{ key: 'valable', label: "Valable jusqu'au", width: 104, minWidth: 80, sortable: true, text: (row) => formatDay(row.valable) },
	{ key: 'urgence', label: 'Urg.', width: 52, minWidth: 52, sortable: true, text: (row) => row.urgence },
	{ key: 'demande', label: 'Demande', width: 116, minWidth: 88, sortable: true, text: (row) => row.demande || '' },
	{ key: 'tags', label: 'Tags', width: 90, minWidth: 72, sortable: false, text: tagsText },
	{ key: 'total_ttc', label: 'Total TTC', width: 112, minWidth: 88, sortable: true, end: true, optional: true, text: (row) => moneyText(row.total_ttc) },
	{ key: 'commercial', label: 'Commercial', width: 110, minWidth: 72, sortable: true, optional: true, text: (row) => row.commercial || '' },
	{ key: 'type', label: 'Type', width: 96, minWidth: 64, sortable: true, optional: true, text: (row) => devisTypeLabel(row.type) },
	{ key: 'ticket', label: 'Ticket', width: 124, minWidth: 88, sortable: true, optional: true, text: (row) => row.ticket || '' },
	{ key: 'livraison', label: 'Livraison', width: 88, minWidth: 72, sortable: true, optional: true, text: (row) => formatDay(row.livraison) },
	{ key: 'date', label: 'Date du devis', width: 100, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.date) },
	{ key: 'creation', label: 'Créé le', width: 88, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.creation) },
	{ key: 'modified', label: 'Modifié le', width: 92, minWidth: 80, sortable: true, text: (row) => formatDay(row.modified) },
	{ key: 'cree_par', label: 'Créé par', width: 120, minWidth: 72, sortable: true, optional: true, text: (row) => row.cree_par || '' },
]

export const DEFAULT_DEVIS_COLUMNS = DEVIS_COLUMNS.filter((column) => !column.optional).map((column) => column.key)

export function devisSortText(sort: Sort | null) {
	const column = sort && DEVIS_COLUMNS.find((item) => item.key === sort.key)
	return column ? `Tri : ${column.label.toLowerCase()}` : 'Tri : les plus récents'
}

export const quantityText = (value: number) => formatQuantity(value)

/** Étapes du devis : chiffrage, validation, envoi au client, commande. Perdu, expiré ou annulé ferment la frise. */
export function devisTimeline(devis: Pick<DevisDetail, 'status' | 'docstatus' | 'lignes' | 'chiffrees' | 'commande' | 'commandes' | 'perte'>) {
	const lignes = devis.lignes.length
	const validated = devis.docstatus === 1
	const ordered = devis.status === 'Ordered' || devis.status === 'Partially Ordered' || devis.commandes.length > 0
	const closed: Record<string, string> = { Lost: 'Perdu', Expired: 'Expiré', Cancelled: 'Annulé' }
	const end = closed[devis.status]
	const steps: Step[] = [
		{ key: 'chiffrage', label: 'Chiffrage', state: validated || (lignes && devis.chiffrees === lignes) ? 'done' : 'current', detail: lignes ? `${devis.chiffrees} prix sur ${lignes}` : 'Aucune ligne' },
		{ key: 'validation', label: 'Validation', state: validated ? 'done' : 'todo', detail: validated ? 'Validé' : 'Chargé ou Responsable Devis' },
		{ key: 'envoi', label: 'Envoi au client', state: ordered || end ? 'done' : validated ? 'current' : 'todo', detail: 'Par le commercial' },
		{
			key: 'commande',
			label: end ?? 'Commande',
			state: end ? 'blocked' : devis.status === 'Ordered' ? 'done' : ordered ? 'current' : 'todo',
			detail: end === 'Perdu' ? devis.perte?.raisons.join(', ') || '' : ordered ? `${devis.commandes.length} commande${devis.commandes.length > 1 ? 's' : ''}${devis.commande ? ` · ${Math.round(devis.commande)} %` : ''}` : 'Partielle ou entière',
		},
	]
	// Un brouillon chiffré attend sa validation.
	if (!validated && lignes && devis.chiffrees === lignes) steps[1].state = 'current'
	const current = steps.findIndex((step) => step.state === 'current')
	return { steps, current: current >= 0 ? current : null, focus: current >= 0 ? current : steps.length - 1 }
}

/** La consigne de l'étape en cours, en infobulle de la frise. */
export function devisTip(devis: Pick<DevisDetail, 'status' | 'docstatus' | 'blocked' | 'actions'>) {
	if (devis.docstatus === 0) return devis.blocked.length ? devis.blocked.join(' ') : 'Tous les prix sont saisis : le devis peut être validé.'
	if (devis.status === 'Open' || devis.status === 'Replied') return 'Le commercial a été prévenu et remet le devis au client. Créez la commande quand le client accepte.'
	if (devis.status === 'Partially Ordered') return 'Une partie du devis est commandée : une nouvelle commande reprend les articles restants.'
	return ''
}

export const DEVIS_ACTION_LABELS: Record<DevisAction, string> = { prix: 'Enregistrer', valider: 'Valider le devis', commande: 'Créer la commande', perdu: 'Marquer perdu…', annuler: 'Annuler le devis…' }

/** Saisie d'un prix : virgule ou point, espaces de milliers acceptés. Vide ou illisible : null. */
export function parsePrice(text: string) {
	const cleaned = text.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
	if (!cleaned) return null
	const value = Number(cleaned)
	return Number.isFinite(value) && value >= 0 ? value : null
}
