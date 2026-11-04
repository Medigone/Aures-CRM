import { describe, expect, it } from 'vitest'
import { commandeDelai, commandeEnRetard, devisValidite, ecartJours, reclamationEcheance, suiviFiltres, suiviGroupes, suiviResume, suiviTuiles, type SuiviData } from './suivi'

const today = '2026-11-04'
const empty: SuiviData = { tickets: [], devis: [], commandes: [], reclamations: [] }
const ticket = (over: object) => ({ name: 'TC-1', docstatus: 0, status: 'En Cours', client: 'C1', customer_name: 'Laiterie', request_type: 'Bon de commande', creation_date: today, ...over }) as any
const commande = (over: object) => ({ name: 'SAL-ORD-2026-00001', docstatus: 1, status: 'To Deliver and Bill', client: 'C1', customer_name: 'Laiterie', per_delivered: 0, delivery_date: '2026-10-30', lignes: [], fabrication: null, ...over }) as any
const devis = (over: object) => ({ name: 'SAL-QTN-2026-00001', docstatus: 1, status: 'Open', statut_commande: 'Non commandé', client: 'C1', customer_name: 'Laiterie', grand_total: 100, currency: 'DZD', valid_till: '2026-12-31', lignes: [], ...over }) as any
const reclamation = (over: object) => ({ name: 'abc123', docstatus: 0, status: 'Nouveau', client: 'C1', nom_client: 'Laiterie', type_reclamation: 'Qualité', procede: 'Offset', date_echeance: null, date_resolution: null, ...over }) as any

describe('ecartJours', () => {
	it('compte positif dans le passé, négatif à venir', () => {
		expect(ecartJours('2026-11-01', today)).toBe(3)
		expect(ecartJours('2026-11-09 10:00:00', today)).toBe(-5)
		expect(ecartJours(null, today)).toBeNull()
	})
})

describe('commandes', () => {
	it('affiche le délai de livraison à la place du statut', () => {
		expect(commandeDelai(commande({}), today)).toEqual({ status: 'Retard 5 j', tone: 'red' })
		expect(commandeDelai(commande({ delivery_date: '2026-11-09' }), today)).toEqual({ status: 'Dans 5 j', tone: 'blue' })
		expect(commandeDelai(commande({ delivery_date: today }), today)).toEqual({ status: "Aujourd'hui", tone: 'amber' })
	})
	it('garde le statut quand le délai ne compte plus', () => {
		expect(commandeDelai(commande({ status: 'Completed' }), today)).toEqual({ status: 'Completed' })
		expect(commandeDelai(commande({ status: 'To Bill', per_delivered: 100 }), today)).toEqual({ status: 'To Bill' })
		expect(commandeDelai(commande({ delivery_date: null }), today)).toEqual({ status: 'To Deliver and Bill' })
	})
	it("une commande livrée n'est pas en retard", () => {
		expect(commandeEnRetard(commande({}), today)).toBe(true)
		expect(commandeEnRetard(commande({ per_delivered: 100 }), today)).toBe(false)
	})
	it('classe les plus en retard en tête', () => {
		const data = { ...empty, commandes: [commande({ name: 'B', delivery_date: '2026-11-01' }), commande({ name: 'N', delivery_date: null }), commande({ name: 'A', delivery_date: '2026-10-01' })] }
		expect(suiviGroupes(data, 'commandes', 'ouvert', '', { today })[0].rows.map((r) => r.key)).toEqual(['A', 'B', 'N'])
	})
})

describe('devis', () => {
	it('signale la validité', () => {
		expect(devisValidite(devis({ valid_till: '2026-11-07' }), today)).toMatchObject({ text: 'Expire dans 3 j', tone: 'amber', alert: true })
		expect(devisValidite(devis({}), today)).toMatchObject({ text: 'Valable 57 j', tone: 'muted' })
		expect(devisValidite(devis({ status: 'Expired', valid_till: '2026-10-29' }), today)?.text).toBe('Expiré depuis 6 j, à relancer')
		expect(devisValidite(devis({ status: 'Ordered', statut_commande: 'Entièrement commandé' }), today)).toBeNull()
	})
})

