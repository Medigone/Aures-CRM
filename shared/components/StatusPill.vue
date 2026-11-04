<script setup lang="ts">
import { computed } from 'vue'

/** Pastille de statut : la teinte suit le sens du statut (Desk Aures). */
const props = defineProps<{ status?: string | null; tone?: 'red' | 'amber' | 'green' | 'blue' | 'gray' | 'violet' }>()

const TONES: Record<string, string> = {
	// Clients
	Prospect: 'tone-blue',
	Actif: 'tone-green',
	Dormant: 'tone-amber',
	Perdu: 'tone-red',
	Exclu: 'tone-gray',
	// Visites, RDV, appels
	Nouveau: 'tone-blue',
	'En Cours': 'tone-amber',
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
	'En cours': 'tone-amber',
	Terminée: 'tone-green',
}
/** Statuts ERPNext (Devis, Commande) affichés en français. */
const LABELS: Record<string, string> = {
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
const label = computed(() => LABELS[props.status || ''] || props.status)
/** Teintes imposées, pour un libellé calculé (« Retard 18 j »). */
const FORCED_TONES = {
	red: 'tone-red',
	amber: 'tone-amber',
	green: 'tone-green',
	blue: 'tone-blue',
	gray: 'tone-gray',
	violet: 'tone-violet',
}
const tone = computed(() => (props.tone && FORCED_TONES[props.tone]) || TONES[label.value || ''] || 'tone-gray')
</script>

<template>
	<span v-if="status" class="badge gap-1.5" :class="tone">
		<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
		{{ label }}
	</span>
</template>
