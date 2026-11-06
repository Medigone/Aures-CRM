/** Fenêtre d'export : ce qu'on exporte, et le fichier qui en sort. */
import { BELL_FILTER, conditionsForServer, fieldTitle, searchFields, type Condition, type FilterField } from './filters'
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

/** Une colonne proposée à l'export : une colonne de la liste, ou un champ du doctype lu à part sur le serveur. */
export interface ExportColumnOption {
	key: string
	label: string
	hint?: string
	field?: FilterField
}
export const LINES_PER_REQUEST = 500

const listKey = (key: string) => `liste:${key}`
export const listColumnKeys = <Row>(columns: Column<Row>[]) => columns.map((column) => listKey(column.key))

/** Les colonnes de la liste, puis les champs du doctype qu'elles ne montrent pas déjà sous le même nom. */
export function exportColumnOptions<Row>(columns: Column<Row>[], fields: FilterField[]): ExportColumnOption[] {
	const taken = new Set(columns.map((column) => column.label.toLowerCase()))
	const others = fields.filter((field) => field.field !== BELL_FILTER && (field.table || !taken.has(field.label.toLowerCase())))
	return [
		...columns.map((column) => ({ key: listKey(column.key), label: column.label, hint: 'Liste' })),
		...others.map((field) => ({ key: field.value, label: fieldTitle(field), hint: field.group, field })),
	]
}

/** Recherche alphabétique, la même que pour le champ d'un filtre. */
export function searchLabels(options: ExportColumnOption[], query: string) {
	const asFields = options.map((option) => ({ value: option.key, label: option.label }) as FilterField)
	const byKey = new Map(options.map((option) => [option.key, option]))
	return searchFields(asFields, query).map((item) => byKey.get(item.value)!)
}

/** Les colonnes du fichier : celles de la liste dans leur ordre, puis les champs dans l'ordre où ils ont été cochés. */
export function exportColumns<Row extends { name: string }>(selected: string[], columns: Column<Row>[], options: ExportColumnOption[], values: Record<string, Record<string, string | number>>): Column<Row>[] {
	const chosen = new Set(selected)
	const byKey = new Map(options.map((option) => [option.key, option]))
	const fromFields = selected.flatMap((key) => {
		const option = byKey.get(key)
		if (!option?.field) return []
		const { field } = option
		return [
			{
				key,
				label: option.label,
				width: 0,
				sortable: false,
				text: (row: Row) => {
					const value = values[row.name]?.[key] ?? ''
					const shown = field.choices?.find((item) => item.value === String(value))?.label
					return shown ?? value
				},
			},
		]
	})
	return [...columns.filter((column) => chosen.has(listKey(column.key))), ...fromFields]
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
