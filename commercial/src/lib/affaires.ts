/** Règles d'affichage des affaires (tickets, devis, commandes, réclamations, fabrication). */
import type { Commande, Devis, Fabrication, Reclamation, Ticket } from '@/types'

export const ticketOuvert = (t: Ticket) => t.docstatus === 0
export const devisOuvert = (d: Devis) =>
	d.docstatus === 1 && !['Lost', 'Expired', 'Cancelled', 'Ordered'].includes(d.status) && d.statut_commande !== 'Entièrement commandé'
export const commandeEnCours = (c: Commande) => c.docstatus === 1 && !['Completed', 'Closed', 'Cancelled'].includes(c.status)
export const reclamationOuverte = (r: Reclamation) => r.docstatus === 0

/** Ticket qui demande l'attention du commercial (décision d'urgence, blocage créance). */
export function ticketAlerte(t: Ticket): string | null {
	if (t.status === 'Blocage Créance') return 'Bloqué : créance'
	if (t.docstatus !== 0) return null
	if (t.statut_demande_urgence === 'Refusée') return 'Urgence refusée'
	if (t.statut_demande_urgence === 'Validée') return `Urgence validée (${t.niveau_urgence})`
	return null
}

/** Avancement de fabrication d'une commande : quantités produites / à produire des ordres de production. */
export function fabricationProgress(f: Fabrication | null | undefined): { percent: number; label: string } | null {
	if (!f) return null
	const ordres = f.ordres.filter((o) => o.status !== 'Annulé')
	if (ordres.length) {
		const target = ordres.reduce((n, o) => n + (o.quantite_a_produire || 0), 0)
		const done = ordres.reduce((n, o) => n + Math.min(o.quantite_produite || 0, o.quantite_a_produire || Infinity), 0)
		const finished = ordres.filter((o) => o.status === 'Terminé').length
		const percent = target ? Math.round((done / target) * 100) : Math.round((finished / ordres.length) * 100)
		return { percent: Math.min(100, percent), label: `${finished}/${ordres.length} ordre(s) de production terminé(s)` }
	}
	if (f.etudes.length) {
		const done = f.etudes.filter((e) => e.status === 'Terminé').length
		return { percent: 0, label: `Études techniques : ${done}/${f.etudes.length} terminée(s)` }
	}
	if (f.dossier) return { percent: 0, label: `Dossier de fabrication : ${f.dossier.status}` }
	return null
}
