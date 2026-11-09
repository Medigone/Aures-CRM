/** Règles de la page Commandes : types, vues et colonnes. Une commande naît d'un devis validé ; ici on la retrouve. */
import type { CommentSummary } from '@/types'
import { formatQuantity, formatRate } from './articles'
import { formatDay } from './display'
import type { FilterField } from './filters'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export const COMMANDE_DOCTYPE = 'Sales Order'

/** Où ouvrir une commande sur le bureau : son aperçu dans la liste, en attendant sa fiche. */
export const commandeLink = (name: string) => ({ name: 'Commandes', query: { apercu: name } })

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
	cree_par: string | null
	lignes: CommandeLine[]
	livre: number
	facture: number
	total: number | null
	taxes: number | null
	total_ttc: number | null
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
	{ key: 'total_ttc', label: 'Total TTC', width: 112, minWidth: 88, sortable: true, end: true, text: (row) => moneyText(row.total_ttc) },
	{ key: 'urgence', label: 'Urg.', width: 52, minWidth: 52, sortable: true, text: (row) => row.urgence },
	{ key: 'tags', label: 'Tags', width: 90, minWidth: 72, sortable: false, text: tagsText },
	{ key: 'facture', label: 'Facturé', width: 96, minWidth: 80, sortable: true, optional: true, text: (row) => percentText(row.facture) },
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
