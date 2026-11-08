import { describe, expect, it } from 'vitest'
import { byCritere, defaultMaxFormat, stockComparison, type AtelierFormat, type Proposition } from './atelier'

const row = (values: Partial<Proposition>) => ({ libelle: 'A', origine: 'Sur mesure', laize: 950, depl: 520, nb_poses: 10, n_col: 5, n_rang: 2, rotation: 0, taux_chutes: 20.3, pas_laize: 0, pas_depl: 0, trait_commun_laize: 0, trait_commun_depl: 0, reste_laize: 0, reste_depl: 0, surface_par_pose: 0, nb_feuilles: 0, tonnage: 0, criteres: [], ...values }) as Proposition
const matiere = row({ criteres: ['matiere', 'cout'] })
const feuilles = row({ laize: 1020, depl: 600, nb_poses: 12, taux_chutes: 22.8, criteres: ['feuilles'] })
const stock = row({ origine: 'Format en stock', laize: 1020, depl: 720, nb_poses: 12, taux_chutes: 35.7, criteres: ['stock'] })
const fmt = (values: Partial<AtelierFormat>) => ({ laize: 0, depl: 0, origine: 'Stock', libelle: '', bobine: 0, coche: true, ...values }) as AtelierFormat

describe('format idéal', () => {
	it('met le critère choisi en tête, puis les autres', () => {
		expect(byCritere([matiere, feuilles, stock], 'feuilles').map((item) => [item.value, item.row])).toEqual([['feuilles', feuilles], ['matiere', matiere], ['stock', stock], ['cout', matiere]])
		expect(byCritere([matiere, stock], 'stock')[0].row).toBe(stock)
	})
	it("ne montre pas un critère qu'aucune feuille ne gagne", () => {
		expect(byCritere([feuilles, stock], 'cout').map((item) => item.value)).toEqual(['feuilles', 'stock'])
	})
	it('compare au meilleur format en stock', () => {
		expect(stockComparison(matiere, stock, 10000, 300)).toBe('Face au meilleur format en stock, 1020 × 720 : 15,4 points de chutes en moins, 36 kg de carton en moins, 166 feuilles en plus.')
		expect(stockComparison(stock, stock, 10000, 300)).toBe('')
		expect(stockComparison(matiere, undefined, 10000, 300)).toBe('')
	})
	it('part de la presse, sinon du plus grand format du support', () => {
		expect(defaultMaxFormat({ nom: 'K', laize: 800, depl: 1030 }, [])).toEqual({ laize: 800, depl: 1030 })
		expect(defaultMaxFormat(null, [fmt({ laize: 700, depl: 1000 }), fmt({ laize: 1400, depl: 0, bobine: 1 }), fmt({ laize: 1020, depl: 720 })])).toEqual({ laize: 1020, depl: 720 })
		expect(defaultMaxFormat(null, [])).toEqual({ laize: 1020, depl: 720 })
	})
})
