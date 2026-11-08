import { describe, expect, it } from 'vitest'
import { sortVignettes, vignetteGap, vignetteOrigin, vignetteVerdict, type Scenario } from './atelier'

const sheet = (values: Partial<Scenario>) => ({ libelle: 'A', origine: 'Format étudié', laize: 720, depl: 600, nb_poses: 2, n_col: 2, n_rang: 1, rotation: 0, taux_chutes: 60.5, pas_laize: 0, pas_depl: 0, trait_commun_laize: 0, trait_commun_depl: 0, reste_laize: 0, reste_depl: 0, surface_par_pose: 0, nb_feuilles: 0, tonnage: 0, ...values }) as Scenario
const bobine = sheet({ origine: 'Bobine', laize: 1300, depl: 634.7, nb_poses: 6, n_col: 3, n_rang: 2, taux_chutes: 38 })
const grande = sheet({ laize: 1400, depl: 1000, nb_poses: 9, n_col: 3, n_rang: 3, taux_chutes: 45.2 })
const petite = sheet({})
const basis = { quantite: 10000, grammage: 300, prixTonne: 140000 }
const items = [petite, grande, bobine].map((row) => ({ row }))

describe('vignettes de l\'atelier', () => {
	it('trie par coût, chutes ou feuilles', () => {
		expect(sortVignettes(items, 'cout', basis).map((item) => item.row)).toEqual([bobine, grande, petite])
		expect(sortVignettes(items, 'chutes', basis).map((item) => item.row)).toEqual([bobine, grande, petite])
		expect(sortVignettes(items, 'feuilles', basis).map((item) => item.row)).toEqual([grande, bobine, petite])
	})
	it('trie au carton quand il n\'y a pas de prix', () => {
		expect(sortVignettes(items, 'cout', { ...basis, prixTonne: 0 }).map((item) => item.row)).toEqual([bobine, grande, petite])
	})
	it('écrit l\'écart avec la meilleure dans l\'unité du tri', () => {
		expect(vignetteGap(grande, bobine, 'chutes', basis)).toBe('+7,2 pts de chutes')
		expect(vignetteGap(petite, grande, 'feuilles', basis)).toBe('+3 888 feuilles')
		expect(vignetteGap(grande, bobine, 'cout', basis)).toMatch(/^\+7 6\d\d DA$/)
		expect(vignetteGap(grande, bobine, 'cout', { ...basis, prixTonne: 0 })).toBe('+13,2 % de carton')
		expect(vignetteGap(bobine, bobine, 'cout', basis)).toBe('')
	})
	it('dit d\'où vient la feuille', () => {
		expect(vignetteOrigin(bobine).label).toBe('Bobine')
		expect(vignetteOrigin(bobine, true).label).toBe('Coupe de bobine')
		expect(vignetteOrigin({ ...petite, cle: 'essai-1' }).label).toBe('Essai')
		expect(vignetteOrigin({ ...petite, cle: 'essai-2', criteres: ['matiere'] } as Scenario).label).toBe('Proposée')
		expect(vignetteOrigin(petite).label).toBe('Format étudié')
	})
	it('compare à la meilleure en une phrase', () => {
		expect(vignetteVerdict(bobine, bobine, 'cout', basis, true)).toBe('La meilleure au coût matière pour 10 000 ex.')
		expect(vignetteVerdict(grande, bobine, 'chutes', basis, true)).toMatch(/^Face à 1300 × 634,7 : \+7 6\d\d DA, \+7,2 pts de chutes\.$/)
	})
})
