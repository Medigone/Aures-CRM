/** Vues enregistrées des listes : colonnes, largeurs, tri, filtres et choix « Afficher ». */
import { formatDay } from './display'
import { conditionsForServer, type Condition, type FieldKind, type FilterField } from './filters'
import type { Column, Sort } from './list'

export interface ColumnSetting {
	key: string
	/** Largeur choisie en pixels ; sans elle, la colonne garde sa largeur déclarée. */
	width?: number
}

export interface ListLayout {
	columns: ColumnSetting[]
	sort: Sort | null
	view: string
	conditions: Omit<Condition, 'id'>[]
}

export const MIN_COLUMN_WIDTH = 56
export const MAX_COLUMN_WIDTH = 800

const FIELD_WIDTHS: Record<FieldKind, number> = { text: 160, link: 150, choice: 130, date: 100, number: 96, check: 72 }

/** Une colonne tirée d'un champ du doctype, dont la valeur est lue à part sur le serveur. */
export function fieldColumn<Row>(field: FilterField, key: string, label: string, valueOf: (row: Row) => string | number | null | undefined): Column<Row> {
	return {
		key,
		label,
		width: FIELD_WIDTHS[field.kind],
		sortable: false,
		end: field.kind === 'number',
		field,
		text: (row) => {
			const value = valueOf(row) ?? ''
			return field.choices?.find((item) => item.value === String(value))?.label ?? value
		},
	}
}

/** Ce qu'affiche la cellule d'un champ ajouté : l'export, lui, garde la valeur brute. */
export function fieldCellText<Row>(column: Column<Row>, row: Row) {
	const value = column.text(row)
	if (value === '') return '—'
	if (column.field?.kind === 'date') return formatDay(String(value)) || '—'
	return typeof value === 'number' ? value.toLocaleString('fr-FR') : String(value)
}

/** La colonne verrouillée passe en tête, les doublons et les colonnes vides de clé disparaissent. */
export function normalizeColumns(columns: ColumnSetting[], locked: string): ColumnSetting[] {
	const seen = new Set<string>()
	const unique = columns.filter(({ key }) => {
		if (!key || seen.has(key)) return false
		seen.add(key)
		return true
	})
	return [unique.find(({ key }) => key === locked) ?? { key: locked }, ...unique.filter(({ key }) => key !== locked)]
}

/** Applique une liste de clés en gardant les largeurs déjà choisies. */
export function withColumnKeys(columns: ColumnSetting[], keys: string[], locked: string) {
	const known = new Map(columns.map((column) => [column.key, column]))
	return normalizeColumns(keys.map((key) => known.get(key) ?? { key }), locked)
}

/** Place une colonne juste avant une autre. La colonne verrouillée ne bouge pas, et rien ne passe avant elle. */
export function moveColumnBefore(columns: ColumnSetting[], key: string, target: string, locked: string) {
	if (key === locked || key === target || !columns.some((column) => column.key === key)) return columns
	const moved = columns.find((column) => column.key === key)!
	const others = columns.filter((column) => column.key !== key)
	const at = others.findIndex((column) => column.key === target)
	if (at < 0 || target === locked) return columns
	return [...others.slice(0, at), moved, ...others.slice(at)]
}

