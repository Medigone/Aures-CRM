import { describe, expect, it } from 'vitest'
import { areaFor, byCritere, defaultMaxFormat, plainComparison, refenteSummary, tonnageFor, type Proposition } from './atelier'

const row = (values: Partial<Proposition>) => ({ libelle: 'A', origine: 'Bobine refendue', laize: 645, depl: 520, nb_poses: 6, n_col: 3, n_rang: 2, rotation: 0, taux_chutes: 30, pas_laize: 0, pas_depl: 0, trait_commun_laize: 0, trait_commun_depl: 0, reste_laize: 0, reste_depl: 0, surface_par_pose: 0, nb_feuilles: 0, tonnage: 0, criteres: [], ...values }) as Proposition
const refendue = row({ laize_achat: 650, criteres: ['matiere', 'cout'] })
const feuilles = row({ origine: 'Palette', laize: 1000, depl: 700, nb_poses: 10, taux_chutes: 43.8, criteres: ['feuilles'] })
const palette = row({ origine: 'Palette', laize: 720, depl: 520, nb_poses: 6, taux_chutes: 36.9, criteres: ['sans_refente'] })

describe('format idéal', () => {
	it('met le critère choisi en tête, puis les autres', () => {
		expect(byCritere([refendue, feuilles, palette], 'feuilles').map((item) => [item.value, item.row])).toEqual([['feuilles', feuilles], ['matiere', refendue], ['sans_refente', palette], ['cout', refendue]])
		expect(byCritere([refendue, palette], 'sans_refente')[0].row).toBe(palette)
	})
	it("ne montre pas un critère qu'aucune feuille ne gagne", () => {
		expect(byCritere([feuilles, palette], 'cout').map((item) => item.value)).toEqual(['feuilles', 'sans_refente'])
	})
	it('compte la matière sur la laize achetée, rives de refente comprises', () => {
		expect(tonnageFor(refendue, 6000, 300)).toBeCloseTo((1000 * 650 * 520 * 300) / 1e12, 6)
		expect(areaFor(refendue, 6000)).toBeCloseTo((1000 * 650 * 520) / 1e6, 6)
		expect(areaFor(palette, 6000)).toBeCloseTo((1000 * 720 * 520) / 1e6, 6)
	})
	it('compare à la meilleure feuille sans refente', () => {
		expect(plainComparison(refendue, palette, 6000, 300)).toBe('Face à la meilleure feuille sans refente, 720 × 520 : 6,9 points de chutes en moins, 11 kg de carton en moins.')
		expect(plainComparison(palette, palette, 6000, 300)).toBe('')
		expect(plainComparison(refendue, undefined, 6000, 300)).toBe('')
	})
	it('prend le format maxi de la presse, sinon rien', () => {
		expect(defaultMaxFormat({ nom: 'K', laize: 800, depl: 1030 })).toEqual({ laize: 800, depl: 1030 })
		expect(defaultMaxFormat(null)).toBeNull()
	})
	it('résume la refente', () => {
		expect(refenteSummary({})).toBe('non réglée')
		expect(refenteSummary({ refente_bandes_max: 1 })).toBe('non réglée')
		expect(refenteSummary({ refente_bandes_max: 4, refente_rive: 5, refente_laize_min: 300 })).toBe("jusqu'à 4 bandes, rive 5 mm, bande de 300 mm au moins")
	})
})
