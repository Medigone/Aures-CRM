<script setup lang="ts">
import { computed } from 'vue'
import { statusDisplay, statusTone } from '../status'
import LucideCircleCheck from '~icons/lucide/circle-check'
import LucideCircleDot from '~icons/lucide/circle-dot'
import LucideCircleMinus from '~icons/lucide/circle-minus'
import LucideCirclePause from '~icons/lucide/circle-pause'
import LucideCircleX from '~icons/lucide/circle-x'
import LucideLoader from '~icons/lucide/loader'
import LucideLock from '~icons/lucide/lock'

/** Pastille de statut : la teinte suit le sens du statut (Desk Aures). */
const props = defineProps<{ status?: string | null; tone?: 'red' | 'amber' | 'orange' | 'green' | 'blue' | 'gray' | 'violet' }>()

const label = computed(() => statusDisplay(props.status))
/** Teintes imposées, pour un libellé calculé (« Retard 18 j »). */
const FORCED_TONES = {
	red: 'tone-red',
	amber: 'tone-amber',
	orange: 'tone-orange',
	green: 'tone-green',
	blue: 'tone-blue',
	gray: 'tone-gray',
	violet: 'tone-violet',
}
const tone = computed(() => (props.tone && FORCED_TONES[props.tone]) || statusTone(label.value))
/** Icône de la densité Poste : l'état se lit aussi par sa forme, pas seulement par sa couleur. */
const TONE_ICONS: Record<string, unknown> = {
	'tone-blue': LucideCircleDot,
	'tone-amber': LucideLoader,
	'tone-orange': LucideLoader,
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