/** Largeur choisie, bornée ; sans largeur, la colonne reprend celle qui est déclarée. */
export function resizeColumn(columns: ColumnSetting[], key: string, width?: number) {
	return columns.map((column) => {
		if (column.key !== key) return column
		if (width === undefined) return { key }
		return { key, width: Math.round(Math.min(Math.max(width, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH)) }
	})
}

/** Les colonnes affichées, dans l'ordre choisi. Une clé inconnue, venue d'un ancien réglage ou d'un champ pas encore chargé, est ignorée. */
export function resolveColumns<Row>(all: Column<Row>[], settings: ColumnSetting[]): Column<Row>[] {
	const byKey = new Map(all.map((column) => [column.key, column]))
	return settings.flatMap(({ key, width }) => {
		const column = byKey.get(key)
		if (!column) return []
		return [width ? { ...column, width, grow: undefined } : column]
	})
}

/** Deux dispositions égales : seuls comptent les filtres complets, et la recherche n'en fait pas partie. */
export function layoutSignature(layout: ListLayout) {
	const conditions = conditionsForServer(layout.conditions.map((condition, id) => ({ ...condition, id })))
	return JSON.stringify([layout.columns.map(({ key, width }) => [key, width ?? 0]), layout.sort ? [layout.sort.key, layout.sort.dir] : null, layout.view, conditions])
}

/** Une vue relue, adaptée à la liste : un tri ou un choix « Afficher » que la liste ne connaît plus est écarté. */
export function cleanLayout(layout: Partial<ListLayout>, list: { locked: string; sortable: string[]; views: string[]; defaultView: string; defaultColumns: string[] }): ListLayout {
	const sort = layout.sort
	return {
		columns: normalizeColumns(layout.columns?.length ? layout.columns : list.defaultColumns.map((key) => ({ key })), list.locked),
		sort: sort && list.sortable.includes(sort.key) ? { key: sort.key, dir: sort.dir } : null,
		view: layout.view && list.views.includes(layout.view) ? layout.view : list.defaultView,
		conditions: (layout.conditions ?? []).map(({ doctype, field, op, value }) => ({ doctype, field, op, value })),
	}
}

/** Ce que retiendra la vue, pour le dire avant de l'enregistrer. */
export function layoutSummary(layout: ListLayout, sortLabel: string) {
	const columns = layout.columns.length
	const filters = conditionsForServer(layout.conditions.map((condition, id) => ({ ...condition, id }))).length
	return [`${columns} colonne${columns > 1 ? 's' : ''} avec leurs largeurs`, sortLabel ? `le tri par ${sortLabel.charAt(0).toLowerCase()}${sortLabel.slice(1)}` : 'le tri par défaut', filters ? `${filters} filtre${filters > 1 ? 's' : ''}` : 'aucun filtre'].join(', ')
}

const widthsKey = (key: string) => `${key}:largeurs`
const activeKey = (key: string) => `${key}:vue`

/** Les retouches de la Vue standard, sur cet appareil. Les colonnes restent un simple tableau de clés, comme avant les vues. */
export function readStandardColumns(key: string, defaults: string[]): ColumnSetting[] {
	try {
		const saved = JSON.parse(localStorage.getItem(key) || 'null')
		const keys = Array.isArray(saved) ? (saved as string[]) : defaults
		const widths = JSON.parse(localStorage.getItem(widthsKey(key)) || '{}') as Record<string, number>
		return keys.map((item) => (widths[item] ? { key: item, width: widths[item] } : { key: item }))
	} catch {
		return defaults.map((item) => ({ key: item }))
	}
}

export function writeStandardColumns(key: string, columns: ColumnSetting[]) {
	try {
		localStorage.setItem(key, JSON.stringify(columns.map((column) => column.key)))
		localStorage.setItem(widthsKey(key), JSON.stringify(Object.fromEntries(columns.flatMap(({ key: item, width }) => (width ? [[item, width]] : [])))))
	} catch {
		// Stockage indisponible : le choix vaut pour cette session.
	}
}

export interface ActiveView {
	/** Absent : la Vue standard. */
	name?: string
	label?: string
	config?: ListLayout
}

/** La dernière vue utilisée sur cet appareil, avec une copie pour ouvrir la liste sans attendre le serveur. */
export function readActiveView(key: string): ActiveView | null {
	try {
		const saved = JSON.parse(localStorage.getItem(activeKey(key)) || 'null')
		return saved && typeof saved === 'object' ? (saved as ActiveView) : null
	} catch {
		return null
	}
}

export function writeActiveView(key: string, active: ActiveView) {
	try {
		localStorage.setItem(activeKey(key), JSON.stringify(active))
	} catch {
		// Stockage indisponible : la vue vaut pour cette session.
	}
}
