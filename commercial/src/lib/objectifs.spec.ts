import { describe, expect, it } from 'vitest'
import { formatMetric, progressOf, visitsDoneSince } from './objectifs'

describe('objectifs', () => {
	it('formate selon l’unité', () => {
		expect(formatMetric(42.4, 'percent')).toBe('42 %')
		expect(formatMetric(12, 'count')).toBe('12')
		expect(formatMetric(null, 'count')).toBe('—')
	})
	it('calcule la progression', () => {
		expect(progressOf({ target_value: 40, achieved_value: 10, achievement_pct: null })).toBe(25)
		expect(progressOf({ target_value: 40, achieved_value: 60, achievement_pct: 150 })).toBe(100)
		expect(progressOf({ target_value: 0, achieved_value: 3, achievement_pct: 0 })).toBe(0)
	})
	it('compte les visites terminées de la période', () => {
		const v = (date: string, status: string) => ({ date, status }) as any
		expect(visitsDoneSince([v('2026-11-02', 'Terminé'), v('2026-10-30', 'Terminé'), v('2026-11-03', 'En Cours')], '2026-11-01')).toBe(1)
	})
})
