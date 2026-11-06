/** Fenêtre d'export : ce qu'on exporte, et le fichier qui en sort. */
import { conditionsForServer, type Condition } from './filters'
import { ticketsToCsv, type Column } from './list'

export type ExportFormat = 'xlsx' | 'csv'

export interface ExportQuery {
	view: string
	conditions: Condition[]
	search: string
}

/** « Tout exporter » ignore la vue, les filtres et la recherche de la liste. */
export const EVERYTHING: ExportQuery = { view: 'all', conditions: [], search: '' }

/** Deux demandes qui portent sur les mêmes lignes : un filtre incomplet ne change rien au résultat. */
export function querySignature(query: ExportQuery) {
	return JSON.stringify([query.view, conditionsForServer(query.conditions), query.search.trim()])
}

export function countText(count: number, noun: string) {
	if (count === 0) return `Aucun ${noun} à exporter`
	return count === 1 ? `1 ${noun} sera exporté` : `${count.toLocaleString('fr-FR')} ${noun}s seront exportés`
}

export function exportTable<Row>(rows: Row[], columns: Column<Row>[]) {
	return { headers: columns.map((column) => column.label), cells: rows.map((row) => columns.map((column) => column.text(row))) }
}

export function exportFileName(noun: string, format: ExportFormat, today = new Date().toISOString().slice(0, 10)) {
	return `${noun}s-${today}.${format}`
}

function save(blob: Blob, name: string) {
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = name
	link.click()
	URL.revokeObjectURL(url)
}

export function saveCsv<Row>(rows: Row[], columns: Column<Row>[], name: string) {
	save(new Blob([ticketsToCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }), name)
}

/** Le serveur rend le classeur en base 64 : on l'enregistre tel quel. */
export function saveXlsx(base64: string, name: string) {
	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
	save(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name)
}
