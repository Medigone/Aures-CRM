/** Filtres des listes, au format du Desk : doctype (ou table enfant), champ, condition, valeur. Ils s'ajoutent entre eux. */
import { formatDay, statusLabel } from './display'
import type { Option, References } from '@/types'

export type FieldKind = 'text' | 'choice' | 'link' | 'number' | 'date' | 'check'

export interface Condition {
	id: number
	doctype: string
	field: string
	op: string
	/** Toujours du texte : valeurs séparées par des virgules pour « dans la liste », deux dates pour « entre ». */
	value: string
}

/** Un champ filtrable, décrit par le serveur : c'est lui qui connaît les conditions permises. */
export interface FilterField {
	/** Clé unique : « doctype.champ ». */
	value: string
	doctype: string
	field: string
	label: string
	kind: FieldKind
	operators: string[]
	/** Rubrique du champ ; absente pour un filtre courant de la liste. */
	group?: string
	/** Nom de la table enfant, quand le champ vient d'une table. */
	table?: string
	choices?: Option[]
	link_doctype?: string
}

export const conditionKey = (condition: Pick<Condition, 'doctype' | 'field'>) => `${condition.doctype}.${condition.field}`
export const fieldOf = (condition: Pick<Condition, 'doctype' | 'field'>, fields: FilterField[]) => fields.find((item) => item.value === conditionKey(condition))

/** Le nom d'un champ dans le sélecteur fermé : « Code · Couleurs » pour une table enfant. */
export const fieldTitle = (field: FilterField) => (field.table ? `${field.label} · ${field.table}` : field.label)

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Les champs dont le nom ou la table contient tous les mots tapés, sans tenir compte des accents ni des majuscules, par ordre alphabétique. */
export function searchFields(fields: FilterField[], query: string) {
	const words = fold(query).split(/\s+/).filter(Boolean)
	return fields
		.filter((field) => {
			const label = fold(fieldTitle(field))
			return words.every((word) => label.includes(word))
		})
		.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
}

/** La cloche de la personne connectée, commune à toutes les listes : le cœur du Desk. Le serveur y met lui-même l'utilisateur. */
export const BELL_FILTER = 'cloche'

export const hasBell = (conditions: Condition[]) => conditions.some((condition) => condition.field === BELL_FILTER && condition.op === '=' && isComplete(condition))

/** Allume ou éteint le filtre depuis l'en-tête de la liste. */
export function toggleBell(conditions: Condition[], doctype: string): Condition[] {
	const others = conditions.filter((condition) => condition.field !== BELL_FILTER)
	if (hasBell(conditions)) return others
	const id = conditions.reduce((max, condition) => Math.max(max, condition.id), 0) + 1
	return [...others, { id, doctype, field: BELL_FILTER, op: '=', value: '1' }]
}

const OPERATOR_LABELS: Record<string, string> = {
	'=': 'égal à',
	'!=': 'différent de',
	like: 'contient',
	'not like': 'ne contient pas',
	in: 'dans la liste',
	'not in': 'hors de la liste',
	is: 'renseigné ou non',
	'>': 'supérieur à',
	'<': 'inférieur à',
	'>=': 'supérieur ou égal à',
	'<=': 'inférieur ou égal à',
	Between: 'entre',
	Timespan: 'période',
	'descendants of': 'descendants de',
	'descendants of (inclusive)': 'descendants de, lui compris',
	'not descendants of': 'hors descendants de',
	'ancestors of': 'ancêtres de',
	'not ancestors of': 'hors ancêtres de',
}
const DATE_LABELS: Record<string, string> = { '<': 'avant le', '>': 'après le', '<=': 'au plus tard le', '>=': 'au plus tôt le' }
/** Une valeur à choisir se lit mieux avec « est » qu'avec « égal à ». */
const CHOSEN_LABELS: Record<string, string> = { '=': 'est', '!=': "n'est pas" }

export function operatorLabel(op: string, field?: FilterField) {
	if (field?.kind === 'date' && DATE_LABELS[op]) return DATE_LABELS[op]
	if (field && field.kind !== 'text' && field.kind !== 'number' && CHOSEN_LABELS[op]) return CHOSEN_LABELS[op]
	return OPERATOR_LABELS[op] ?? op
}

export function operatorOptions(field?: FilterField): Option[] {
	return (field?.operators ?? []).map((op) => ({ value: op, label: operatorLabel(op, field) }))
}

