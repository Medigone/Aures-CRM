<script setup lang="ts">
import LucideMic from '~icons/lucide/mic'
import LucideMicOff from '~icons/lucide/mic-off'
import { useDictation } from '@/lib/dictation'

/** Zone de notes avec dictée vocale (Chrome Android, en ligne). */
const model = defineModel<string>({ required: true })
defineProps<{ label?: string; placeholder?: string }>()
const dictation = useDictation((text) => {
	if (!text) return
	model.value = model.value ? `${model.value.trimEnd()} ${text}` : text
})
</script>

<template>
	<div>
		<div class="mb-1 flex items-center justify-between">
			<span class="field-label mb-0">{{ label || 'Notes' }}</span>
			<button
				v-if="dictation.supported"
				type="button"
				class="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm"
				:class="dictation.listening.value ? 'bg-surface-red-2 text-ink-red-3' : 'text-accent'"
				@click="dictation.toggle"
			>
				<LucideMicOff v-if="dictation.listening.value" class="h-4 w-4" aria-hidden="true" />
				<LucideMic v-else class="h-4 w-4" aria-hidden="true" />
				{{ dictation.listening.value ? 'Arrêter' : 'Dicter' }}
			</button>
		</div>
		<textarea v-model="model" rows="5" class="field-input" :placeholder="placeholder" />
		<p v-if="dictation.error.value" class="mt-1 text-xs text-ink-red-3">{{ dictation.error.value }}</p>
	</div>
</template>
