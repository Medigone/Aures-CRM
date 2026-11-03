import { describe, expect, it } from 'vitest'
import { evictionPlan, prefetchPlan } from '@/lib/contentCache'

const bat = (article: string, client: string, modified: string, image: string | null, fichier: string | null = null) => ({
	article,
	client,
	modified,
	image,
	fichier_valide: fichier,
})

describe('prefetchPlan', () => {
	const bats = [
		bat('A1', 'CL-1', '2026-10-01', '/files/a1-old.png'),
		bat('A1', 'CL-1', '2026-10-20', '/files/a1.png', '/private/files/a1.pdf'),
		bat('A2', 'CL-1', '2026-10-25', '/files/a2.png'),
		bat('B1', 'CL-2', '2026-10-30', '/files/b1.png'),
	]

	it('prend le dernier BAT de chaque article des clients de la semaine, le plus récent en premier', () => {
		expect(prefetchPlan(bats, new Set(['CL-1']))).toEqual(['/files/a2.png', '/files/a1.png', '/private/files/a1.pdf'])
	})

	it("s'arrête au nombre de fichiers", () => {
		expect(prefetchPlan(bats, new Set(['CL-1', 'CL-2']), 2)).toEqual(['/files/b1.png', '/files/a2.png'])
	})
})

describe('evictionPlan', () => {
	it('retire les plus anciens au-delà du plafond', () => {
		const index = { u1: { size: 50, at: 1 }, u2: { size: 50, at: 3 }, u3: { size: 50, at: 2 } }
		expect(evictionPlan(index, 100)).toEqual(['u1'])
		expect(evictionPlan(index, 1000)).toEqual([])
	})
})