describe('réclamations', () => {
	it("donne l'échéance en jours", () => {
		expect(reclamationEcheance(reclamation({ status: 'En retard', date_echeance: '2026-10-23' }), today)).toMatchObject({ text: 'Échéance dépassée de 12 j', tone: 'red' })
		expect(reclamationEcheance(reclamation({ date_echeance: '2026-11-06' }), today)).toMatchObject({ text: 'Échéance dans 2 j', tone: 'muted' })
		expect(reclamationEcheance(reclamation({ status: 'En retard' }), today)?.text).toBe('Échéance dépassée')
	})
	it("n'affiche pas l'identifiant technique", () => {
		const [row] = suiviGroupes({ ...empty, reclamations: [reclamation({})] }, 'reclamations', 'ouvert', '', { today })[0].rows
		expect(`${row.title} ${row.sub}`).not.toContain('abc123')
	})
})

describe('tickets', () => {
	const data = {
		...empty,
		tickets: [
			ticket({ name: 'NORMAL', customer_name: 'Café' }),
			ticket({ name: 'VALIDE', statut_demande_urgence: 'Validée', niveau_urgence: 'U2' }),
			ticket({ name: 'REFUS', statut_demande_urgence: 'Refusée' }),
			ticket({ name: 'BLOQUE', status: 'Blocage Créance' }),
			ticket({ name: 'FINI', status: 'Terminé', docstatus: 1 }),
		],
	}
	it('met ce qui est à traiter en tête, blocages d\'abord', () => {
		const groups = suiviGroupes(data, 'tickets', 'ouvert', '', { today })
		expect(groups.map((g) => g.title)).toEqual(["À traiter d'abord", 'Le reste'])
		expect(groups[0].rows.map((r) => r.key)).toEqual(['BLOQUE', 'REFUS', 'VALIDE'])
		expect(groups[1].rows.map((r) => r.key)).toEqual(['NORMAL'])
	})
	it('ne groupe pas sans ticket à traiter', () => {
		const groups = suiviGroupes({ ...empty, tickets: [ticket({})] }, 'tickets', 'ouvert', '', { today })
		expect(groups).toHaveLength(1)
		expect(groups[0].title).toBeNull()
	})
	it('titre par le client, sauf dans la fiche client', () => {
		const one = { ...empty, tickets: [ticket({})] }
		expect(suiviGroupes(one, 'tickets', 'ouvert', '', { today })[0].rows[0]).toMatchObject({ title: 'Laiterie', sub: "Bon de commande · aujourd'hui" })
		expect(suiviGroupes(one, 'tickets', 'ouvert', '', { today, client: 'C1' })[0].rows[0]).toMatchObject({ title: 'Bon de commande', sub: "aujourd'hui" })
	})
	it('compte les filtres et les tuiles', () => {
		expect(Object.fromEntries(suiviFiltres(data, 'tickets', today).map((f) => [f.key, f.count]))).toEqual({ ouvert: 4, prio: 3, cours: 3, nouveau: 0, fini: 1, tout: 5 })
		expect(suiviTuiles(data)[0]).toEqual({ key: 'tickets', label: 'Tickets', count: 4, alertes: 3 })
	})
	it('cherche sans tenir compte des accents ni de la casse', () => {
		expect(suiviGroupes(data, 'tickets', 'ouvert', 'CAFE', { today })[0].rows.map((r) => r.key)).toEqual(['NORMAL'])
		expect(suiviGroupes(data, 'tickets', 'ouvert', 'inconnu', { today })).toEqual([])
	})
})

describe('suiviResume', () => {
	it('résume ce qui est à traiter', () => {
		expect(suiviResume(empty)).toBe('Rien à traiter en priorité')
		expect(suiviResume({ ...empty, tickets: [ticket({ status: 'Blocage Créance' })] })).toBe('1 ticket à traiter')
		expect(suiviResume({ ...empty, tickets: [ticket({ status: 'Blocage Créance' }), ticket({ status: 'Blocage Créance' })], reclamations: [reclamation({ status: 'En retard' })] })).toBe('2 tickets et 1 réclamation à traiter')
	})
})
