/** Fenêtre d'export : ce qu'on exporte, et le fichier qui en sort. */
import { BELL_FILTER, conditionsForServer, fieldTitle, searchFields, type Condition, type FilterField } from './filters'
import { ticketsToCsv, type Column } from './list'
import { fieldColumn } from './listViews'

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
	group: string
	/** Vrai pour ce qui vient de l'application, faux pour les rubriques standard d'ERPNext. */
	own: boolean
	field?: FilterField
}
export const LINES_PER_REQUEST = 500
export const LIST_RUBRIC = 'Colonnes de la liste'

const listKey = (key: string) => `liste:${key}`
/** Une colonne de la liste, ou un champ déjà ajouté à la liste, qui garde sa clé de champ. */
export const listColumnKeys = <Row>(columns: Column<Row>[]) => columns.map((column) => (column.field ? column.key : listKey(column.key)))
export const columnFromOption = (key: string) => (key.startsWith('liste:') ? key.slice(6) : key)

/** Les colonnes de la liste, puis les champs du doctype qu'elles ne montrent pas déjà sous le même nom. */
export function exportColumnOptions<Row>(columns: Column<Row>[], fields: FilterField[]): ExportColumnOption[] {
	const taken = new Set(columns.map((column) => column.label.toLowerCase()))
	const others = fields.filter((field) => field.field !== BELL_FILTER && (field.table || !taken.has(field.label.toLowerCase())))
	return [
		...columns.map((column) => ({ key: listKey(column.key), label: column.label, group: LIST_RUBRIC, own: true })),
		...others.map((field) => ({ key: field.value, label: fieldTitle(field), group: field.group ?? LIST_RUBRIC, own: !field.group || Boolean(field.own), field })),
	]
}

/** Les rubriques : celles de la liste, puis celles qui portent des champs de l'application, puis les autres par ordre alphabétique. */
export function exportRubrics(options: ExportColumnOption[]) {
	const rubrics = new Map<string, { name: string; own: boolean; options: ExportColumnOption[] }>()
	for (const option of options) {
		const rubric = rubrics.get(option.group) ?? { name: option.group, own: false, options: [] }
		rubric.own ||= option.own
		rubric.options.push(option)
		rubrics.set(option.group, rubric)
	}
	const all = [...rubrics.values()]
	return [...all.filter((rubric) => rubric.own), ...all.filter((rubric) => !rubric.own).sort((a, b) => a.name.localeCompare(b.name, 'fr'))]
}

/** Recherche alphabétique, la même que pour le champ d'un filtre. */
export function searchLabels(options: ExportColumnOption[], query: string) {
	const asFields = options.map((option) => ({ value: option.key, label: option.label }) as FilterField)
	const byKey = new Map(options.map((option) => [option.key, option]))
	return searchFields(asFields, query).map((item) => byKey.get(item.value)!)
}

/** Les colonnes du fichier, dans l'ordre choisi. */
export function exportColumns<Row extends { name: string }>(selected: string[], columns: Column<Row>[], options: ExportColumnOption[], values: Record<string, Record<string, string | number>>): Column<Row>[] {
	const fromList = new Map(columns.map((column) => [listKey(column.key), column]))
	const byKey = new Map(options.map((option) => [option.key, option]))
	return selected.flatMap((key) => {
		const column = fromList.get(key)
		if (column) return [column]
		const option = byKey.get(key)
		if (!option?.field) return []
		return [fieldColumn<Row>(option.field, key, option.label, (row) => values[row.name]?.[key])]
	})
}

const columnsKey = (doctype: string) => `bureau-export-colonnes:${doctype}`

/** Le dernier choix de colonnes de cette liste, dans ce navigateur. */
export function savedExportColumns(doctype: string): string[] | null {
	try {
		const saved = JSON.parse(localStorage.getItem(columnsKey(doctype)) ?? 'null')
		return Array.isArray(saved) && saved.length && saved.every((key) => typeof key === 'string') ? saved : null
	} catch {
		return null
	}
}

export function saveExportColumns(doctype: string, keys: string[]) {
	try {
		localStorage.setItem(columnsKey(doctype), JSON.stringify(keys))
	} catch {
		// Stockage indisponible : le choix vaut pour cet export.
	}
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
