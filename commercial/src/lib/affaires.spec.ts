import { describe, expect, it } from 'vitest'
import { commandeEnCours, devisOuvert, fabricationProgress, ticketAlerte } from './affaires'

describe('fabricationProgress', () => {
	it('suit les quantités des ordres de production', () => {
		const p = fabricationProgress({
			dossier: { name: 'DOF-1', status: 'Planification validée' },
			etudes: [],
			ordres: [
				{ name: 'OP-1', status: 'Terminé', quantite_a_produire: 1000, quantite_produite: 1000 } as any,
				{ name: 'OP-2', status: 'En Production', quantite_a_produire: 1000, quantite_produite: 500 } as any,
				{ name: 'OP-3', status: 'Annulé', quantite_a_produire: 5000, quantite_produite: 0 } as any,
			],
		})
		expect(p).toEqual({ percent: 75, label: '1/2 ordre(s) de production terminé(s)' })
	})
	it('se rabat sur les études puis le dossier', () => {
		expect(fabricationProgress({ dossier: null, etudes: [{ name: 'ET', status: 'Terminé' } as any, { name: 'E2', status: 'En Cours' } as any], ordres: [] })?.label).toBe(
			'Études techniques : 1/2 terminée(s)',
		)
		expect(fabricationProgress({ dossier: { name: 'D', status: 'Ouvert' }, etudes: [], ordres: [] })?.label).toBe('Dossier de fabrication : Ouvert')
		expect(fabricationProgress(null)).toBeNull()
	})
})

describe('états', () => {
	it('distingue devis ouverts et commandes en cours', () => {
		expect(devisOuvert({ docstatus: 1, status: 'Open', statut_commande: 'Non commandé' } as any)).toBe(true)
		expect(devisOuvert({ docstatus: 1, status: 'Open', statut_commande: 'Entièrement commandé' } as any)).toBe(false)
		expect(commandeEnCours({ docstatus: 1, status: 'To Deliver and Bill' } as any)).toBe(true)
		expect(commandeEnCours({ docstatus: 1, status: 'Completed' } as any)).toBe(false)
	})
	it("signale les décisions d'urgence et les blocages", () => {
		expect(ticketAlerte({ docstatus: 0, status: 'En Cours', statut_demande_urgence: 'Validée', niveau_urgence: 'U1' } as any)).toBe('Urgence validée (U1)')
		expect(ticketAlerte({ docstatus: 0, status: 'Blocage Créance' } as any)).toBe('Bloqué : créance')
		expect(ticketAlerte({ docstatus: 0, status: 'Nouveau', statut_demande_urgence: 'Aucune' } as any)).toBeNull()
	})
})
