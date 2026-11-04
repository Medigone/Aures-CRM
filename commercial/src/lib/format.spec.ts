import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseServerDate, relativeDays } from './format'

describe('parseServerDate', () => {
	it('lit une date sans heure en heure locale', () => {
		const date = parseServerDate('2026-11-04')!
		expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 4, 0])
	})

	it('lit une date avec heure, et refuse une valeur invalide', () => {
		expect(parseServerDate('2026-11-04 13:05:00')!.getHours()).toBe(13)
		expect(parseServerDate('n/importe')).toBeNull()
		expect(parseServerDate(null)).toBeNull()
	})
})

describe('relativeDays', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	const at = (value: string) => vi.setSystemTime(new Date(value))

	it("garde « aujourd'hui » toute la journée pour une date sans heure", () => {
		at('2026-11-04T09:00:00')
		expect(relativeDays('2026-11-04')).toBe("Aujourd'hui")
		at('2026-11-04T13:00:00')
		expect(relativeDays('2026-11-04')).toBe("Aujourd'hui")
		at('2026-11-04T23:59:00')
		expect(relativeDays('2026-11-04')).toBe("Aujourd'hui")
	})

	it('compte les jours du calendrier, pas les tranches de 24 h', () => {
		at('2026-11-04T00:30:00')
		expect(relativeDays('2026-11-03 23:30:00')).toBe('Hier')
		at('2026-11-04T23:30:00')
		expect(relativeDays('2026-11-03 00:30:00')).toBe('Hier')
		expect(relativeDays('2026-11-04 00:30:00')).toBe("Aujourd'hui")
	})

	it('affiche les durées plus longues', () => {
		at('2026-11-04T15:00:00')
		expect(relativeDays('2026-11-03')).toBe('Hier')
		expect(relativeDays('2026-11-02')).toBe('Il y a 2 j')
		expect(relativeDays('2026-10-06')).toBe('Il y a 29 j')
		expect(relativeDays('2026-10-05')).toBe('Il y a 1 mois')
		expect(relativeDays('2025-11-04')).toBe('Il y a 1 an(s)')
	})

	it('traite une date à venir comme aujourd\'hui, et une date absente', () => {
		at('2026-11-04T15:00:00')
		expect(relativeDays('2026-11-05')).toBe("Aujourd'hui")
		expect(relativeDays(null)).toBe('Jamais')
	})
})
