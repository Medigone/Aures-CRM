/** Règles de la page Commandes : types, vues et colonnes. Une commande naît d'un devis validé ; ici on la retrouve. */
import type { CommentSummary, Step } from '@/types'
import { formatQuantity, formatRate } from './articles'
import { formatDay } from './display'
import type { FilterField } from './filters'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export const COMMANDE_DOCTYPE = 'Sales Order'

/** Où ouvrir une commande sur le bureau : sa fiche. */
export const commandeLink = (name: string) => ({ name: 'CommandeFiche', params: { id: name } })

export type CommandeView = 'all' | 'valider' | 'livrer' | 'retard' | 'facturer' | 'terminees' | 'annulees'

export const COMMANDE_VIEWS: { key: CommandeView; label: string }[] = [
	{ key: 'all', label: 'Toutes' },
	{ key: 'valider', label: 'À valider' },
	{ key: 'livrer', label: 'À livrer' },
	{ key: 'retard', label: 'Livraison en retard' },
	{ key: 'facturer', label: 'À facturer' },
	{ key: 'terminees', label: 'Terminées' },
	{ key: 'annulees', label: 'Annulées' },
]

export interface CommandeRow {
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
	bon_commande: string | null
	date_bon: string | null
	livraison: string | null
	fabrication: string | null
	dossier: string | null
	livre: number
	facture: number
	/** Absents pour qui ne lit pas les montants de la commande. */
	total: number | null
	total_ttc: number | null
	urgence: string
	commercial: string | null
	devis: string | null
	demande: string | null
	ticket: string | null
	retirage: boolean
	date: string | null
	cree_par: string | null
}

export interface CommandesResponse extends ListResponse {
	commandes: CommandeRow[]
	counts: Record<CommandeView, number>
	page_length: number
}

export interface CommandeOptions {
	doctype: string
	filter_fields: FilterField[]
	montants: boolean
}

export interface CommandeLine {
	name: string
	article: string
	designation: string
	quantite: number
	livree: number
	unite: string | null
	livraison: string | null
	prix: number | null
	montant: number | null
}

export interface CommandeEtude {
	name: string
	status: string
	machine: string | null
	quantite: number
	date: string | null
}

/** Avancement d'un article dans le dossier de fabrication. */
export interface CommandeFabrication {
	article: string
	designation: string
	commandee: number
	programmee: number
	produite: number
	statut: string | null
	machine: string | null
	etudes: CommandeEtude[]
}

export interface CommandeDocument {
	type: 'livraison' | 'facture'
	doctype: string
	name: string
	status: string
	date: string | null
	total: number | null
	/** La personne peut l'ouvrir sur le Desk. */
	lisible: boolean
}

/** Parts produite et programmée d'un article, en pourcentage de la quantité commandée. */
export function fabricationShares(row: Pick<CommandeFabrication, 'commandee' | 'programmee' | 'produite'>) {
	if (!row.commandee) return { produit: 0, programme: 0 }
	const produit = Math.min(100, (row.produite / row.commandee) * 100)
	const programme = Math.max(0, Math.min(100, (row.programmee / row.commandee) * 100) - produit)
	return { produit, programme }
}

export type CommandeAction = 'bon' | 'scan' | 'valider' | 'supprimer' | 'annuler'

export interface CommandeDetail {
	name: string
	modified: string
	creation: string
	tags: string[]
	can_write: boolean
	status: string
	docstatus: number
	client: string
	client_label: string
	commercial: string | null
	urgence: string
	retirage: boolean
	date: string | null
	livraison: string | null
	bon_commande: string | null
	date_bon: string | null
	devis: string | null
	demande: string | null
	ticket: string | null
	dossier: { name: string; status: string } | null
	etudes: { total: number; en_cours: number; terminees: number }
	fabrication: CommandeFabrication[]
	documents: CommandeDocument[]
	scan: { url: string; name: string } | null
	cree_par: string | null
	lignes: CommandeLine[]
	livre: number
	facture: number
	total: number | null
	taxes: number | null
	total_ttc: number | null
	actions: CommandeAction[]
	/** Ce qui empêche de valider, quand la personne le peut. */
	blocked: string[]
	/** Pourquoi la commande ne s'annule plus, quand la personne pourrait l'annuler. */
	annulation_bloquee: string | null
	comments: CommentSummary
}

