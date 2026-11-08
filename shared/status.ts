/** Teinte et libellé d'un statut : la même règle dans la pastille, les graphiques et les deux applications. */

export const STATUS_TONES: Record<string, string> = {
	// Clients
	Prospect: 'tone-blue',
	Actif: 'tone-green',
	Dormant: 'tone-amber',
	Perdu: 'tone-red',
	Exclu: 'tone-gray',
	// Visites, RDV, appels
	Nouveau: 'tone-blue',
	'En Cours': 'tone-orange',
	Terminé: 'tone-green',
	Annulé: 'tone-gray',
	'En Attente': 'tone-blue',
	Confirmé: 'tone-green',
	Reporté: 'tone-amber',
	'Non Honoré': 'tone-red',
	'À Rappeler': 'tone-amber',
	// BAT
	'BAT-E Validé': 'tone-green',
	'BAT-P Validé': 'tone-green',
	Obsolète: 'tone-gray',
	'BAT en cours': 'tone-blue',
	// Maquettes, clichés et études
	'A référencer': 'tone-amber',
	Référencée: 'tone-blue',
	'Version Activée': 'tone-green',
	Détruite: 'tone-gray',
	'En étude': 'tone-orange',
	Réalisable: 'tone-green',
	'Non Réalisable': 'tone-red',
	// Tracés : la version en service et les anciennes
	'En service': 'tone-green',
	'A Réaliser': 'tone-blue',
	Réalisé: 'tone-green',
	Archivé: 'tone-gray',
	// Demandes de faisabilité
	Confirmée: 'tone-blue',
	'Partiellement Finalisée': 'tone-amber',
	Finalisée: 'tone-green',
	'Devis Établis': 'tone-blue',
	Fermée: 'tone-gray',
	// Tickets
	Pending: 'tone-amber',
	'Blocage Créance': 'tone-red',
	// Devis et commandes (libellés traduits)
	Brouillon: 'tone-gray',
	Ouvert: 'tone-blue',
	Commandé: 'tone-green',
	'Entièrement commandé': 'tone-green',
	'Partiellement commandé': 'tone-amber',
	'Non commandé': 'tone-blue',
	Expiré: 'tone-gray',
	'À livrer et facturer': 'tone-blue',
	'À livrer': 'tone-blue',
	'À facturer': 'tone-amber',
	Clôturé: 'tone-gray',
	// Réclamations et fabrication
	'En Traitement': 'tone-amber',
	Traité: 'tone-green',
	'Non Traité': 'tone-red',
	'En retard': 'tone-red',
	Planifié: 'tone-blue',
	'En Production': 'tone-amber',
	'En Pause': 'tone-amber',
	Annulée: 'tone-gray',
	// Créances
	Ouverte: 'tone-blue',
	'Partiellement recouvrée': 'tone-amber',
	Soldée: 'tone-green',
	Litige: 'tone-red',
	Suspendue: 'tone-gray',
	// Actions de pilotage
	'En cours': 'tone-orange',
	Terminée: 'tone-green',
}

/** Statuts ERPNext (Devis, Commande) affichés en français. */
const STATUS_LABELS: Record<string, string> = {
	Draft: 'Brouillon',
	Open: 'Ouvert',
	Replied: 'Répondu',
	Ordered: 'Commandé',
	'Partially Ordered': 'Partiellement commandé',
	Lost: 'Perdu',
	Expired: 'Expiré',
	Cancelled: 'Annulé',
	'On Hold': 'En attente',
	'To Deliver and Bill': 'À livrer et facturer',
	'To Bill': 'À facturer',
	'To Deliver': 'À livrer',
	Completed: 'Terminé',
	Closed: 'Clôturé',
}

/** Le libellé affiché : un statut ERPNext passe en français, les autres restent tels quels. */
export function statusDisplay(status?: string | null) {
	return STATUS_LABELS[status || ''] || status || ''
}

export function statusTone(label?: string | null) {
	return STATUS_TONES[label || ''] || 'tone-gray'
}
