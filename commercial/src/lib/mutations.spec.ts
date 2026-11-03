import { describe, expect, it } from 'vitest'
import { applyMutation, keyFrom, localKey, refTo, retryDelayMs, type Mutation } from './mutations'
import type { Bundle } from '@/types'

const user = { name: 'karim@aures.dz', full_name: 'Karim' }
function bundle(): Bundle {
	return {
		server_time: '',
		user: { ...user, image: null, roles: [], exempt: false },
		references: { wilayas: [], communes: [], types_visite: [], statuts_client: [], types_appel: [], statuts_rdv: [] },
		clients: [{ name: 'CL-1', customer_name: 'SOUMMAM', lat: null, lon: null } as any],
		contacts: [],
		articles: [],
		visites: [],
		rdv: [],
		appels: [],
		creances: [],
		tickets: [],
		devis: [],
		commandes: [],
		reclamations: [],
		bats: [],
		synced_at: '',
	}
}
const m = (id: string, type: Mutation['type'], payload: Record<string, any>): Mutation => ({
	id,
	type,
	payload,
	target: '',
	created_at: '2026-11-03 09:00:00',
	attempts: 0,
	next_at: null,
})

describe('références', () => {
	it('vise un document serveur par son nom, un document local par son action de création', () => {
		expect(refTo('visite', 'VC-11-26-0001')).toEqual({ visite: 'VC-11-26-0001' })
		expect(refTo('visite', localKey('abc'))).toEqual({ visite_ref: 'abc' })
		expect(keyFrom({ visite_ref: 'abc' }, 'visite')).toBe('local:abc')
		expect(keyFrom({ client: 'CL-1' }, 'client')).toBe('CL-1')
	})
})

describe('applyMutation', () => {
	it('crée, démarre puis termine une visite locale', () => {
		let view = applyMutation(bundle(), m('a', 'visite_create', { client: 'CL-1', type_visite: 'Suivi Client', date: '2026-11-03' }), user)
		expect(view.visites[0]).toMatchObject({ name: 'local:a', status: 'Nouveau', nom_client: 'SOUMMAM', _pending: true })
		view = applyMutation(view, m('b', 'visite_start', { visite_ref: 'a', debut: '2026-11-03 09:10:00', gps: '36.7, 3.0' }), user)
		expect(view.visites[0]).toMatchObject({ status: 'En Cours', debut: '2026-11-03 09:10:00', gps_visite: '36.7, 3.0' })
		view = applyMutation(view, m('c', 'visite_finish', { visite_ref: 'a', fin: '2026-11-03 09:55:00', notes: '<p>ok</p>' }), user)
		expect(view.visites[0]).toMatchObject({ status: 'Terminé', docstatus: 1, duree: '45', notes: '<p>ok</p>' })
	})

	it("n'altère pas le bundle d'origine", () => {
		const original = bundle()
		applyMutation(original, m('a', 'visite_create', { client: 'CL-1', type_visite: 'Prospection' }), user)
		expect(original.visites).toHaveLength(0)
	})

	it('retire une visite annulée', () => {
		const view = applyMutation(bundle(), m('a', 'visite_create', { client: 'CL-1', type_visite: 'Prospection' }), user)
		expect(applyMutation(view, m('b', 'visite_cancel', { visite_ref: 'a' }), user).visites).toHaveLength(0)
	})

	it('ajoute un prospect et met à jour la position d’un client', () => {
		let view = applyMutation(bundle(), m('p', 'prospect_create', { customer_name: 'Biopharm', gps: '36.7, 3.1' }), user)
		expect(view.clients[0]).toMatchObject({ name: 'local:p', customer_name: 'BIOPHARM', statut: 'Prospect', lat: 36.7, lon: 3.1 })
		view = applyMutation(view, m('g', 'client_update_gps', { client: 'CL-1', gps: '35.5, 6.1' }), user)
		expect(view.clients.find((c) => c.name === 'CL-1')).toMatchObject({ lat: 35.5, lon: 6.1 })
	})

	it('suit un rendez-vous et un appel', () => {
		let view = applyMutation(bundle(), m('r', 'rdv_create', { client: 'CL-1', date_heure: '2026-11-04 10:00:00' }), user)
		view = applyMutation(view, m('r2', 'rdv_update', { rdv_ref: 'r', status: 'Confirmé' }), user)
		expect(view.rdv[0]).toMatchObject({ status: 'Confirmé', raison_sociale: 'SOUMMAM' })
		view = applyMutation(view, m('t', 'appel_create', { client: 'CL-1', status: 'À Rappeler', heure: '2026-11-03 11:00:00' }), user)
		expect(view.appels[0]).toMatchObject({ status: 'À Rappeler', date: '2026-11-03' })
	})
})

describe('retryDelayMs', () => {
	it('double le délai jusqu’à 30 min', () => {
		expect(retryDelayMs(1)).toBe(15000)
		expect(retryDelayMs(2)).toBe(30000)
		expect(retryDelayMs(20)).toBe(30 * 60 * 1000)
	})
})

describe('tickets', () => {
	it('crée un ticket local avec le niveau d’urgence imposé, puis suit la demande d’urgence', async () => {
		const { defaultUrgence } = await import('./mutations')
		let view = applyMutation(
			bundle(),
			m('t', 'ticket_create', { client: 'CL-1', request_type: 'Bon de commande', site: 'Offset', description: '<p>Retirage</p>', attachments: [{ filename: 'a.jpg', data: 'data:image/jpeg;base64,AA' }] }),
			user,
		)
		expect(view.tickets[0]).toMatchObject({
			name: 'local:t',
			status: 'Nouveau',
			customer_name: 'SOUMMAM',
			niveau_urgence: 'U2',
			statut_creance: 'Non vérifiée',
			pieces_locales: 1,
		})
		view = applyMutation(view, m('u', 'ticket_urgence_request', { ticket_ref: 't', niveau: 'U1', motif: 'Rupture client' }), user)
		expect(view.tickets[0]).toMatchObject({ statut_demande_urgence: 'En attente', niveau_urgence_demande: 'U1' })
		view = applyMutation(view, m('c', 'ticket_urgence_cancel', { ticket_ref: 't' }), user)
		expect(view.tickets[0]).toMatchObject({ statut_demande_urgence: 'Aucune', niveau_urgence: 'U2', niveau_urgence_demande: null })
		expect(defaultUrgence('Essai Blanc')).toBe('U3')
		expect(defaultUrgence('Réclamation')).toBe('U0')
	})
})