export const moneyText = (value?: number | null) => (value === null || value === undefined ? '' : formatRate(value))
export const quantityText = (value: number) => formatQuantity(value)
export const percentText = (value: number) => `${Math.round(value)} %`

const OUVERTES = ['To Deliver and Bill', 'To Deliver']

/** Livraison passée sur une commande qui reste à livrer. */
export function isLate(row: Pick<CommandeRow, 'status' | 'livraison'>, today = new Date().toISOString().slice(0, 10)) {
	return OUVERTES.includes(row.status) && Boolean(row.livraison) && row.livraison! < today
}

/** « 12345 · 07/07/2026 », ou ce qui manque encore sur un brouillon. */
export function bonText(row: Pick<CommandeRow, 'bon_commande' | 'date_bon'>) {
	return [row.bon_commande, formatDay(row.date_bon)].filter(Boolean).join(' · ')
}

const articlesText = (row: CommandeRow) => (row.articles ? `${row.articles}${row.articles_count > 1 ? ` +${row.articles_count - 1}` : ''}` : '')

export const COMMANDE_COLUMNS: Column<CommandeRow>[] = [
	{ key: 'name', label: 'Commande', width: 160, minWidth: 148, sortable: true, text: (row) => row.name },
	{ key: 'client_label', label: 'Client', width: 120, minWidth: 88, grow: 1, sortable: true, text: (row) => row.client_label },
	{ key: 'articles', label: 'Articles', width: 130, minWidth: 88, grow: 1.4, sortable: true, text: articlesText },
	{ key: 'bon_commande', label: 'Bon de commande', width: 140, minWidth: 96, sortable: true, text: bonText },
	{ key: 'status', label: 'Statut', width: 140, minWidth: 112, sortable: true, text: (row) => row.status },
	{ key: 'livraison', label: 'Livraison', width: 96, minWidth: 88, sortable: true, text: (row) => formatDay(row.livraison) },
	{ key: 'fabrication', label: 'Fabrication', width: 124, minWidth: 96, sortable: true, text: (row) => row.fabrication || '' },
	{ key: 'livre', label: 'Livré', width: 88, minWidth: 80, sortable: true, text: (row) => percentText(row.livre) },
	{ key: 'facture', label: 'Facturé', width: 88, minWidth: 80, sortable: true, text: (row) => percentText(row.facture) },
	{ key: 'total_ttc', label: 'Total TTC', width: 112, minWidth: 88, sortable: true, end: true, text: (row) => moneyText(row.total_ttc) },
	{ key: 'urgence', label: 'Urg.', width: 52, minWidth: 52, sortable: true, text: (row) => row.urgence },
	{ key: 'tags', label: 'Tags', width: 90, minWidth: 72, sortable: false, text: tagsText },
	{ key: 'total', label: 'Total HT', width: 120, minWidth: 88, sortable: true, end: true, optional: true, text: (row) => moneyText(row.total) },
	{ key: 'devis', label: 'Devis', width: 150, minWidth: 96, sortable: true, optional: true, text: (row) => row.devis || '' },
	{ key: 'demande', label: 'Demande', width: 116, minWidth: 88, sortable: true, optional: true, text: (row) => row.demande || '' },
	{ key: 'commercial', label: 'Commercial', width: 110, minWidth: 72, sortable: true, optional: true, text: (row) => row.commercial || '' },
	{ key: 'date_bon', label: 'Date du bon', width: 96, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.date_bon) },
	{ key: 'date', label: 'Date de commande', width: 110, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.date) },
	{ key: 'creation', label: 'Créé le', width: 88, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.creation) },
	{ key: 'modified', label: 'Modifié le', width: 92, minWidth: 80, sortable: true, text: (row) => formatDay(row.modified) },
	{ key: 'cree_par', label: 'Créé par', width: 120, minWidth: 72, sortable: true, optional: true, text: (row) => row.cree_par || '' },
]

/** Sans droit sur les montants, leurs colonnes ne sont pas proposées. */
export function commandeColumns(montants: boolean) {
	return montants ? COMMANDE_COLUMNS : COMMANDE_COLUMNS.filter((column) => column.key !== 'total' && column.key !== 'total_ttc')
}

