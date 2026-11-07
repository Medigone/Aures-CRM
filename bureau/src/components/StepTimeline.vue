<script setup lang="ts">
import { useId } from 'vue'
import LucideCheck from '~icons/lucide/check'
import LucideInfo from '~icons/lucide/info'
import type { Step } from '@/types'

/** `focus` : l'étape qui porte la consigne `tip`, en infobulle au survol ou au clavier. `showBack` : on regarde une autre étape que celle en cours. */
withDefaults(defineProps<{ steps: Step[]; viewed: number; current: number | null; focus: number; tip: string; showBack?: boolean; label?: string }>(), { label: 'Étapes du ticket' })
const emit = defineEmits<{ pick: [index: number]; back: [] }>()
const tipId = `step-tip-${useId()}`
</script>

<template>
	<section :aria-label="label" class="card px-2 py-3">
		<div class="mx-1.5 mb-1.5 flex items-baseline justify-between gap-2">
			<h3 class="text-base font-semibold">Étapes</h3>
			<button v-if="showBack" type="button" class="text-sm text-link" @click="emit('back')">Revenir à l'étape en cours</button>
			<span v-else class="text-sm tabular-nums text-ink-gray-6">{{ focus + 1 }} sur {{ steps.length }}</span>
		</div>
		<ol class="m-0 flex list-none flex-col p-0">
			<li v-for="(step, index) in steps" :key="`${step.key}-${index}`" class="step-item" :data-state="step.state">
				<button type="button" class="step-button" :aria-pressed="index === viewed" :aria-current="index === current ? 'step' : undefined" :aria-describedby="index === focus && tip ? tipId : undefined" @click="emit('pick', index)">
					<span class="step-dot">
						<LucideCheck v-if="step.state === 'done'" class="h-3 w-3" aria-label="Terminée" />
						<template v-else-if="step.state === 'blocked'">!</template>
						<template v-else>{{ index + 1 }}</template>
					</span>
					<span class="min-w-0">
						<span class="step-label">{{ step.label }}</span>
						<span v-if="step.detail || (index === focus && tip)" class="step-detail">{{ step.detail }}<LucideInfo v-if="index === focus && tip" class="step-info" aria-hidden="true" /></span>
					</span>
				</button>
				<span v-if="index === focus && tip" :id="tipId" class="step-tip" role="tooltip">{{ tip }}</span>
			</li>
		</ol>
	</section>
</template>
