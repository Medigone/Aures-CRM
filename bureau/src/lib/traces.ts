/** Règles de la page Tracés : types, vues et colonnes. Un tracé naît d'une étude ; ici on le consulte et on le fait évoluer par versions. */
import type { CommentSummary } from '@/types'
import type { FilterField } from './filters'
import { formatDay } from './display'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export const TRACE_DOCTYPE = 'Trace'

export type TraceView = 'service' | 'sans_imposition' | 'image' | 'obsoletes' | 'all'

export const TRACE_VIEWS: { key: TraceView; label: string }[] = [
	{ key: 'service', label: 'En service' },
	{ key: 'sans_imposition', label: 'Sans imposition' },
	{ key: 'image', label: 'Image à remplacer par un PDF' },
	{ key: 'obsoletes', label: 'Anciennes versions' },
	{ key: 'all', label: 'Toutes les versions' },
]
export const DEFAULT_TRACE_VIEW: TraceView = 'service'

export type FileKind = 'pdf' | 'image' | null

export interface TraceRow {
	name: string
	modified: string
	creation: string
	tags: string[]
	cloche: boolean
	statut: string
	ver: number
	client: string
	client_label: string
	article: string
	designation: string
	procede: string | null
	dimensions: string | null
	points_colle: number
	fichier: FileKind
	impositions: number
}

export interface TracesResponse extends ListResponse {
	traces: TraceRow[]
	counts: Record<TraceView, number>
	page_length: number
}

export interface TraceOptions {
	doctype: string
	filter_fields: FilterField[]
}

export interface TraceFile {
	url: string
	name: string
	kind: FileKind
}

export interface TraceVersion {
	name: string
	ver: number
	statut: string
	date_activation: string | null
	desc_changements: string | null
	fichier: TraceFile | null
	dimensions: string | null
	par?: string
}

export interface TraceImposition {
	name: string
	poses: number
	format: string | null
	chutes: number | null
	machine: string | null
	ideale: boolean
	obsolete: boolean
	groupage: string | null
	origine: string
	creation: string
}

export interface TraceDetail {
	name: string
	modified: string
	creation: string
	tags: string[]
	can_write: boolean
	can_version: boolean
	can_replace_file: boolean
	statut: string
	ver: number
	date_activation: string | null
	version_origine: string | null
	remplacee_par: string | null
	desc_changements: string | null
	client: string
	client_label: string
	article: string
	designation: string
	cotations: string | null
	procede: string | null
	dimensions: string | null
	points_colle: number
	fichier: TraceFile | null
	versions: TraceVersion[]
	/** Absent quand le rôle ne lit pas les impositions. */
	impositions: TraceImposition[] | null
	etudes: { name: string; status: string; demande: string | null; assigne: string | null; creation: string }[]
	formes: { name: string; numero: string | null; a_refaire: boolean }[]
	comments: CommentSummary
}

export interface TracePreview {
	image: string
	pages: number
	width: number
	height: number
}

/** Ce que le PDF d'un tracé dit de lui, lu sans rien enregistrer. */
export interface TraceAnalysis {
	lisible: boolean
	message?: string
	titre?: string
	reference?: string | null
	designation?: string | null
	cotations?: string | null
	confirmees?: boolean
	cotes?: number
	developpe?: [number, number] | null
	atelier?: boolean
	rainage?: boolean
	autres_couleurs?: number
	pages?: number
}

/** Les alertes de la lecture, de la plus grave à la plus légère. */
export function analysisWarnings(analysis: TraceAnalysis) {
	if (!analysis.lisible) return [analysis.message || "Ce fichier ne s'est pas lu."]
	const lines: string[] = []
	if (!analysis.atelier) lines.push("Aucun trait de coupe noir : l'atelier ne pourra pas calculer d'imposition avec ce fichier.")
	if (analysis.autres_couleurs) lines.push("Des traits ont une couleur hors convention (ni noir, ni rouge, ni bleu) : vérifiez qu'aucune découpe n'y manque.")
	if (!analysis.cotations) lines.push('Pas de cotations dans le titre du PDF : saisissez-les.')
	else if (!analysis.confirmees) lines.push('Les cotations du titre ne se retrouvent pas toutes dans les cotes du dessin : vérifiez-les.')
	return lines
}

export interface TraceVersionResult {
	name: string
	ver: number
	impositions: number
	formes: string[]
	etudes: string[]
	trace: TraceDetail
}

