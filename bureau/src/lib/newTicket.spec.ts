import { describe, expect, it } from 'vitest'
import { typeGuide, validateNewTicket } from './newTicket'

describe('création de ticket', () => {
	const form = { client: 'CLI-1', type: 'Autre', site: 'S1', description: 'Une demande' }

	it('accepte une saisie complète', () => {
		expect(validateNewTicket(form)).toEqual({})
	})

	it('dit quoi faire pour chaque champ manquant', () => {
		const errors = validateNewTicket({ client: null, type: '', site: '', description: '   ' })
		expect(Object.keys(errors).sort()).toEqual(['client', 'description', 'site', 'type'])
		expect(errors.description).toBe('Décrivez la demande.')
	})

	it('adapte le conseil au type', () => {
		expect(typeGuide('Réclamation').hint).toContain('photo')
		expect(typeGuide('Autre').hint).toBeUndefined()
		expect(typeGuide('').placeholder).toBe('Demande du client…')
	})
})
