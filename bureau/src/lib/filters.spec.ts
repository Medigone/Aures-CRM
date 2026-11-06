import { describe, expect, it } from 'vitest'
import { COMMON_GROUP, conditionLabel, conditionsForServer, describeCondition, groupFields, isComplete, kindOf, newCondition, operatorsOf, searchFields, withDoctypeFields, withField, type FilterField } from './filters'

describe('filtres de la file', () => {
	it('décrit un filtre actif en clair', () => {
		const references = { types: [], statuses: [], urgences: [], creances: [], assignees: [{ value: 'a@x.dz', label: 'Amine' }], nobody: '__nobody__' }
		const label = (field: string, op: string, value = '') => conditionLabel({ id: 1, field, op, value }, references)
		expect(label('status', 'est', 'Pending')).toBe('Statut est En pause')
		expect(label('echeance', 'avant', '2026-11-05')).toBe('Échéance avant le 05/11/2026')
		expect(label('echeance', 'vide')).toBe('Échéance sans date')
		expect(label('assigne', 'nest', 'a@x.dz')).toBe("Pris en charge par n'est pas Amine")
		expect(label('assigne', 'est', '__nobody__')).toBe('Pris en charge par est Non attribué')
	})

	it('adapte les conditions à la nature du champ', () => {
		expect(kindOf('client')).toBe('text')
		expect(operatorsOf('echeance').map((op) => op.value)).toEqual(['avant', 'apres', 'vide'])
		expect(newCondition(1, 'client')).toEqual({ id: 1, field: 'client', op: 'contient', value: '' })
	})

	it('repart à zéro quand le champ change', () => {
		const condition = { id: 4, field: 'type', op: 'nest', value: 'Réclamation' }
		expect(withField(condition, 'echeance')).toEqual({ id: 4, field: 'echeance', op: 'avant', value: '' })
	})

	it("n'envoie que les filtres complets", () => {
		const conditions = [
			{ id: 1, field: 'type', op: 'est', value: 'Bon de commande' },
			{ id: 2, field: 'creance', op: 'est', value: '' },
			{ id: 3, field: 'echeance', op: 'vide', value: '' },
			{ id: 4, field: 'client', op: 'contient', value: '  laiterie ' },
		]
		expect(isComplete(conditions[1])).toBe(false)
		expect(conditionsForServer(conditions)).toEqual([
			{ field: 'type', op: 'est', value: 'Bon de commande' },
			{ field: 'echeance', op: 'vide', value: '' },
			{ field: 'client', op: 'contient', value: 'laiterie' },
		])
	})
})

describe('filtres sur tous les champs du doctype', () => {
	const extra: FilterField[] = [
		{ value: 'champ:custom_grammage', label: 'Grammage', kind: 'number', group: 'Support' },
		{ value: 'champ:custom_procédé', label: 'Procédé détaillé', kind: 'choice', group: 'Support', choices: [{ value: 'Offset', label: 'Offset' }] },
		{ value: 'champ:creation', label: 'Créé le', kind: 'date', group: 'Suivi' },
	]
	const fields = withDoctypeFields([{ value: 'tag', label: 'Tag', kind: 'text' }], extra)

	it('cherche sans tenir compte des accents ni des majuscules', () => {
		expect(searchFields(fields, 'PROCEDE').map((field) => field.label)).toEqual(['Procédé détaillé'])
		expect(searchFields(fields, 'detaille proc').map((field) => field.label)).toEqual(['Procédé détaillé'])
		expect(searchFields(fields, '').length).toBe(4)
		expect(searchFields(fields, 'introuvable')).toEqual([])
		expect(searchFields([{ value: 'a', label: 'Tolérance Grammage', kind: 'text' }, { value: 'b', label: 'Grammage', kind: 'text' }], 'gramm').map((field) => field.label)).toEqual(['Grammage', 'Tolérance Grammage'])
	})
	it('range les champs par rubrique, les filtres courants en tête', () => {
		expect(groupFields(fields).map((group) => [group.label, group.fields.length])).toEqual([[COMMON_GROUP, 1], ['Support', 2], ['Suivi', 1]])
	})
	it('propose les conditions de chiffres et les décrit dans la pastille', () => {
		expect(operatorsOf('champ:custom_grammage', fields).map((op) => op.value)).toEqual(['egal', 'plus', 'moins'])
		expect(describeCondition({ id: 1, field: 'champ:custom_grammage', op: 'plus', value: '300' }, fields)).toBe('Grammage supérieur à 300')
		expect(describeCondition({ id: 1, field: 'champ:custom_procédé', op: 'est', value: 'Offset' }, fields)).toBe('Procédé détaillé est Offset')
		expect(describeCondition({ id: 1, field: 'champ:creation', op: 'apres', value: '2026-11-01' }, fields)).toBe('Créé le après le 01/11/2026')
	})
	it('la pastille d’un ticket décrit aussi un champ du doctype', () => {
		const references = { types: [], statuses: [], urgences: [], creances: [], assignees: [], nobody: 'x', filter_fields: extra }
		expect(conditionLabel({ id: 1, field: 'champ:custom_grammage', op: 'egal', value: '60' }, references)).toBe('Grammage égal à 60')
	})
})
