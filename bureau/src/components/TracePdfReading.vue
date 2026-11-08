<script setup lang="ts">
import { computed } from 'vue'
import { dimensionsLabel } from '@/lib/etudePieces'
import { analysisWarnings, type TraceAnalysis } from '@/lib/traces'

/** Ce que le PDF dit du tracé, sous le fichier choisi : les cotations reprises, le développé, ce qui est à vérifier. */
const props = defineProps<{ analysis: TraceAnalysis | null; analyzing: boolean; applied: boolean; previous: string | null }>()
const emit = defineEmits<{ restore: []; apply: [] }>()
const warnings = computed(() => (props.analysis ? analysisWarnings(props.analysis) : []))
const mm = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
</script>

<template>
	<p v-if="analyzing" class="m-0 text-sm text-ink-gray-6" role="status">Lecture du PDF…</p>
	<section v-else-if="analysis" class="trace-reading" aria-label="Lu dans le PDF">
		<template v-if="analysis.lisible">
			<p class="m-0 text-sm font-semibold text-ink-gray-9">Lu dans le PDF</p>
			<dl class="trace-reading-facts">
				<div v-if="analysis.designation"><dt>Désignation</dt><dd>{{ analysis.designation }}</dd></div>
				<div v-if="analysis.cotations">
					<dt>Cotations</dt>
					<dd class="tabular-nums">{{ dimensionsLabel(analysis.cotations) }}<span v-if="analysis.confirmees" class="ml-1.5 text-xs font-normal text-ink-gray-6">retrouvées dans les cotes du dessin</span></dd>
				</div>
				<div v-if="analysis.developpe"><dt>Développé</dt><dd class="tabular-nums">{{ mm(analysis.developpe[0]) }} × {{ mm(analysis.developpe[1]) }} mm</dd></div>
				<div v-if="analysis.reference"><dt>Référence ArtiosCAD</dt><dd class="tabular-nums">{{ analysis.reference }}</dd></div>
			</dl>
			<p v-if="analysis.cotations && applied" class="m-0 text-sm text-ink-gray-7">
				Dimensions reprises du PDF.
				<button v-if="previous" type="button" class="text-link" @click="emit('restore')">Remettre {{ dimensionsLabel(previous) }}</button>
			</p>
			<p v-else-if="analysis.cotations" class="m-0 text-sm text-ink-gray-7">
				<button type="button" class="text-link" @click="emit('apply')">Reprendre {{ dimensionsLabel(analysis.cotations) }} dans les dimensions</button>
			</p>
		</template>
		<ul v-if="warnings.length" class="m-0 flex list-none flex-col gap-1 rounded-control tone-amber px-3 py-2 text-sm">
			<li v-for="line in warnings" :key="line">{{ line }}</li>
		</ul>
	</section>
</template>
