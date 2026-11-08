/** Règles de la page Impositions : types, vues et colonnes. Une imposition naît à l'atelier ; ici on la consulte et on choisit l'idéale. */
import type { CommentSummary } from '@/types'
import type { SheetDrawing } from './etudePieces'
import type { FilterField } from './filters'
import { formatDay } from './display'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export const IMPOSITION_DOCTYPE = 'Imposition'
export const ORIGINE_ATELIER = 'Moteur v1'

export type ImpositionView = 'valables' | 'ideales' | 'atelier' | 'main' | 'groupees' | 'obsoletes' | 'all'

export const IMPOSITION_VIEWS: { key: ImpositionView; label: string }[] = [
	{ key: 'valables', label: 'Valables' },
	{ key: 'ideales', label: 'Idéales' },
	{ key: 'atelier', label: "Faites à l'atelier" },
	{ key: 'main', label: 'Saisies à la main' },
	{ key: 'groupees', label: 'Groupées' },
	{ key: 'obsoletes', label: 'Obsolètes' },
	{ key: 'all', label: 'Toutes' },
]
export const DEFAULT_IMPOSITION_VIEW: ImpositionView = 'valables'

export interface ImpositionListRow {
	name: string
	modified: string
	creation: string
	tags: string[]
	cloche: boolean
	client: string
	client_label: string
	article: string
	designation: string
	trace: string | null
	procede: string | null
	poses: number
	grille: string | null
	format: string | null
	support: string | null
	chutes: number | null
	machine: string | null
	origine: string
	ideale: boolean
	ideale_manuelle: boolean
	obsolete: boolean
	groupage: string | null
}

export interface ImpositionsResponse extends ListResponse {
	impositions: ImpositionListRow[]
	counts: Record<ImpositionView, number>
	page_length: number
}

export interface ImpositionOptions {
	doctype: string
	filter_fields: FilterField[]
}

export interface ImpositionDetail {
	name: string
	modified: string
	creation: string
	tags: string[]
	can_write: boolean
	can_choose: boolean
	can_auto: boolean
	client: string
	client_label: string
	article: string
	designation: string
	procede: string | null
	trace: { name: string; dimensions: string | null; ver: number; statut: string } | null
	poses: number
	n_col: number
	n_rang: number
	rotation: number
	motif: string | null
	format: string | null
	support: string | null
	format_support: string | null
	chutes: number | null
	pas_laize: number | null
	pas_depl: number | null
	pont: number | null
	trait_commun: string[]
	machine: string | null
	machine_decoupe: string | null
	forme: string | null
	origine: string
	calcul: string | null
	ideale: boolean
	ideale_manuelle: boolean
	obsolete: boolean
	groupage: string | null
	articles_groupes: { article: string; poses: number }[]
	fichier: { url: string; name: string } | null
	dessin: SheetDrawing | null
	/** Où mène « Refaire à l'atelier » : l'étude ouverte de l'article, sinon un test avec le tracé en service. */
	atelier: { etude: string; status: string } | { trace: string } | null
	autres: { name: string; trace: string | null; poses: number; format: string | null; chutes: number | null; ideale: boolean; obsolete: boolean; groupage: string | null; origine: string }[]
	etudes: { name: string; status: string; demande: string | null }[]
	comments: CommentSummary
}

export const origineLabel = (origine: string) => (origine === ORIGINE_ATELIER ? 'Atelier' : 'À la main')

export function chutesText(value: number | null | undefined) {
	return value === null || value === undefined ? '' : `${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
}

export function mmText(value: number | null | undefined) {
	return value ? `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} mm` : ''
}

/** L'état qui compte d'une imposition, dans l'ordre où on le lit. */
export function impositionFlags(row: Pick<ImpositionListRow, 'obsolete' | 'ideale' | 'ideale_manuelle' | 'groupage'>) {
	const flags: { label: string; tone: string; title?: string }[] = []
	if (row.obsolete) flags.push({ label: 'Obsolète', tone: 'tone-gray', title: "Calculée sur une version du tracé qui n'est plus en service : à refaire." })
	if (row.ideale) flags.push({ label: 'Idéale', tone: 'tone-green', title: row.ideale_manuelle ? 'Choisie à la main' : 'Le moins de chutes' })
	if (row.groupage) flags.push({ label: 'Groupée', tone: 'tone-violet', title: row.groupage })
	return flags
}

/** Pourquoi elle est l'idéale : la règle tient en une phrase. */
export function idealeText(row: Pick<ImpositionDetail, 'ideale' | 'ideale_manuelle'>) {
	if (!row.ideale) return ''
	return row.ideale_manuelle ? "Choisie à la main : le calcul automatique ne la remplace pas." : "Le moins de chutes pour ce tracé, la plus récente à égalité."
}

export const IMPOSITION_COLUMNS: Column<ImpositionListRow>[] = [
	{ key: 'name', label: 'Imposition', width: 128, minWidth: 104, sortable: true, text: (row) => row.name },
	{ key: 'designation', label: 'Article', width: 160, minWidth: 120, grow: 2, sortable: true, text: (row) => row.designation },
	{ key: 'client_label', label: 'Client', width: 120, minWidth: 88, grow: 1, sortable: true, text: (row) => row.client_label },
	{ key: 'trace', label: 'Tracé', width: 116, minWidth: 104, sortable: true, text: (row) => row.trace || '' },
	{ key: 'poses', label: 'Poses', width: 64, minWidth: 56, sortable: true, end: true, text: (row) => row.poses },
	{ key: 'format', label: 'Format (mm)', width: 96, minWidth: 88, sortable: true, text: (row) => row.format || '' },
	{ key: 'chutes', label: 'Chutes', width: 72, minWidth: 64, sortable: true, end: true, text: (row) => chutesText(row.chutes) },
	{ key: 'machine', label: 'Machine', width: 104, minWidth: 88, grow: 1, sortable: true, text: (row) => row.machine || '' },
	{ key: 'origine', label: 'Origine', width: 80, minWidth: 72, sortable: true, text: (row) => origineLabel(row.origine) },
	{ key: 'etat', label: 'État', width: 112, minWidth: 96, sortable: false, text: (row) => impositionFlags(row).map((flag) => flag.label).join(', ') },
	{ key: 'tags', label: 'Tags', width: 90, minWidth: 72, sortable: false, optional: true, text: tagsText },
	{ key: 'creation', label: 'Créée le', width: 88, minWidth: 80, sortable: true, text: (row) => formatDay(row.creation) },
	{ key: 'modified', label: 'Modifiée le', width: 92, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.modified) },
]

export function defaultImpositionColumns() {
	return IMPOSITION_COLUMNS.filter((column) => !column.optional).map((column) => column.key)
}

export function impositionSortText(sort: Sort | null) {
	const column = sort && IMPOSITION_COLUMNS.find((item) => item.key === sort.key)
	if (!column) return 'Les plus récentes'
	return `${column.label} ${sort.dir === 'asc' ? '↑' : '↓'}`
}
