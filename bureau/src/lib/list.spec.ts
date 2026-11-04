import { describe, expect, it } from 'vitest'
import { bulkSummary, canPause, canStart, creanceText, isOpen, nextSort, sortTickets, stepPercent, stepText } from './list'
import type { QueueTicket } from '@/types'

const row = (name: string, extra: Partial<QueueTicket> = {}): QueueTicket => ({
	name,
	modified: '2026-11-04 10:00:00',
	client: name,
	commercial: null,
	request_type: 'Bon de commande',
	status: 'En Cours',
	statut_creance: null,
	step: { label: 'Créance vérifiée', current: 2, done: 2, total: 6 },
	echeance: null,
	is_late: false,
	niveau_urgence: 'U0',
	urgence_en_attente: false,
	niveau_urgence_demande: null,
	assigne_a: null,
	assigne_a_nom: null,
	mine: false,
	...extra,
})

describe('liste des tickets', () => {
	it("garde l'ordre du serveur sans tri choisi", () => {
		const tickets = [row('B'), row('A')]
		expect(sortTickets(tickets, null)).toBe(tickets)
	})

	it('trie sans modifier la liste reçue', () => {
		const tickets = [row('B'), row('A')]
		expect(sortTickets(tickets, { key: 'client', dir: 'asc' }).map((t) => t.name)).toEqual(['A', 'B'])
		expect(sortTickets(tickets, { key: 'client', dir: 'desc' }).map((t) => t.name)).toEqual(['B', 'A'])
		expect(tickets[0].name).toBe('B')
	})

	it("compte une urgence en attente et range les tickets sans échéance à la fin", () => {
		const attente = row('attente', { niveau_urgence: 'U0', urgence_en_attente: true, niveau_urgence_demande: 'U3' })
		expect(sortTickets([attente, row('u1', { niveau_urgence: 'U1' })], { key: 'urgence', dir: 'desc' })[0].name).toBe('attente')
		expect(sortTickets([row('sans'), row('avec', { echeance: '2026-11-05' })], { key: 'echeance', dir: 'asc' })[0].name).toBe('avec')
	})

	it('passe par croissant, décroissant, puis ordre du serveur', () => {
		const asc = nextSort(null, 'client')
		const desc = nextSort(asc, 'client')
		expect(asc).toEqual({ key: 'client', dir: 'asc' })
		expect(desc).toEqual({ key: 'client', dir: 'desc' })
		expect(nextSort(desc, 'client')).toBeNull()
		expect(nextSort(desc, 'type')).toEqual({ key: 'type', dir: 'asc' })
	})

	it("résume l'étape et la créance", () => {
		expect(stepText(row('A'))).toBe('3/6 Créance vérifiée')
		expect(stepText(row('A', { step: { label: 'Terminé', current: null, done: 6, total: 6 } }))).toBe('Terminé')
		expect(stepPercent(row('A'))).toBe(33)
		expect(creanceText(row('A'))).toBe('Non vérifiée')
		expect(creanceText(row('A', { request_type: 'Réclamation', statut_creance: 'OK' }))).toBe('—')
	})

	it('dit quels tickets une action concerne', () => {
		expect(isOpen(row('A', { status: 'Terminé' }))).toBe(false)
		expect(isOpen(row('A', { status: 'Blocage Créance' }))).toBe(true)
		expect(canStart(row('A', { status: 'Nouveau' }))).toBe(true)
		expect(canPause(row('A', { status: 'Nouveau' }))).toBe(false)
	})

	it('résume une action groupée', () => {
		const skipped = { name: 'TC-3', reason: 'Ticket clos.' }
		expect(bulkSummary({ done: ['TC-1'], skipped: [] }, 'ticket démarré', 'tickets démarrés')).toBe('1 ticket démarré')
		expect(bulkSummary({ done: ['TC-1', 'TC-2'], skipped: [skipped] }, 'ticket démarré', 'tickets démarrés')).toBe('2 tickets démarrés · 1 non traité')
		expect(bulkSummary({ done: [], skipped: [skipped, skipped] }, 'ticket démarré', 'tickets démarrés')).toBe('2 non traités')
	})
})
