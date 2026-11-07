/** Règles de la page Études de faisabilité : types, vues et colonnes. Offset et Flexo y sont réunis selon les droits du rôle. */
import type { FilterField } from './filters'
import { canRead } from './droits'
import { formatDay } from './display'
import { tagsText, type Column, type Sort } from './list'
import { activePoste } from './postes'
import type { ListResponse } from './useServerList'

export const ETUDE_OFFSET = 'Etude Faisabilite'
export const ETUDE_FLEXO = 'Etude Faisabilite Flexo'
export const ETUDE_DOCTYPES = [ETUDE_OFFSET, ETUDE_FLEXO]

export type EtudeView = 'all' | 'traiter' | 'retard' | 'realisable' | 'non_realisable' | 'annulee'

export const ETUDE_VIEWS: { key: EtudeView; label: string }[] = [
	{ key: 'all', label: 'Toutes' },
	{ key: 'traiter', label: 'À traiter' },
	{ key: 'retard', label: 'En retard' },
	{ key: 'realisable', label: 'Réalisables' },
	{ key: 'non_realisable', label: 'Non réalisables' },
	{ key: 'annulee', label: 'Annulées' },
]

/** L'équipe Étude arrive sur ce qu'elle a à traiter, le back office sur tout le suivi. */
export function defaultEtudeView(): EtudeView {
	return activePoste().key === 'etude' ? 'traiter' : 'all'
}

/** La première vue est celle de référence de la liste : elle ne compte pas comme un filtre. */
export function etudeViews() {
	const first = defaultEtudeView()
	return [...ETUDE_VIEWS].sort((a, b) => Number(b.key === first) - Number(a.key === first))
}

/** Document de référence des filtres et des vues enregistrées : le premier que le rôle lit, comme côté serveur. */
export function primaryEtudeDoctype() {
	return canRead(ETUDE_OFFSET) ? ETUDE_OFFSET : ETUDE_FLEXO
}

export interface EtudePiece {
	key: string
	label: string
	value: string | null
}

export interface EtudeRow {
	name: string
	doctype: string
	modified: string
	tags: string[]
	cloche: boolean
	status: string
	client: string
	client_label: string
	article: string
	designation: string
	procede: string | null
	quantite: number
	urgence: string
	echeance: string | null
	retard: boolean
	livraison: string | null
	demande: string | null
	commercial: string | null
	retirage: boolean
	pieces: EtudePiece[]
	manquantes: number
	creation: string
	date: string | null
}

export interface EtudesResponse extends ListResponse {
	etudes: EtudeRow[]
	counts: Record<EtudeView, number>
	page_length: number
}

export interface EtudeOptions {
	doctype: string
	both: boolean
	filter_fields: FilterField[]
}

export interface EtudeDetail {
	name: string
	doctype: string
	modified: string
	tags: string[]
	can_write: boolean
	status: string
	client: string
	client_label: string
	article: string
	designation: string
	procede: string | null
	quantite: number
	retirage: boolean
	urgence: string
	echeance: string | null
	retard: boolean
	livraison: string | null
	demande: string | null
	commercial: string | null
	pieces: (EtudePiece & { doctype: string; status: string | null })[]
	observations: string | null
}

export function formatQuantity(value: number) {
	return new Intl.NumberFormat('fr-FR').format(value).replace(/[  ]/g, ' ')
}

export function missingPieces(row: { pieces: EtudePiece[] }) {
	return row.pieces.filter((piece) => !piece.value).map((piece) => piece.label)
}

const piecesText = (row: EtudeRow) => {
	const missing = missingPieces(row)
	return missing.length ? `Manque : ${missing.join(', ')}` : 'Complètes'
}

export const ETUDE_COLUMNS: Column<EtudeRow>[] = [
	{ key: 'name', label: 'Étude', width: 112, minWidth: 96, sortable: true, text: (row) => row.name },
	{ key: 'designation', label: 'Article', width: 200, minWidth: 120, grow: 2, sortable: true, text: (row) => row.designation },
	{ key: 'client_label', label: 'Client', width: 140, minWidth: 88, grow: 1, sortable: true, text: (row) => row.client_label },
	{ key: 'procede', label: 'Procédé', width: 72, minWidth: 64, sortable: true, text: (row) => row.procede || '' },
	{ key: 'quantite', label: 'Quantité', width: 84, minWidth: 64, sortable: true, end: true, text: (row) => row.quantite },
	{ key: 'urgence', label: 'Urg.', width: 52, minWidth: 52, sortable: true, text: (row) => row.urgence },
	{ key: 'echeance', label: 'Échéance', width: 88, minWidth: 76, sortable: true, text: (row) => formatDay(row.echeance) },
	{ key: 'status', label: 'Statut', width: 124, minWidth: 104, sortable: true, text: (row) => row.status },
	{ key: 'manquantes', label: 'Pièces', width: 196, minWidth: 120, sortable: true, text: piecesText },
	{ key: 'demande', label: 'Demande', width: 124, minWidth: 96, sortable: true, text: (row) => row.demande || '' },
	{ key: 'tags', label: 'Tags', width: 90, minWidth: 72, sortable: false, optional: true, text: tagsText },
	{ key: 'livraison', label: 'Livraison', width: 84, minWidth: 72, sortable: true, optional: true, text: (row) => formatDay(row.livraison) },
	{ key: 'commercial', label: 'Commercial', width: 110, minWidth: 72, sortable: true, optional: true, text: (row) => row.commercial || '' },
	{ key: 'date', label: "Date de l'étude", width: 104, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.date) },
	{ key: 'creation', label: 'Créée le', width: 92, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.creation) },
	{ key: 'modified', label: 'Modifiée le', width: 92, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.modified) },
]

/** Le back office suit par demande, l'équipe Étude travaille par pièce. Chacun peut changer ses colonnes. */
export function defaultEtudeColumns() {
	const hidden = activePoste().key === 'etude' ? 'demande' : 'manquantes'
	return ETUDE_COLUMNS.filter((column) => !column.optional && column.key !== hidden).map((column) => column.key)
}

export function etudeSortText(sort: Sort | null) {
	const column = sort && ETUDE_COLUMNS.find((item) => item.key === sort.key)
	if (!column) return 'Urgence puis échéance'
	return `${column.label} ${sort.dir === 'asc' ? '↑' : '↓'}`
}
