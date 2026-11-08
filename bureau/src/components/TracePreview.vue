<script setup lang="ts">
import { ref, watch } from 'vue'
import { getTracePreview } from '@/lib/api'
import type { TracePreview } from '@/lib/traces'

/** Aperçu du PDF d'un tracé : sa première page en image, recadrée sur le dessin ; un clic ouvre le PDF complet. */
const props = defineProps<{ name: string; url: string; label: string }>()

const preview = ref<TracePreview | null>(null)
const state = ref<'loading' | 'ready' | 'failed'>('loading')
let request = 0
watch(
	() => [props.name, props.url],
	async () => {
		const current = ++request
		state.value = 'loading'
		preview.value = null
		try {
			const result = await getTracePreview(props.name)
			if (current !== request) return
			preview.value = result
			state.value = result ? 'ready' : 'failed'
		} catch {
			if (current === request) state.value = 'failed'
		}
	},
	{ immediate: true },
)
</script>

<template>
	<div class="trace-preview-box">
		<a v-if="state === 'ready' && preview" class="block" :href="url" target="_blank" rel="noopener noreferrer" :title="`Ouvrir le PDF ${label}`">
			<img class="trace-preview" :src="preview.image" :alt="`Aperçu du tracé ${label}`" :width="preview.width" :height="preview.height" />
		</a>
		<p v-else-if="state === 'loading'" class="trace-preview-state">Préparation de l'aperçu…</p>
		<p v-else class="trace-preview-state">L'aperçu n'a pas pu être préparé. <a class="ref-link" :href="url" target="_blank" rel="noopener noreferrer">Ouvrir le PDF</a></p>
		<p v-if="state === 'ready' && preview && preview.pages > 1" class="m-0 text-xs text-ink-gray-6">Première page sur {{ preview.pages }}.</p>
	</div>
</template>
