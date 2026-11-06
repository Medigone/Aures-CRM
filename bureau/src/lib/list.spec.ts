import { describe, expect, it } from 'vitest'
import { bulkSummary, canPause, canStart, COLUMNS, creanceText, DEFAULT_COLUMNS, gridTemplate, isOpen, minListWidth, nextSort, SORTABLE_COLUMNS, sortText, stepPercent, stepText, ticketsToCsv, visibleColumns } from './list'
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
	comments: 0,
	...extra,
})

describe('liste des tickets', () => {
	it("ne propose ni l'étape ni les commentaires au tri", () => {
		const keys = SORTABLE_COLUMNS.map((column) => column.key)
		expect(keys).not.toContain('step')
		expect(keys).not.toContain('comments')
		expect(sortText(null)).toBe('Tri : urgence, puis échéance')
		expect(sortText({ key: 'client', dir: 'asc' })).toBe('Tri : client')
	})

	it('garde toujours le client et ignore une colonne inconnue', () => {
		expect(visibleColumns(['ancienne', 'status']).map((column) => column.key)).toEqual(['client', 'status'])
		expect(DEFAULT_COLUMNS).not.toContain('commercial')
		expect(DEFAULT_COLUMNS).toContain('comments')
	})

	it('calcule la grille et la largeur minimale des colonnes affichées', () => {
		const columns = visibleColumns(['status'])
		expect(gridTemplate(columns)).toBe('minmax(140px, 1.5fr) 132px')
		expect(minListWidth(columns)).toBe(32 + 30 + 30 + 2 + 140 + 132 + 8)
	})

	it('exporte un CSV lisible par Excel, sans formule exécutable', () => {
		const columns = COLUMNS.filter((column) => ['client', 'comments'].includes(column.key))
		const csv = ticketsToCsv([row('=SOMME(A1)', { comments: 2 }), row('A;B')], columns)
		expect(csv.startsWith('\ufeffClient;Comm.')).toBe(true)
		expect(csv).toContain("'=SOMME(A1);2")
		expect(csv).toContain('"A;B";0')
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
