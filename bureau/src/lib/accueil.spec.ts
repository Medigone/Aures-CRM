import { describe, expect, it } from 'vitest'
import { chartMax, chartTicks, gapRoute, monthLong, monthShort, partColor, partPill, stageComment, waitLabel } from './accueil'
import { conditionsFromQuery } from './filters'

describe('couleurs des parts', () => {
	it('reprend la teinte de statut de chaque document', () => {
		expect(partPill({ status: 'Nouveau' })).toEqual({ label: 'Nouveau', tone: 'blue' })
		expect(partPill({ status: 'Draft' })).toEqual({ label: 'Brouillon', tone: 'gray' })
		expect(partPill({ status: 'To Deliver and Bill' })).toEqual({ label: 'À livrer et facturer', tone: 'blue' })
		expect(partPill({ status: 'Blocage Créance' }).tone).toBe('red')
	})

	it('affiche Pending en pause et en violet, comme sur le ticket', () => {
		expect(partPill({ status: 'Pending' })).toEqual({ label: 'En pause', tone: 'violet' })
	})

	it('met En Cours et En étude en orange, avec la nuance de marque', () => {
		expect(partColor({ status: 'En Cours' })).toBe('var(--tone-orange-bar)')
		expect(partColor({ status: 'En étude' })).toBe('var(--tone-orange-bar)')
		expect(partColor({ status: 'Nouveau' })).toBe('var(--tone-blue-ink)')
	})
})

describe("commentaire sous l'étape", () => {
	it('dit ce qui ne bouge plus', () => {
		expect(stageComment({ key: 'tickets', stale: 17, late: 0 }, 7)).toBe('17 sans mouvement depuis 7 j')
		expect(stageComment({ key: 'tickets', stale: 0, late: 0 }, 7)).toBe('Tout a bougé récemment')
	})

	it('parle de péremption pour un devis et de livraison pour une commande', () => {
		expect(stageComment({ key: 'devis', stale: 4, late: 2 }, 7)).toBe('2 périmés')
		expect(stageComment({ key: 'devis', stale: 4, late: 1 }, 7)).toBe('1 périmé')
		expect(stageComment({ key: 'commandes', stale: 4, late: 37 }, 7)).toBe('37 dates de livraison dépassées')
		expect(stageComment({ key: 'commandes', stale: 4, late: 1 }, 7)).toBe('1 date de livraison dépassée')
	})
})

describe('attente d\'une ligne', () => {
	const row = { status: 'En Cours', echeance: null, is_late: false, idle_days: 12 }

	it("préfère l'échéance", () => {
		expect(waitLabel({ ...row, echeance: '2026-11-08' })).toBe('échéance 08/11')
		expect(waitLabel({ ...row, echeance: '2026-04-09', is_late: true })).toBe('dépassée le 09/04')
	})

	it('adapte le mot au statut', () => {
		expect(waitLabel(row)).toBe('immobile depuis 12 j')
		expect(waitLabel({ ...row, status: 'Nouveau' })).toBe('attend depuis 12 j')
		expect(waitLabel({ ...row, status: 'Pending' })).toBe('en pause depuis 12 j')
	})
})

describe('axes', () => {
	it('arrondit le haut au multiple de 5', () => {
		expect(chartMax([3, 13, 2])).toBe(15)
		expect(chartMax([0, 0])).toBe(5)
		expect(chartMax([15])).toBe(15)
	})

	it('donne des graduations du haut vers le bas', () => {
		expect(chartTicks(15)).toEqual([15, 10, 5, 0])
	})

	it('nomme les mois', () => {
		expect(monthShort('2026-04')).toBe('avr.')
		expect(monthLong('2026-04')).toBe('Avr. 2026')
	})
})

describe('lien vers la liste filtrée', () => {
	it('emporte une vue', () => {
		expect(gapRoute('Articles', { view: 'sans_maquette' })).toEqual({ name: 'Articles', query: { vue: 'sans_maquette' } })
	})

	it('emporte des filtres que la liste sait relire', () => {
		const conditions = [{ doctype: 'Customer', field: 'custom_gps', op: 'is', value: 'not set' }]
		const route = gapRoute('Clients', { conditions })
		expect(conditionsFromQuery(route.query.filtres)).toEqual([{ id: 1, ...conditions[0] }])
	})

	it('ignore une adresse mal formée', () => {
		expect(conditionsFromQuery('pas du json')).toEqual([])
		expect(conditionsFromQuery(undefined)).toEqual([])
		expect(conditionsFromQuery('[["a"]]')).toEqual([])
	})
})
