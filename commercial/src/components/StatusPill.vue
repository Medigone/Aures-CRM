<script setup lang="ts">
import { computed } from 'vue'

/** Pastille de statut : la teinte suit le sens du statut (Desk Aures). */
const props = defineProps<{ status?: string | null }>()

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
const tone = computed(() => TONES[label.value || ''] || 'bg-surface-gray-2 text-ink-gray-7')
</script>

<template>
	<span v-if="status" class="badge" :class="tone">{{ label }}</span>
</template>
