/** Règles de la liste des tickets : colonnes, tri, export et actions groupées. */
import { statusLabel } from './display'
import type { BulkResult, QueueTicket } from '@/types'

export interface Sort {
	key: string
	dir: 'asc' | 'desc'
}

export interface Column<Row = QueueTicket> {
	key: string
	label: string
	/** Largeur fixe en pixels, ou minimum d'une colonne qui partage la place restante. */
	width: number
	grow?: number
	sortable: boolean
	/** Absente de l'affichage par défaut : elle s'ajoute par le menu Colonnes. */
	optional?: boolean
	/** Nombres : alignés à droite. */
	end?: boolean
	/** Valeur de l'export. */
	text: (row: Row) => string | number
}

export const COLUMNS: Column[] = [
	{ key: 'client', label: 'Client', width: 140, grow: 1.5, sortable: true, text: (ticket) => ticket.client },
	{ key: 'type', label: 'Type', width: 110, grow: 1.1, sortable: true, text: (ticket) => ticket.request_type },
	{ key: 'status', label: 'Statut', width: 132, sortable: true, text: (ticket) => statusLabel(ticket.status) },
	{ key: 'urgence', label: 'Urg.', width: 84, sortable: true, text: (ticket) => ticket.niveau_urgence },
	{ key: 'echeance', label: 'Échéance', width: 92, sortable: true, text: (ticket) => ticket.echeance || '' },
	// L'étape se calcule ligne par ligne sur le serveur : elle ne peut pas trier toute la vue.
	{ key: 'step', label: 'Étape', width: 140, grow: 1.3, sortable: false, text: (ticket) => stepText(ticket) },
	{ key: 'name', label: 'N° ticket', width: 104, sortable: true, text: (ticket) => ticket.name },
	{ key: 'assigne', label: 'Pris en charge', width: 120, grow: 1.1, sortable: true, text: (ticket) => ticket.assigne_a_nom || '' },
	{ key: 'comments', label: 'Comm.', width: 56, sortable: false, text: (ticket) => ticket.comments },
	{ key: 'commercial', label: 'Commercial', width: 120, grow: 1.1, sortable: true, optional: true, text: (ticket) => ticket.commercial || '' },
	{ key: 'creance', label: 'Créance', width: 104, sortable: true, optional: true, text: (ticket) => creanceText(ticket) },
]

export const DEFAULT_COLUMNS = COLUMNS.filter((column) => !column.optional).map((column) => column.key)
export const SORTABLE_COLUMNS = COLUMNS.filter((column) => column.sortable)
const CHECK_WIDTH = 32
const COLUMN_GAP = 8
const MENU_WIDTH = 30
const TRAY_BORDER = 2

/** La colonne Client reste toujours affichée ; une clé inconnue, venue d'un ancien réglage, est ignorée. */
export function visibleColumns(keys: string[]) {
	return COLUMNS.filter((column) => column.key === 'client' || keys.includes(column.key))
}

export function gridTemplate<Row>(columns: Column<Row>[]) {
	return columns.map((column) => (column.grow ? `minmax(${column.width}px, ${column.grow}fr)` : `${column.width}px`)).join(' ')
}

export function minListWidth<Row>(columns: Column<Row>[]) {
	return CHECK_WIDTH + MENU_WIDTH + TRAY_BORDER + columns.reduce((sum, column) => sum + column.width, 0) + COLUMN_GAP * (columns.length - 1)
}

export function sortText(sort: Sort | null) {
	const column = sort && COLUMNS.find((item) => item.key === sort.key)
	return column ? `Tri : ${column.label.toLowerCase()}` : 'Tri : urgence, puis échéance'
}

function csvCell(value: string | number) {
	const text = String(value)
	// Un tableur exécuterait une cellule qui commence par l'un de ces signes.
	const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
	return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV au format attendu par Excel en français : point-virgule, et marque d'encodage pour les accents. */
export function ticketsToCsv<Row = QueueTicket>(rows: Row[], columns: Column<Row>[]) {
	const lines = [columns.map((column) => csvCell(column.label)), ...rows.map((row) => columns.map((column) => csvCell(column.text(row))))]
	return `\ufeff${lines.map((line) => line.join(';')).join('\r\n')}`
}

/** Un clic trie, le deuxième inverse, le troisième revient à l'ordre du serveur. */
export function nextSort(sort: Sort | null, key: string): Sort | null {
	if (sort?.key !== key) return { key, dir: 'asc' }
	return sort.dir === 'asc' ? { key, dir: 'desc' } : null
}

export function stepText({ step }: QueueTicket) {
	return step.current === null ? step.label : `${step.current + 1}/${step.total} ${step.label}`
}

export function stepPercent({ step }: QueueTicket) {
	return step.total ? Math.round((step.done / step.total) * 100) : 0
}

/** La créance ne concerne que les bons de commande. */
export function creanceText(ticket: QueueTicket) {
	return ticket.request_type === 'Bon de commande' ? ticket.statut_creance || 'Non vérifiée' : '—'
}

export const isOpen = (ticket: QueueTicket) => !['Terminé', 'Annulé'].includes(ticket.status)
export const canStart = (ticket: QueueTicket) => ticket.status === 'Nouveau'
export const canPause = (ticket: QueueTicket) => ticket.status === 'En Cours'

/** « 3 tickets attribués à Amine · 1 non traité » */
export function bulkSummary(result: BulkResult, one: string, many: string) {
	const done = result.done.length
	const parts = done ? [`${done} ${done > 1 ? many : one}`] : []
	const skipped = result.skipped.length
	if (skipped) parts.push(`${skipped} non traité${skipped > 1 ? 's' : ''}`)
	return parts.join(' · ')
}
