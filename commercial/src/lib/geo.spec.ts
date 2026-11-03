import { describe, expect, it } from 'vitest'
import { distanceM, formatDistance, pickNearby, pointOf, sortByDistance } from './geo'

const hydra = { latitude: 36.7417, longitude: 3.0283 }

describe('distanceM', () => {
	it('vaut zéro sur place', () => {
		expect(distanceM(hydra, hydra)).toBe(0)
	})

	it('donne environ 111 km par degré de latitude', () => {
		const north = { latitude: hydra.latitude + 1, longitude: hydra.longitude }
		expect(Math.round(distanceM(hydra, north) / 1000)).toBe(111)
	})
})

describe('formatDistance', () => {
	it('arrondit les mètres à 50 m', () => {
		expect(formatDistance(12)).toBe('50 m')
		expect(formatDistance(312)).toBe('300 m')
		expect(formatDistance(980)).toBe('1,0 km')
	})

	it('écrit les kilomètres à la française', () => {
		expect(formatDistance(2440)).toBe('2,4 km')
		expect(formatDistance(12600)).toBe('13 km')
	})
})

describe('pointOf', () => {
	it('garde les coordonnées nulles à zéro', () => {
		expect(pointOf(0, 0)).toEqual({ latitude: 0, longitude: 0 })
		expect(pointOf(null, 3)).toBeNull()
	})
})

describe('sortByDistance', () => {
	const rows = [
		{ id: 'sans-position-1', at: null },
		{ id: 'loin', at: { latitude: hydra.latitude + 0.05, longitude: hydra.longitude } },
		{ id: 'sans-position-2', at: null },
		{ id: 'proche', at: { latitude: hydra.latitude + 0.001, longitude: hydra.longitude } },
	]

	it('met les plus proches en tête et les lignes sans position à la fin, dans leur ordre', () => {
		expect(sortByDistance(rows, hydra, (r) => r.at).map((r) => r.id)).toEqual(['proche', 'loin', 'sans-position-1', 'sans-position-2'])
	})

	it("garde l'ordre sans position de l'appareil", () => {
		expect(sortByDistance(rows, null, (r) => r.at)).toBe(rows)
	})
})

describe('pickNearby', () => {
	const now = new Date('2026-10-16T10:00:00').getTime()
	const daysAgo = (days: number) => new Date(now - days * 86400000)
	// ~0,001° de latitude ≈ 111 m
	const rows = [
		{ id: 'loin', at: { latitude: hydra.latitude + 0.05, longitude: hydra.longitude }, seen: null },
		{ id: 'vu-recemment', at: { latitude: hydra.latitude + 0.002, longitude: hydra.longitude }, seen: daysAgo(10) },
		{ id: 'oublie', at: { latitude: hydra.latitude + 0.006, longitude: hydra.longitude }, seen: daysAgo(71) },
		{ id: 'jamais-vu', at: { latitude: hydra.latitude + 0.003, longitude: hydra.longitude }, seen: null },
		{ id: 'sans-position', at: null, seen: null },
	]

	it('garde les proches non vus depuis 60 jours, du plus proche au plus loin', () => {
		const found = pickNearby(rows, hydra, (r) => r.at, (r) => r.seen, { now })
		expect(found.map((f) => f.row.id)).toEqual(['jamais-vu', 'oublie'])
		expect(Math.round(found[0].meters / 10)).toBe(33)
	})
})

describe('parseGps', () => {
	it('lit le texte « lat, lon » du Desk', async () => {
		const { parseGps } = await import('./geo')
		expect(parseGps('36.7538, 3.0588')).toEqual({ latitude: 36.7538, longitude: 3.0588 })
		expect(parseGps('36.7538,3.0588')).toEqual({ latitude: 36.7538, longitude: 3.0588 })
	})
	it('refuse un texte illisible ou hors bornes', async () => {
		const { parseGps } = await import('./geo')
		expect(parseGps('')).toBeNull()
		expect(parseGps('Alger')).toBeNull()
		expect(parseGps('120, 3')).toBeNull()
	})
})
