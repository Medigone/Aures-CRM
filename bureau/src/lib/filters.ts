/** Filtres combinables de la file : champ, condition, valeur. Ils s'ajoutent entre eux, comme sur le Desk. */
import { formatDay, statusLabel } from './display'
import type { Option, References } from '@/types'

export type FieldKind = 'text' | 'choice' | 'user' | 'date' | 'number'

export interface Condition {
	id: number
	field: string
	op: string
	value: string
}

export interface FilterField {
	value: string
	label: string
	kind: FieldKind
	/** Rubrique du champ dans la liste de choix. */
	group?: string
	/** Valeurs possibles, quand le champ les porte lui-même. */
	choices?: Option[]
}

/** Les filtres de la liste d'abord, puis tous les champs du doctype envoyés par le serveur. */
export function withDoctypeFields(common: FilterField[], doctypeFields: FilterField[] = []): FilterField[] {
	return [...common, ...doctypeFields]
}

const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Les champs dont le nom contient tous les mots tapés, sans tenir compte des accents ni des majuscules, par ordre alphabétique. */
export function searchFields(fields: FilterField[], query: string) {
	const words = fold(query).split(/\s+/).filter(Boolean)
	return fields
		.filter((field) => {
			const label = fold(field.label)
			return words.every((word) => label.includes(word))
		})
		.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }))
}

/** La cloche de la personne connectée, commune à toutes les listes : le cœur du Desk. */
export const BELL_FILTER = 'cloche'
export const BELL_FIELD: FilterField = { value: BELL_FILTER, label: 'Cloche', kind: 'choice', choices: [{ value: '1', label: 'activée' }] }

export const hasBell = (conditions: Condition[]) => conditions.some((condition) => condition.field === BELL_FILTER && condition.op === 'est' && isComplete(condition))

/** Allume ou éteint le filtre depuis l'en-tête de la liste. */
export function toggleBell(conditions: Condition[]): Condition[] {
	const others = conditions.filter((condition) => condition.field !== BELL_FILTER)
	if (hasBell(conditions)) return others
	const id = conditions.reduce((max, condition) => Math.max(max, condition.id), 0) + 1
	return [...others, { id, field: BELL_FILTER, op: 'est', value: '1' }]
}

export const FIELDS: FilterField[] = [
	{ value: 'client', label: 'Client', kind: 'text' },
	{ value: 'type', label: 'Type de ticket', kind: 'choice' },
	{ value: 'status', label: 'Statut', kind: 'choice' },
	{ value: 'urgence', label: 'Urgence', kind: 'choice' },
	{ value: 'commercial', label: 'Commercial', kind: 'text' },
	{ value: 'assigne', label: 'Pris en charge par', kind: 'user' },
	{ value: 'creance', label: 'Créance', kind: 'choice' },
	{ value: 'echeance', label: 'Échéance', kind: 'date' },
	{ value: 'tag', label: 'Tag', kind: 'text' },
	BELL_FIELD,
]

const OPERATORS: Record<FieldKind, Option[]> = {
	text: [
		{ value: 'contient', label: 'contient' },
		{ value: 'exclut', label: 'ne contient pas' },
	],
	choice: [
		{ value: 'est', label: 'est' },
		{ value: 'nest', label: "n'est pas" },
	],
	user: [
		{ value: 'est', label: 'est' },
		{ value: 'nest', label: "n'est pas" },
	],
	date: [
		{ value: 'avant', label: 'avant le' },
		{ value: 'apres', label: 'après le' },
		{ value: 'vide', label: 'sans date' },
	],
	number: [
		{ value: 'egal', label: 'égal à' },
		{ value: 'plus', label: 'supérieur à' },
		{ value: 'moins', label: 'inférieur à' },
	],
}

export function kindOf(field: string, fields: FilterField[] = FIELDS): FieldKind {
	return fields.find((item) => item.value === field)?.kind ?? 'text'
}

export function operatorsOf(field: string, fields: FilterField[] = FIELDS): Option[] {
	return OPERATORS[kindOf(field, fields)]
}

export function newCondition(id: number, field = 'type', fields: FilterField[] = FIELDS): Condition {
	return { id, field, op: operatorsOf(field, fields)[0].value, value: '' }
}

/** Changer de champ repart de sa première condition, sans valeur : l'ancienne n'aurait plus de sens. */
export function withField(condition: Condition, field: string, fields: FilterField[] = FIELDS): Condition {
	return { ...newCondition(condition.id, field, fields) }
}

export function needsValue(condition: Pick<Condition, 'op'>) {
	return condition.op !== 'vide'
}

export function isComplete(condition: Condition) {
	return !needsValue(condition) || Boolean(condition.value.trim())
}

/** Texte de la pastille d'un filtre actif, dans toute liste : « Grammage égal à 300 ». */
export function describeCondition(condition: Condition, fields: FilterField[], choices: Option[] = []) {
	const definition = fields.find((item) => item.value === condition.field)
	const field = definition?.label ?? condition.field
	const op = operatorsOf(condition.field, fields).find((item) => item.value === condition.op)?.label ?? condition.op
	if (!needsValue(condition) || !isComplete(condition)) return `${field} ${op}`
	const value = condition.value.trim()
	const shown = [...choices, ...(definition?.choices ?? [])].find((item) => item.value === value)?.label ?? (definition?.kind === 'date' ? formatDay(value) : value)
	return `${field} ${op} ${shown}`
}

/** Texte de la pastille d'un filtre actif : « Statut est En pause ». */
export function conditionLabel(condition: Condition, references: References | null) {
	const fields = withDoctypeFields(FIELDS, references?.filter_fields)
	if (condition.field === BELL_FILTER || !FIELDS.some((item) => item.value === condition.field)) return describeCondition(condition, fields)
	const field = FIELDS.find((item) => item.value === condition.field)?.label ?? condition.field
	const op = operatorsOf(condition.field).find((item) => item.value === condition.op)?.label ?? condition.op
	if (!needsValue(condition)) return `${field} ${op}`
	const value = condition.value.trim()
	let shown = value
	if (condition.field === 'status') shown = statusLabel(value)
	else if (condition.field === 'echeance') shown = formatDay(value)
	else if (condition.field === 'assigne') {
		shown = value === references?.nobody ? 'Non attribué' : references?.assignees.find((item) => item.value === value)?.label ?? value
	}
	return `${field} ${op} ${shown}`
}

/** Seuls les filtres complets partent au serveur. */
export function conditionsForServer(conditions: Condition[]) {
	return conditions.filter(isComplete).map(({ field, op, value }) => ({ field, op, value: value.trim() }))
}
