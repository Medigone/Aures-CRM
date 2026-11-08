import { describe, expect, it } from 'vitest'
import { groupError, groupPoses, surplusLabel, type GroupEntry, type GroupLine, type GroupResult } from './groupage'

const entry = (poses: number, designation = 'Étui'): GroupEntry => ({ etude: designation, designation, client_label: 'C', quantite: 1000, poses })

describe('groupage', () => {
	it('vérifie la saisie', () => {
		expect(groupError([entry(2)])).toBe('Ajoutez au moins un autre article.')
		expect(groupError([entry(2), entry(0, 'Boîte')])).toBe('Indiquez les poses de Boîte.')
		expect(groupError([entry(2), entry(1.5, 'Boîte')])).toBe('Indiquez les poses de Boîte.')
		expect(groupError([entry(2), entry(3), entry(1), entry(1), entry(1)])).toBe('4 articles au plus sur une feuille.')
		expect(groupError([entry(2), entry(3)])).toBe('')
	})
	it('dessine chaque pose avec la silhouette de son article', () => {
		const silhouette = (l: number) => ({ '0': { path_coupe: `M0 0L${l} 0`, path_rainage: null, l, d: 50 }, '90': { path_coupe: 'M0 0', path_rainage: null, l: 50, d: l } })
		const result = { membres: [{ silhouette: silhouette(100) }, { silhouette: silhouette(80) }], lisiere: 10, pince: 5 } as unknown as GroupResult
		const line = { poses: [[0, 0, 0, 0], [1, 120, 0, 180], [1, 0, 60, 90]] } as unknown as GroupLine
		const poses = groupPoses(result, line)
		expect(poses.map((pose) => pose.article)).toEqual([0, 1, 1])
		expect(poses[0].transform).toBe('translate(10 5)')
		expect(poses[1].transform).toBe('translate(130 5) rotate(180 40 25)')
		expect(poses[2].paths?.l).toBe(50)
	})
	it('montre seulement le surplus', () => {
		expect(surplusLabel(0)).toBe('—')
		expect(surplusLabel(5000)).toBe('+5 000')
	})
})
