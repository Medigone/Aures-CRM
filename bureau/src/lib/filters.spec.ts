import { describe, expect, it } from 'vitest'
import { conditionLabel, conditionsForServer, isComplete, kindOf, newCondition, operatorsOf, withField } from './filters'

describe('filtres de la file', () => {
	it('décrit un filtre actif en clair', () => {
		const references = { types: [], statuses: [], urgences: [], creances: [], assignees: [{ value: 'a@x.dz', label: 'Amine' }], nobody: '__nobody__' }
		const label = (field: string, op: string, value = '') => conditionLabel({ id: 1, field, op, value }, references)
		expect(label('status', 'est', 'Pending')).toBe('Statut est En pause')
		expect(label('echeance', 'avant', '2026-11-05')).toBe('Échéance avant le 05/11/2026')
		expect(label('echeance', 'vide')).toBe('Échéance sans échéance')
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