export const isObsolete = (trace: { statut: string }) => trace.statut === 'Obsolète'

/** « 230 × 247,2 » : la façon d'écrire les cotes sur tout le bureau. */
export function dimensionsText(value?: string | null) {
	return (value || '').replace(/\s*[x×]\s*/gi, ' × ').replace(/\./g, ',').trim()
}

export const fileKindLabel = (kind: FileKind) => (kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : '')

export const versionLabel = (ver: number) => `V${ver}`

export const TRACE_COLUMNS: Column<TraceRow>[] = [
	{ key: 'name', label: 'Tracé', width: 128, minWidth: 104, sortable: true, text: (row) => row.name },
	{ key: 'ver', label: 'Version', width: 64, minWidth: 56, sortable: true, text: (row) => versionLabel(row.ver) },
	{ key: 'designation', label: 'Article', width: 170, minWidth: 120, grow: 2, sortable: true, text: (row) => row.designation },
	{ key: 'client_label', label: 'Client', width: 120, minWidth: 88, grow: 1, sortable: true, text: (row) => row.client_label },
	{ key: 'procede', label: 'Procédé', width: 72, minWidth: 64, sortable: true, text: (row) => row.procede || '' },
	{ key: 'dimensions', label: 'Dimensions (mm)', width: 112, minWidth: 96, sortable: true, text: (row) => dimensionsText(row.dimensions) },
	{ key: 'points_colle', label: 'Points colle', width: 84, minWidth: 64, sortable: true, end: true, text: (row) => row.points_colle },
	{ key: 'fichier', label: 'Fichier', width: 72, minWidth: 64, sortable: true, text: (row) => fileKindLabel(row.fichier) || 'Aucun' },
	{ key: 'impositions', label: 'Impositions', width: 80, minWidth: 72, sortable: true, end: true, text: (row) => row.impositions },
	{ key: 'statut', label: 'Statut', width: 104, minWidth: 88, sortable: true, text: (row) => row.statut },
	{ key: 'tags', label: 'Tags', width: 90, minWidth: 72, sortable: false, optional: true, text: tagsText },
	{ key: 'creation', label: 'Créé le', width: 92, minWidth: 80, sortable: true, text: (row) => formatDay(row.creation) },
	{ key: 'modified', label: 'Modifié le', width: 92, minWidth: 80, sortable: true, optional: true, text: (row) => formatDay(row.modified) },
]

export function defaultTraceColumns() {
	return TRACE_COLUMNS.filter((column) => !column.optional && column.key !== 'statut').map((column) => column.key)
}

export function traceSortText(sort: Sort | null) {
	const column = sort && TRACE_COLUMNS.find((item) => item.key === sort.key)
	if (!column) return 'Les plus récents'
	return `${column.label} ${sort.dir === 'asc' ? '↑' : '↓'}`
}

/** Ce qu'une nouvelle version entraîne, dit avant de la créer. */
export function versionConsequences(trace: { impositions?: number | TraceImposition[] | null; formes?: { a_refaire: boolean }[]; etudes?: { status: string }[] }) {
	const live = Array.isArray(trace.impositions) ? trace.impositions.filter((row) => !row.obsolete).length : trace.impositions || 0
	const formes = (trace.formes ?? []).filter((row) => !row.a_refaire).length
	const open = (trace.etudes ?? []).filter((row) => row.status === 'Nouveau' || row.status === 'En étude').length
	const lines: string[] = []
	if (live) lines.push(`${live} imposition${live > 1 ? 's deviendront obsolètes' : ' deviendra obsolète'} : à refaire à l'atelier.`)
	if (formes) lines.push(`${formes > 1 ? `${formes} formes de découpe seront signalées` : 'La forme de découpe sera signalée'} à refaire.`)
	if (open) lines.push(`${open > 1 ? `Les ${open} études en cours passeront` : "L'étude en cours passera"} sur la nouvelle version.`)
	return lines
}

/** Message après la création d'une version. */
export function versionDoneText(result: { ver: number; impositions: number; formes: number | string[] }) {
	const formes = Array.isArray(result.formes) ? result.formes.length : result.formes
	const parts = [`Version ${result.ver} mise en service.`]
	if (result.impositions) parts.push(`${result.impositions} imposition${result.impositions > 1 ? 's' : ''} à refaire.`)
	if (formes) parts.push(`${formes} forme${formes > 1 ? 's' : ''} de découpe à refaire.`)
	return parts.join(' ')
}
