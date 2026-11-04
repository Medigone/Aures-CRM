import { describe, expect, it } from 'vitest'
import { dureeVisite, ticketsDeVisite, visiteContexte, visitesFiltres, visitesGroupes, visitesResume } from './visites'
import { initiales } from './text'

const today = '2026-11-04'
const visite = (over: object) => ({ name: 'V1', status: 'Nouveau', docstatus: 0, date: today, client: 'C1', nom_client: 'Laiterie', type_visite: 'Négociation', debut: null, fin: null, duree: null, notes: null, ...over }) as any

describe('dureeVisite', () => {
	it('formate le champ serveur en minutes', () => {
		expect(dureeVisite({ duree: '45', debut: null, fin: null })).toBe('45 min')
		expect(dureeVisite({ duree: '70', debut: null, fin: null })).toBe('1 h 10')
		expect(dureeVisite({ duree: '0', debut: null, fin: null })).toBe("moins d'1 min")
	})
	it('se rabat sur le début et la fin', () => {
		expect(dureeVisite({ duree: null, debut: '2026-11-04 09:40:00', fin: '2026-11-04 10:25:00' })).toBe('45 min')
		expect(dureeVisite({ duree: null, debut: null, fin: null })).toBeNull()
	})
})

describe('visitesGroupes', () => {
	const visites = [
		visite({ name: 'PLUS_TARD', date: '2026-11-09' }),
		visite({ name: 'DEMAIN', date: '2026-11-05' }),
		visite({ name: 'JOUR' }),
		visite({ name: 'RETARD', date: '2026-10-30' }),
		visite({ name: 'EN_COURS', status: 'En Cours', debut: '2026-11-04 09:40:00' }),
		visite({ name: 'OUBLIEE', status: 'En Cours', date: '2026-10-28', debut: '2026-10-28 09:00:00' }),
		visite({ name: 'FINIE', status: 'Terminé', docstatus: 1, date: '2026-11-03', duree: '45', notes: '<p>Reçu par les achats.</p>' }),
		visite({ name: 'OCT', status: 'Terminé', docstatus: 1, date: '2026-10-20' }),
		visite({ name: 'SEPT', status: 'Terminé', docstatus: 1, date: '2026-09-02', type_visite: 'Recouvrement', resultat_recouvrement: 'Paiement obtenu', montant_encaisse: 250000 }),
	]

	it('ordonne le travail à faire', () => {
		const groups = visitesGroupes(visites, 'afaire', '', { today })
		expect(groups.map((g) => g.title)).toEqual(['En cours', 'À replanifier', "Aujourd'hui", 'Demain', 'lun. 9 nov.'])
		expect(groups[0].rows.map((r) => r.key)).toEqual(['EN_COURS', 'OUBLIEE'])
	})
	it("signale les visites oubliées et à replanifier", () => {
		const groups = visitesGroupes(visites, 'retard', '', { today })
		expect(groups[0].rows[0]).toMatchObject({ key: 'OUBLIEE', tone: 'red' })
		expect(groups[0].rows[0].note?.text).toContain('à terminer')
		expect(groups[1].rows[0]).toMatchObject({ key: 'RETARD', tone: 'amber' })
	})
	it("classe l'historique par semaine puis par mois récents d'abord", () => {
		const groups = visitesGroupes(visites, 'terminees', '', { today })
		expect(groups.map((g) => g.title)).toEqual(['Cette semaine', 'Octobre 2026', 'Septembre 2026'])
	})
	it('résume une visite terminée', () => {
		const groups = visitesGroupes(visites, 'terminees', '', { today })
		expect(groups[0].rows[0]).toMatchObject({ sub: 'Négociation · mar. 3 nov. · 45 min', note: { text: 'Reçu par les achats.', tone: 'muted' } })
		expect(groups[1].rows[0].note).toEqual({ text: 'Sans compte rendu', tone: 'amber' })
		expect(groups[2].rows[0].note?.text).toBe('Paiement obtenu')
		expect(groups[2].rows[0].amount).toContain('250')
	})
	it('cherche sans tenir compte des accents', () => {
		expect(visitesGroupes(visites, 'toutes', 'NEGOCIATION', { today }).length).toBeGreaterThan(0)
		expect(visitesGroupes(visites, 'toutes', 'inconnu', { today })).toEqual([])
		const lieu = () => 'Sétif'
		expect(visitesGroupes(visites, 'afaire', 'setif', { today, lieu })[0].rows[0].sub).toContain('Sétif')
	})
	it('compte les filtres et résume la page', () => {
		expect(Object.fromEntries(visitesFiltres(visites, today).map((f) => [f.key, f.count]))).toEqual({ afaire: 6, retard: 2, terminees: 3, toutes: 9 })
		expect(visitesResume(visites, today)).toBe("2 en cours, 1 aujourd'hui, 1 à replanifier")
		expect(visitesResume([], today)).toBe("Rien de prévu aujourd'hui")
	})
})

describe('contexte du client', () => {
	it('rassemble ce qui concerne le seul client de la visite', () => {
		const ctx = visiteContexte(
			{ name: 'V1', client: 'C1' },
			{
				visites: [visite({ name: 'V0', status: 'Terminé', date: '2026-10-12' }), visite({ name: 'V2', status: 'Terminé', date: '2026-09-01' }), visite({ name: 'AUTRE', client: 'C2', status: 'Terminé', date: '2026-11-01' })],
				tickets: [{ client: 'C1', docstatus: 0 }, { client: 'C1', docstatus: 1 }, { client: 'C2', docstatus: 0 }] as any,
				commandes: [{ client: 'C1', docstatus: 1, status: 'To Deliver', per_delivered: 0, delivery_date: '2026-10-01' }, { client: 'C1', docstatus: 1, status: 'To Deliver', per_delivered: 0, delivery_date: '2026-12-01' }] as any,
				reclamations: [{ client: 'C1', docstatus: 0 }] as any,
				creances: [{ client: 'C1', solde_restant: 100 }, { client: 'C1', solde_restant: 50 }, { client: 'C2', solde_restant: 999 }] as any,
			},
			today,
		)
		expect(ctx).toMatchObject({ tickets: 1, commandes: 2, commandesEnRetard: 1, reclamations: 1, solde: 150 })
		expect(ctx.derniereVisite?.name).toBe('V0')
	})
	it('retrouve les tickets qui citent la visite', () => {
		const tickets = [{ name: 'T1', description: "<p>Visite d'origine : VIS-1</p>" }, { name: 'T2', description: null }] as any
		expect(ticketsDeVisite(tickets, 'VIS-1').map((t) => t.name)).toEqual(['T1'])
	})
})

describe('initiales', () => {
	it('prend les deux premiers mots', () => {
		expect(initiales('Yacine Belkacem')).toBe('YB')
		expect(initiales('Yacine')).toBe('Y')
		expect(initiales(null)).toBe('?')
	})
})
