import { describe, expect, it } from 'vitest'
import { deskUrl, echeanceLabel, fileExtension, formatDay, initials, missingChecklist, statusLabel, stepHelp, ticketActions, urgenceNote } from './display'

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
		const ticket = { request_type: 'Essai Blanc', status: 'En Cours', checklist: [] }
		expect(stepHelp('doc', ticket)).toContain('dossier essai à blanc')
		expect(stepHelp('fin', ticket)).toBe('Terminez le ticket une fois la demande traitée.')
		expect(stepHelp('fin', { ...ticket, status: 'Terminé' })).toBe('Ce ticket est clos.')
	})

	it('présente les actions permises par le serveur, dans un ordre stable', () => {
		const checklist = [{ label: 'Devis', checked: false }]
		const actions = ticketActions({ actions: ['Terminer', 'Pause'], checklist })
		expect(actions.map((item) => item.label)).toEqual(['Mettre en pause', 'Terminer'])
		expect(actions[1].disabled).toBe(true)
		expect(ticketActions({ actions: ['Terminer'], checklist: [{ label: 'Devis', checked: true }] })[0].disabled).toBe(false)
		expect(ticketActions({ actions: ['Inconnue'], checklist: [] })).toEqual([])
	})

	it('explique ce qui manque pour terminer', () => {
		const checklist = [
			{ label: 'Devis', checked: false },
			{ label: 'Photo', checked: false },
		]
		expect(missingChecklist({ actions: ['Terminer'], checklist })).toBe('Pour terminer, cochez : Devis, Photo.')
		expect(missingChecklist({ actions: ['Pause'], checklist })).toBe('')
	})

	it('compare le niveau accordé au niveau demandé', () => {
		expect(urgenceNote('U2', 'U2')).toBe('Demandé')
		expect(urgenceNote('U1', 'U2')).toBe('Inférieur')
		expect(urgenceNote('U3', 'U2')).toBe('Supérieur')
	})
})
