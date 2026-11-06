import { describe, expect, it } from 'vitest'
import { deskUrl, echeanceLabel, fileExtension, formatDay, initials, missingPieces, piecesProgress, statusLabel, stepHelp, ticketActions, urgenceNote } from './display'

describe('affichage', () => {
	it('affiche Pending en français', () => {
		expect(statusLabel('Pending')).toBe('En pause')
		expect(statusLabel('En Cours')).toBe('En Cours')
	})

	it('formate dates et échéances', () => {
		expect(formatDay('2026-11-05')).toBe('05/11/2026')
		expect(formatDay('2026-11-05 10:12:00')).toBe('05/11/2026')
		expect(echeanceLabel({ echeance: null, is_late: false })).toBe('Sans échéance')
		expect(echeanceLabel({ echeance: '2026-11-05', is_late: false })).toBe('05/11')
		expect(echeanceLabel({ echeance: '2026-11-03', is_late: true })).toBe('Retard 03/11')
	})

	it('construit les liens du Desk', () => {
		expect(deskUrl('Sales Order', 'CMD/1')).toBe('/app/sales-order/CMD%2F1')
		expect(deskUrl('Ticket Commercial', 'TC-1')).toBe('/app/ticket-commercial/TC-1')
	})

	it('résume fichiers et noms', () => {
		expect(fileExtension('bon-commande.pdf')).toBe('PDF')
		expect(fileExtension('sans-extension')).toBe('FIC')
		expect(initials('Amine Melizi Test')).toBe('AM')
		expect(initials('')).toBe('?')
	})

	it('adapte la consigne au ticket', () => {
		const ticket = { request_type: 'Essai Blanc', status: 'En Cours', pieces: [] }
		expect(stepHelp('doc', ticket)).toContain('dossier essai à blanc')
		expect(stepHelp('fin', ticket)).toBe('Terminez le ticket une fois la demande traitée.')
		expect(stepHelp('fin', { ...ticket, status: 'Terminé' })).toBe('Ce ticket est clos.')
		expect(stepHelp('fin', { ...ticket, pieces: [{ required: true, state: 'missing' }] })).toContain('Réunissez')
		expect(stepHelp('fin', { ...ticket, pieces: [{ required: true, state: 'wait' }] })).toBe('Toutes les pièces sont réunies : vous pouvez terminer le ticket.')
	})

	it('présente les actions permises par le serveur, dans un ordre stable', () => {
		const pieces = [{ label: 'Devis', required: true, state: 'missing' }]
		const actions = ticketActions({ actions: ['Terminer', 'Pause'], pieces })
		expect(actions.map((item) => item.label)).toEqual(['Mettre en pause', 'Terminer'])
		expect(actions[1].disabled).toBe(true)
		expect(ticketActions({ actions: ['Terminer'], pieces: [{ label: 'Devis', required: true, state: 'wait' }] })[0].disabled).toBe(false)
		expect(ticketActions({ actions: ['Terminer'], pieces: [{ label: 'Commande', required: false, state: 'missing' }] })[0].disabled).toBe(false)
		expect(ticketActions({ actions: ['Inconnue'], pieces: [] })).toEqual([])
	})

	it('explique ce qui manque pour terminer', () => {
		const pieces = [
			{ label: 'Devis', required: true, state: 'missing' },
			{ label: 'Photo', required: true, state: 'missing' },
			{ label: 'Demande', required: true, state: 'skip' },
		]
		expect(missingPieces({ actions: ['Terminer'], pieces })).toBe('Pour terminer, il manque : Devis, Photo.')
		expect(missingPieces({ actions: ['Pause'], pieces })).toBe('')
		expect(piecesProgress({ pieces })).toEqual({ total: 3, done: 1 })
	})

	it('compare le niveau accordé au niveau demandé', () => {
		expect(urgenceNote('U2', 'U2')).toBe('Demandé')
		expect(urgenceNote('U1', 'U2')).toBe('Inférieur')
		expect(urgenceNote('U3', 'U2')).toBe('Supérieur')
	})
})