export const DEFAULT_COMMANDE_COLUMNS = COMMANDE_COLUMNS.filter((column) => !column.optional).map((column) => column.key)

export function commandeSortText(sort: Sort | null) {
	const column = sort && COMMANDE_COLUMNS.find((item) => item.key === sort.key)
	return column ? `Tri : ${column.label.toLowerCase()}` : 'Tri : les plus récentes'
}

type TimelineInput = Pick<CommandeDetail, 'status' | 'docstatus' | 'bon_commande' | 'date_bon' | 'dossier' | 'etudes' | 'livre' | 'facture' | 'livraison'>

/** Étapes de la commande : bon de commande, validation, programmation, fabrication, livraison, facturation. */
export function commandeTimeline(commande: TimelineInput) {
	const validated = commande.docstatus === 1
	const cancelled = commande.docstatus === 2 || commande.status === 'Cancelled'
	const bon = Boolean(commande.bon_commande && commande.date_bon)
	const dossier = commande.dossier?.status ?? ''
	const etudes = commande.etudes
	const made = etudes.total > 0 && etudes.terminees >= etudes.total
	const delivered = commande.livre >= 100
	// Une fabrication terminée ou une livraison faite vaut programmation, même sans dossier.
	const planned = ['Planification validée', 'Clôturé'].includes(dossier) || made || delivered
	const billed = commande.facture >= 100
	const steps: Step[] = [
		{ key: 'bon', label: 'Bon de commande', state: bon ? 'done' : 'current', detail: bon ? `N° ${commande.bon_commande} du ${formatDay(commande.date_bon)}` : 'N° et date à saisir' },
		{ key: 'validation', label: cancelled ? 'Annulée' : 'Validation', state: cancelled ? 'blocked' : validated ? 'done' : bon ? 'current' : 'todo', detail: cancelled ? 'Commande annulée' : validated ? 'Validée' : "Par l'Administrateur Ventes" },
		{ key: 'programmation', label: 'Programmation', state: !validated ? 'todo' : planned ? 'done' : 'current', detail: validated ? dossier || (planned ? 'Sans dossier de fabrication' : 'Dossier de fabrication à créer') : 'Dossier créé à la validation' },
		{ key: 'fabrication', label: 'Fabrication', state: !validated ? 'todo' : made || delivered ? 'done' : planned ? 'current' : 'todo', detail: etudes.total ? `${etudes.terminees} étude${etudes.terminees > 1 ? 's' : ''} terminée${etudes.terminees > 1 ? 's' : ''} sur ${etudes.total}` : 'Une étude technique par article' },
		{ key: 'livraison', label: 'Livraison', state: !validated ? 'todo' : delivered ? 'done' : made ? 'current' : 'todo', detail: delivered ? 'Livrée' : commande.livre ? `${percentText(commande.livre)} livré` : commande.livraison ? `Prévue le ${formatDay(commande.livraison)}` : 'Date à venir' },
		{ key: 'facturation', label: 'Facturation', state: !validated ? 'todo' : billed ? 'done' : delivered ? 'current' : 'todo', detail: billed ? 'Facturée' : commande.facture ? `${percentText(commande.facture)} facturé` : 'Après livraison' },
	]
	if (cancelled) for (const step of steps.slice(2)) step.state = 'todo'
	const current = steps.findIndex((step) => step.state === 'current')
	return { steps, current: current >= 0 ? current : null, focus: current >= 0 ? current : cancelled ? 1 : steps.length - 1 }
}

/** La consigne de l'étape en cours, en infobulle de la frise. */
export function commandeTip(commande: Pick<CommandeDetail, 'docstatus' | 'blocked' | 'actions' | 'dossier'>) {
	if (commande.docstatus === 0) {
		if (commande.blocked.length) return commande.blocked.join(' ')
		return commande.actions.includes('valider') ? 'Tout est prêt : la commande peut être validée.' : "L'Administrateur Ventes valide la commande."
	}
	if (commande.docstatus === 1 && commande.dossier && !['Planification validée', 'Clôturé'].includes(commande.dossier.status)) return `Le dossier ${commande.dossier.name} attend sa programmation.`
	return ''
}
