<script setup lang="ts">
import { computed } from 'vue'
import { costLabel, unitCostLabel, gridLabel, sheetLabel, sheetsLabel, tierResults, tonnageLabel, type Scenario } from '@/lib/atelier'
import { formatQuantity } from '@/lib/etudes'

/** Le gagnant de chaque quantité : la feuille qui consomme le moins de matière, et l'écart avec la suivante. */
const props = defineProps<{ tierTag: string; canSeeCosts: boolean; rows: Scenario[]; quantities: number[]; principale: number; grammage: number; prixTonne: number; selected: number | null }>()
const emit = defineEmits<{ pick: [quantite: number]; show: [row: Scenario] }>()

const results = computed(() => tierResults(props.rows, props.quantities, props.grammage, props.prixTonne))
const changes = computed(() => results.value.some((row) => row.formatChange))
const basis = computed(() => {
	if (!props.grammage) return props.canSeeCosts ? 'Sans grammage connu : à la surface de carton, sans tonnage ni coût' : 'Sans grammage connu : à la surface de carton'
	if (!props.canSeeCosts) return 'Au tonnage'
	return props.prixTonne ? 'Au coût matière' : 'Au tonnage : indiquez un prix matière pour voir les coûts'
})
const active = (quantite: number) => (props.selected ?? props.principale) === quantite
</script>

<template>
	<section class="card atelier-tiers" aria-label="Gagnant par quantité">
		<div class="atelier-tiers-head">
			<h4>Par quantité</h4>
			<small>{{ basis }}<template v-if="changes"> · le format change selon la quantité</template></small>
		</div>
		<div class="atelier-table-wrap">
			<table class="atelier-table">
				<thead>
					<tr>
						<th class="end">Quantité</th>
						<th>Gagnant</th>
						<th class="end">Feuilles</th>
						<th class="end">Tonnage</th>
						<th v-if="canSeeCosts" class="end">Coût matière</th>
						<th v-if="canSeeCosts" class="end">Coût unitaire</th>
						<th class="end">Suivant</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="tier in results" :key="tier.quantite" :data-retained="active(tier.quantite)" :title="`Trier le tableau pour ${formatQuantity(tier.quantite)} ex.`" @click="emit('pick', tier.quantite); emit('show', tier.winner)">
						<td class="end">
							<b class="font-semibold">{{ formatQuantity(tier.quantite) }}</b>
							<small v-if="tier.quantite === principale" class="atelier-tier-tag">{{ tierTag }}</small>
						</td>
						<td>
							<span class="font-medium text-ink-gray-9">{{ sheetLabel(tier.winner) }}</span>
							<span class="text-ink-gray-6"> · {{ gridLabel(tier.winner) }}</span>
							<span v-if="tier.formatChange" class="atelier-tier-change tone-amber">autre format</span>
						</td>
						<td class="end">{{ sheetsLabel(tier.feuilles) }}</td>
						<td class="end">{{ tonnageLabel(tier.tonnage) }}</td>
						<td v-if="canSeeCosts" class="end">{{ costLabel(tier.cout) }}</td>
						<td v-if="canSeeCosts" class="end">{{ unitCostLabel(tier.coutUnitaire) }}</td>
						<td class="end text-ink-gray-6">
							<template v-if="tier.suivant">{{ sheetLabel(tier.suivant) }} <span class="tabular-nums">+{{ String(tier.ecartSuivant).replace('.', ',') }} %</span></template>
							<template v-else>—</template>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>
