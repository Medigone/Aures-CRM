<script setup lang="ts">
import { computed } from 'vue'
import LucideCircleCheck from '~icons/lucide/circle-check'
import LucideCircleDot from '~icons/lucide/circle-dot'
import LucideCircleMinus from '~icons/lucide/circle-minus'
import LucideCirclePause from '~icons/lucide/circle-pause'
import LucideCircleX from '~icons/lucide/circle-x'
import LucideLoader from '~icons/lucide/loader'
import LucideLock from '~icons/lucide/lock'

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
	// Maquettes, clichés et études
	'A référencer': 'tone-amber',
	Référencée: 'tone-blue',
	'Version Activée': 'tone-green',
	Détruite: 'tone-gray',
	'En étude': 'tone-amber',
	Réalisable: 'tone-green',
	'Non Réalisable': 'tone-red',
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
/** Icône de la densité Poste : l'état se lit aussi par sa forme, pas seulement par sa couleur. */
const TONE_ICONS: Record<string, unknown> = {
	'tone-blue': LucideCircleDot,
	'tone-amber': LucideLoader,
	'tone-green': LucideCircleCheck,
	'tone-red': LucideCircleX,
	'tone-gray': LucideCircleMinus,
	'tone-violet': LucideCirclePause,
}
const LABEL_ICONS: Record<string, unknown> = {
	'Blocage Créance': LucideLock,
	Dormant: LucideCirclePause,
	'En Pause': LucideCirclePause,
}
const icon = computed(() => LABEL_ICONS[label.value || ''] ?? TONE_ICONS[tone.value])
</script>

<template>
	<span v-if="status" class="badge gap-1.5" :class="tone">
		<span class="status-dot h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"></span>
		<component :is="icon" class="status-icon" aria-hidden="true" />
		{{ label }}
	</span>
</template>
