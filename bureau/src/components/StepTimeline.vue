<script setup lang="ts">
import LucideCheck from '~icons/lucide/check'
import type { Step } from '@/types'

defineProps<{ steps: Step[]; viewed: number; current: number | null }>()
const emit = defineEmits<{ pick: [index: number] }>()
</script>

<template>
	<section aria-label="Étapes du ticket" class="card px-2 py-3">
		<h3 class="mx-1.5 mb-1.5 text-base font-semibold">Étapes</h3>
		<ol class="m-0 flex list-none flex-col p-0">
			<li v-for="(step, index) in steps" :key="`${step.key}-${index}`" class="step-item" :data-state="step.state">
				<button type="button" class="step-button" :aria-pressed="index === viewed" :aria-current="index === current ? 'step' : undefined" @click="emit('pick', index)">
					<span class="step-dot">
						<LucideCheck v-if="step.state === 'done'" class="h-3 w-3" aria-label="Terminée" />
						<template v-else-if="step.state === 'blocked'">!</template>
						<template v-else>{{ index + 1 }}</template>
					</span>
					<span class="min-w-0">
						<span class="step-label">{{ step.label }}</span>
						<span v-if="step.detail" class="step-detail">{{ step.detail }}</span>
					</span>
				</button>
			</li>
		</ol>
	</section>
</template>
