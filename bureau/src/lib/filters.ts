/** Filtres combinables de la file : champ, condition, valeur. Ils s'ajoutent entre eux, comme sur le Desk. */
import { formatDay, statusLabel } from './display'
import type { Option, References } from '@/types'

export type FieldKind = 'text' | 'choice' | 'user' | 'date'

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
		{ value: 'vide', label: 'sans échéance' },
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

/** Texte de la pastille d'un filtre actif : « Statut est En pause ». */
export function conditionLabel(condition: Condition, references: References | null) {
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
