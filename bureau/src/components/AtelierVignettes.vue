<script setup lang="ts">
import { computed } from 'vue'
import AtelierMiniature from './AtelierMiniature.vue'
import { costLabel, gridLabel, materialCost, percentLabel, sheetLabel, sheetsFor, sheetsLabel, VIGNETTE_SORTS, vignetteGap, vignetteOrigin, vignetteSortLabel, type Scenario, type SilhouetteVue, type VignetteSort } from '@/lib/atelier'
import { formatQuantity } from '@/lib/etudes'

export interface Vignette {
	key: string
	row: Scenario
	/** Coupe de bobine que le moteur n'a pas retenue : elle devient un essai quand on la montre. */
	coupe: boolean
}

/** Les feuilles candidates, triées, en vignettes dessinées : on compare en regardant. La dernière ajoute une feuille. */
const props = defineProps<{ items: Vignette[]; sort: VignetteSort; quantity: number; quantities: number[]; principale: number; tierTag: string; currentKey: string | null; retainedKey: string | null; withCost: boolean; grammage: number; prixTonne: number; silhouette: Record<string, SilhouetteVue> | null; lisiere: number; pince: number; stale: boolean; canAdd: boolean; adding: boolean }>()
const emit = defineEmits<{ show: [item: Vignette]; quantity: [value: number]; sort: [key: VignetteSort]; add: [] }>()

const basis = computed(() => ({ quantite: props.quantity, grammage: props.grammage, prixTonne: props.prixTonne }))
const best = computed(() => props.items[0]?.row ?? null)
const cost = (row: Scenario) => materialCost(row, props.quantity, props.grammage, props.prixTonne)
const gap = (item: Vignette, index: number) => (index === 0 || !best.value ? '' : vignetteGap(item.row, best.value, props.sort, basis.value))
</script>

<template>
	<section class="atelier-strip" aria-label="Feuilles candidates" :data-stale="stale">
		<div class="atelier-strip-head">
			<h4>{{ items.length }} feuille{{ items.length > 1 ? 's' : '' }} candidate{{ items.length > 1 ? 's' : '' }}</h4>
			<span class="flex-1"></span>
			<template v-if="quantities.length > 1">
				<span class="atelier-strip-label" id="atelier-strip-qty">Quantité</span>
				<div class="atelier-segment" role="group" aria-labelledby="atelier-strip-qty">
					<button v-for="value in quantities" :key="value" type="button" class="tabular-nums" :aria-pressed="value === quantity" :title="value === principale ? (tierTag === 'étude' ? 'Quantité de l\'étude' : 'Quantité de ce test') : undefined" @click="emit('quantity', value)">{{ formatQuantity(value) }}</button>
				</div>
			</template>
			<span class="atelier-strip-label" id="atelier-strip-sort">Trier par</span>
			<div class="atelier-segment" role="group" aria-labelledby="atelier-strip-sort">
				<button v-for="key in VIGNETTE_SORTS" :key="key" type="button" :aria-pressed="key === sort" @click="emit('sort', key)">{{ vignetteSortLabel(key, withCost) }}</button>
			</div>
		</div>
		<div class="atelier-strip-list">
			<button v-for="(item, index) in items" :key="item.key" type="button" class="atelier-card" :aria-pressed="item.key === currentKey" :aria-label="`Voir la feuille ${sheetLabel(item.row)}, ${item.row.nb_poses} poses, ${percentLabel(item.row.taux_chutes)} de chutes`" @click="emit('show', item)">
				<span class="atelier-card-thumb">
					<AtelierMiniature v-if="silhouette" :scenario="item.row" :silhouette="silhouette" :lisiere="lisiere" :pince="pince" />
				</span>
				<span v-if="item.key === retainedKey" class="atelier-card-retained tone-green">Retenue</span>
				<span class="atelier-card-title tabular-nums" :title="`${sheetLabel(item.row)} · ${gridLabel(item.row)}`">{{ sheetLabel(item.row) }}<small> · {{ gridLabel(item.row) }}</small></span>
				<span><span class="atelier-origin" :class="`tone-${vignetteOrigin(item.row, item.coupe).tone}`">{{ vignetteOrigin(item.row, item.coupe).label }}</span></span>
				<span class="atelier-card-figures tabular-nums">
					<span>{{ percentLabel(item.row.taux_chutes) }}</span>
					<span>{{ withCost && cost(item.row) != null ? costLabel(cost(item.row)) : `${sheetsLabel(sheetsFor(item.row, quantity))} f.` }}</span>
				</span>
				<span v-if="index === 0" class="atelier-card-gap" data-best="true">La meilleure</span>
				<span v-else class="atelier-card-gap tabular-nums">{{ gap(item, index) || 'À égalité' }}</span>
			</button>
			<button v-if="canAdd" type="button" class="atelier-card atelier-card-add" :aria-pressed="adding" @click="emit('add')">
				<b aria-hidden="true">+</b>
				<span>Ajouter une feuille</span>
				<small>Format précis ou format idéal</small>
			</button>
		</div>
	</section>
</template>
