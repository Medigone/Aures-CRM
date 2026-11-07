<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideChevronRight from '~icons/lucide/chevron-right'
import StatusPill from '@shared/components/StatusPill.vue'
import { partColor, partPill, stageComment, type AccueilStage } from '@/lib/accueil'

/** La barre du flux : une barre de statuts par étape, le total à droite. Au survol ou à l'appui, une part donne son nombre et son statut. */
const props = withDefaults(defineProps<{ stages: AccueilStage[]; staleDays: number; chained?: boolean }>(), { chained: true })

const active = ref<{ stage: string; index: number } | null>(null)
const cells = computed(() =>
	props.stages.map((stage, position) => {
		const index = active.value?.stage === stage.key ? active.value.index : null
		return {
			stage,
			index,
			hovered: index === null ? null : stage.parts[index],
			comment: stageComment(stage, props.staleDays),
			hasNext: props.chained && position < props.stages.length - 1,
			aria: `${stage.label}, ${stage.total} au total`,
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
	<section class="card accueil-flux" :class="!chained && 'accueil-flux-free'" aria-label="Où en sont les dossiers">
		<div v-for="cell in cells" :key="cell.stage.key" class="accueil-stage">
			<div class="accueil-stage-head">
				<RouterLink v-if="cell.stage.to" class="text-link font-semibold" :to="{ name: cell.stage.to }">{{ cell.stage.label }}</RouterLink>
				<a v-else class="text-link font-semibold" :href="cell.stage.href ?? undefined" target="_blank" rel="noopener noreferrer">{{ cell.stage.label }} ↗</a>
				<span v-if="cell.stage.third_party" class="badge tone-violet">Chez un tiers</span>
				<span class="accueil-stage-total tabular-nums">{{ cell.hovered ? cell.hovered.count : cell.stage.total }}</span>
			</div>
			<div class="accueil-strip" role="group" :aria-label="cell.aria">
				<span v-if="!cell.stage.parts.length" class="accueil-strip-empty"></span>
				<button
					v-for="(part, index) in cell.stage.parts"
					:key="part.status"
					type="button"
					class="accueil-strip-part"
					:aria-label="`${partPill(part).label} : ${part.count}`"
					:style="{ flexGrow: part.count, '--part': partColor(part), opacity: cell.index === null || cell.index === index ? 1 : 0.3 }"
					@mouseenter="show(cell.stage.key, index)"
					@mouseleave="hide"
					@focus="show(cell.stage.key, index)"
					@blur="hide"
					@click="show(cell.stage.key, index)"
				></button>
			</div>
			<!-- Hauteur réservée : le survol ne fait pas bouger la ligne. -->
			<div class="accueil-stage-foot" :class="!cell.hovered && cell.stage.late > 0 && 'is-late'">
				<StatusPill v-if="cell.hovered" :status="partPill(cell.hovered).label" :tone="partPill(cell.hovered).tone" />
				<p v-else>{{ cell.comment }}</p>
				<!-- Barres indépendantes, assez larges : chaque statut reste lisible sans survol. -->
				<ul v-if="!chained" class="accueil-stage-legend">
					<li v-for="part in cell.stage.parts" :key="part.status" class="tabular-nums"><i :style="{ background: partColor(part) }" aria-hidden="true"></i>{{ partPill(part).label }} <b>{{ part.count }}</b></li>
				</ul>
			</div>
			<span v-if="cell.hasNext" class="accueil-stage-next" aria-hidden="true"><LucideChevronRight class="h-3.5 w-3.5" /></span>
		</div>
	</section>
</template>