/** Les périodes du Desk, dans le même ordre. */
export const TIMESPANS: Option[] = [
	{ value: 'last 7 days', label: '7 derniers jours' },
	{ value: 'last 14 days', label: '14 derniers jours' },
	{ value: 'last 30 days', label: '30 derniers jours' },
	{ value: 'last 90 days', label: '90 derniers jours' },
	{ value: 'last week', label: 'La semaine dernière' },
	{ value: 'last month', label: 'Le mois dernier' },
	{ value: 'last quarter', label: 'Le trimestre dernier' },
	{ value: 'last 6 months', label: '6 derniers mois' },
	{ value: 'last year', label: "L'année dernière" },
	{ value: 'yesterday', label: 'Hier' },
	{ value: 'today', label: "Aujourd'hui" },
	{ value: 'tomorrow', label: 'Demain' },
	{ value: 'this week', label: 'Cette semaine' },
	{ value: 'this month', label: 'Ce mois-ci' },
	{ value: 'this quarter', label: 'Ce trimestre' },
	{ value: 'this year', label: 'Cette année' },
	{ value: 'next 7 days', label: '7 prochains jours' },
	{ value: 'next 14 days', label: '14 prochains jours' },
	{ value: 'next 30 days', label: '30 prochains jours' },
	{ value: 'next week', label: 'La semaine prochaine' },
	{ value: 'next month', label: 'Le mois prochain' },
	{ value: 'next quarter', label: 'Le trimestre prochain' },
	{ value: 'next 6 months', label: '6 prochains mois' },
	{ value: 'next year', label: "L'année prochaine" },
]
export const SET_CHOICES: Option[] = [
	{ value: 'set', label: 'Renseigné' },
	{ value: 'not set', label: 'Non renseigné' },
]

export type ValueInput = 'text' | 'list' | 'number' | 'date' | 'between' | 'select' | 'link'

/** La saisie de la valeur dépend du champ et de la condition, comme sur le Desk. */
export function valueInput(field: FilterField | undefined, op: string): ValueInput {
	if (op === 'is' || op === 'Timespan') return 'select'
	if (op === 'Between') return 'between'
	if (op === 'in' || op === 'not in') return 'list'
	if (!field) return 'text'
	if (field.choices && !['like', 'not like'].includes(op)) return 'select'
	if (field.kind === 'date') return 'date'
	if (field.kind === 'number') return 'number'
	if (field.kind === 'link' && !['like', 'not like'].includes(op)) return 'link'
	return 'text'
}

export function valueChoices(field: FilterField | undefined, op: string): Option[] {
	if (op === 'is') return SET_CHOICES
	if (op === 'Timespan') return TIMESPANS
	return field?.choices ?? []
}

export function newCondition(id: number, field: FilterField): Condition {
	return { id, doctype: field.doctype, field: field.field, op: field.operators[0], value: '' }
}

export function isComplete(condition: Pick<Condition, 'op' | 'value'>) {
	if (condition.op === 'Between') {
		const [start, end] = condition.value.split(',')
		return Boolean(start?.trim() && end?.trim())
	}
	return Boolean(condition.value.trim())
}

/** Texte de la pastille d'un filtre actif : « Couleurs · Code contient 186 », « Créé le : ce mois-ci ». */
export function describeCondition(condition: Condition, fields: FilterField[]) {
	const definition = fieldOf(condition, fields)
	const name = definition ? (definition.table ? `${definition.table} · ${definition.label}` : definition.label) : condition.field
	const op = operatorLabel(condition.op, definition)
	if (!isComplete(condition)) return `${name} ${op}`
	const value = condition.value.trim()
	if (condition.op === 'is') return `${name} ${value === 'set' ? 'renseigné' : 'non renseigné'}`
	if (condition.op === 'Timespan') return `${name} : ${(TIMESPANS.find((item) => item.value === value)?.label ?? value).toLowerCase()}`
	if (condition.op === 'Between') {
		const [start, end] = value.split(',')
		return `${name} entre le ${formatDay(start.trim())} et le ${formatDay(end.trim())}`
	}
	const shown = definition?.choices?.find((item) => item.value === value)?.label ?? (definition?.kind === 'date' ? formatDay(value) : value)
	return `${name} ${op} ${shown}`
}

/** Les champs de la file : le statut garde les libellés affichés dans la liste. */
export function ticketFilterFields(references: References | null): FilterField[] {
	return (references?.filter_fields ?? []).map((field) => (field.field === 'status' && field.choices ? { ...field, choices: field.choices.map(({ value }) => ({ value, label: statusLabel(value) })) } : field))
}

/** Seuls les filtres complets partent au serveur. */
export function conditionsForServer(conditions: Condition[]) {
	return conditions.filter(isComplete).map(({ doctype, field, op, value }) => ({ doctype, field, op, value: value.trim() }))
}
