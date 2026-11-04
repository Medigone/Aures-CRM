<script setup lang="ts">
import { computed } from 'vue'

/** Pastille de statut : la teinte suit le sens du statut (Desk Aures). */
const props = defineProps<{ status?: string | null; tone?: 'red' | 'amber' | 'green' | 'blue' | 'gray' }>()

const TONES: Record<string, string> = {
	// Clients
	Prospect: 'bg-surface-blue-2 text-ink-blue-3',
	Actif: 'bg-surface-green-2 text-ink-green-3',
	Dormant: 'bg-surface-amber-2 text-ink-amber-3',
	Perdu: 'bg-surface-red-2 text-ink-red-3',
	Exclu: 'bg-surface-gray-3 text-ink-gray-7',
	// Visites, RDV, appels
	Nouveau: 'bg-surface-blue-2 text-ink-blue-3',
	'En Cours': 'bg-surface-amber-2 text-ink-amber-3',
	Terminé: 'bg-surface-green-2 text-ink-green-3',
	Annulé: 'bg-surface-gray-3 text-ink-gray-7',
	'En Attente': 'bg-surface-blue-2 text-ink-blue-3',
	Confirmé: 'bg-surface-green-2 text-ink-green-3',
	Reporté: 'bg-surface-amber-2 text-ink-amber-3',
	'Non Honoré': 'bg-surface-red-2 text-ink-red-3',
	'À Rappeler': 'bg-surface-amber-2 text-ink-amber-3',
	// BAT
	'BAT-E Validé': 'bg-surface-green-2 text-ink-green-3',
	'BAT-P Validé': 'bg-surface-green-2 text-ink-green-3',
	Obsolète: 'bg-surface-gray-3 text-ink-gray-7',
	'BAT en cours': 'bg-surface-blue-2 text-ink-blue-3',
	// Tickets
	Pending: 'bg-surface-amber-2 text-ink-amber-3',
	'Blocage Créance': 'bg-surface-red-2 text-ink-red-3',
	// Devis et commandes (libellés traduits)
	Brouillon: 'bg-surface-gray-2 text-ink-gray-7',
	Ouvert: 'bg-surface-blue-2 text-ink-blue-3',
	Commandé: 'bg-surface-green-2 text-ink-green-3',
	'Entièrement commandé': 'bg-surface-green-2 text-ink-green-3',
	'Partiellement commandé': 'bg-surface-amber-2 text-ink-amber-3',
	'Non commandé': 'bg-surface-blue-2 text-ink-blue-3',
	Expiré: 'bg-surface-gray-3 text-ink-gray-7',
	'À livrer et facturer': 'bg-surface-blue-2 text-ink-blue-3',
	'À livrer': 'bg-surface-blue-2 text-ink-blue-3',
	'À facturer': 'bg-surface-amber-2 text-ink-amber-3',
	Clôturé: 'bg-surface-gray-3 text-ink-gray-7',
	// Réclamations et fabrication
	'En Traitement': 'bg-surface-amber-2 text-ink-amber-3',
	Traité: 'bg-surface-green-2 text-ink-green-3',
	'Non Traité': 'bg-surface-red-2 text-ink-red-3',
	'En retard': 'bg-surface-red-2 text-ink-red-3',
	Planifié: 'bg-surface-blue-2 text-ink-blue-3',
	'En Production': 'bg-surface-amber-2 text-ink-amber-3',
	'En Pause': 'bg-surface-amber-2 text-ink-amber-3',
	Annulée: 'bg-surface-gray-3 text-ink-gray-7',
	// Créances
	Ouverte: 'bg-surface-blue-2 text-ink-blue-3',
	'Partiellement recouvrée': 'bg-surface-amber-2 text-ink-amber-3',
	Soldée: 'bg-surface-green-2 text-ink-green-3',
	Litige: 'bg-surface-red-2 text-ink-red-3',
	Suspendue: 'bg-surface-gray-3 text-ink-gray-7',
	// Actions de pilotage
	'En cours': 'bg-surface-amber-2 text-ink-amber-3',
	Terminée: 'bg-surface-green-2 text-ink-green-3',
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
	red: 'bg-surface-red-2 text-ink-red-3',
	amber: 'bg-surface-amber-2 text-ink-amber-3',
	green: 'bg-surface-green-2 text-ink-green-3',
	blue: 'bg-surface-blue-2 text-ink-blue-3',
	gray: 'bg-surface-gray-3 text-ink-gray-7',
}
const tone = computed(() => (props.tone && FORCED_TONES[props.tone]) || TONES[label.value || ''] || 'bg-surface-gray-2 text-ink-gray-7')
</script>

<template>
	<span v-if="status" class="badge gap-1.5" :class="tone">
		<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
		{{ label }}
	</span>
</template>
