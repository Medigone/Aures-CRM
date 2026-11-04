import { describe, expect, it } from 'vitest'
import { exactTime, initialsOf, insertMention, mentionQuery, relativeTime } from '@shared/activity'

describe('fil de commentaires', () => {
	const now = new Date(2026, 10, 4, 15, 0, 0)

	it('dit les dates comme une personne', () => {
		expect(relativeTime('2026-11-04 14:59:40', now)).toBe("À l'instant")
		expect(relativeTime('2026-11-04 14:20:00.123456', now)).toBe('Il y a 40 min')
		expect(relativeTime('2026-11-04 12:30:00', now)).toBe('Il y a 2 h')
		expect(relativeTime('2026-11-03 23:50:00', now)).toBe('Hier')
		expect(relativeTime('2026-10-30 10:00:00', now)).toBe('Le 30/10')
		expect(relativeTime('2025-10-30 10:00:00', now)).toBe('Le 30/10/2025')
		expect(exactTime('2026-10-30 09:05:00')).toBe('30/10/2026 à 09:05')
	})

	it('repère une mention en cours de saisie', () => {
		expect(mentionQuery('Bonjour @Ya')).toBe('Ya')
		expect(mentionQuery('@')).toBe('')
		expect(mentionQuery('Bonjour')).toBeNull()
		expect(mentionQuery('a.b@exemple.dz')).toBeNull()
		expect(mentionQuery('@Yacine Ferhat ')).toBeNull()
	})

	it('insère le nom choisi à la place de la saisie', () => {
		expect(insertMention('Bonjour @Ya et merci', 11, 'Yacine Ferhat')).toEqual({ text: 'Bonjour @Yacine Ferhat  et merci', caret: 23 })
	})

	it('tire les initiales du nom', () => {
		expect(initialsOf('Amel Kaci')).toBe('AK')
		expect(initialsOf('Administrator')).toBe('A')
	})
})
