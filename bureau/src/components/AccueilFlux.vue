<script setup lang="ts">
import { computed, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import { partPill, ringSegments, stageComment, type AccueilStage } from '@/lib/accueil'

/** La barre du flux : un donut par étape, le total au centre. Au survol ou à l'appui, une part donne son nombre et son statut. */
const props = defineProps<{ stages: AccueilStage[]; staleDays: number }>()

const active = ref<{ stage: string; index: number } | null>(null)
const cells = computed(() =>
	props.stages.map((stage) => {
		const index = active.value?.stage === stage.key ? active.value.index : null
		const segments = ringSegments(stage.parts)
		return {
			stage,
			segments,
			index,
			hovered: index === null ? null : segments[index],
			comment: stageComment(stage, props.staleDays),
			aria: `${stage.label}, ${stage.total} au total : ${stage.parts.map((part) => `${partPill(part).label} ${part.count}`).join(', ') || 'aucun document'}`,
		}
	}),
)

function show(stage: string, index: number) {
	active.value = { stage, index }
}
function hide() {
	active.value = null
}
</script>

<template>
	<section class="card accueil-flux" aria-label="Où en sont les dossiers">
		<div v-for="cell in cells" :key="cell.stage.key" class="accueil-stage">
			<div class="accueil-stage-head">
				<RouterLink v-if="cell.stage.to" class="text-link font-semibold" :to="{ name: cell.stage.to }">{{ cell.stage.label }}</RouterLink>
				<a v-else class="text-link font-semibold" :href="cell.stage.href ?? undefined" target="_blank" rel="noopener noreferrer">{{ cell.stage.label }} ↗</a>
				<span v-if="cell.stage.third_party" class="badge tone-violet">Chez un tiers</span>
			</div>
			<div class="accueil-ring">
				<svg viewBox="0 0 84 84" role="img" :aria-label="cell.aria">
					<circle v-if="!cell.segments.length" class="accueil-ring-empty" cx="42" cy="42" r="34" />
					<circle
						v-for="(segment, index) in cell.segments"
						:key="segment.status"
						class="accueil-ring-part"
						cx="42"
						cy="42"
						r="34"
						tabindex="0"
						:aria-label="`${partPill(segment).label} : ${segment.count}`"
						:style="{ stroke: segment.color, strokeDasharray: segment.dash, strokeDashoffset: segment.offset, opacity: cell.index === null || cell.index === index ? 1 : 0.3 }"
						@mouseenter="show(cell.stage.key, index)"
						@mouseleave="hide"
						@focus="show(cell.stage.key, index)"
						@blur="hide"
						@click="show(cell.stage.key, index)"
					/>
				</svg>
				<span class="accueil-ring-total tabular-nums">{{ cell.hovered ? cell.hovered.count : cell.stage.total }}</span>
			</div>
			<!-- Hauteur réservée : le survol ne fait pas bouger la ligne. -->
			<div class="accueil-stage-foot">
				<StatusPill v-if="cell.hovered" :status="partPill(cell.hovered).label" :tone="partPill(cell.hovered).tone" />
				<p v-else>{{ cell.comment }}</p>
			</div>
		</div>
	</section>
</template>
