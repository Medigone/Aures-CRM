<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getRollCuts } from '@/lib/api'
import { gridLabel, mm, percentLabel, presseAlert, sameSheet, sheetsFor, sheetsLabel, tonnageFor, tonnageLabel, type AtelierPresse, type AtelierReglages, type Scenario } from '@/lib/atelier'

/** Toutes les coupes de la bobine montrée : le moteur n'en retient qu'une, celle qui consomme le moins par pose. */
const props = defineProps<{ calcul: string; roll: { laize: number; depl: number }; current: Scenario | null; reglages: AtelierReglages; grammage: number; presse?: AtelierPresse | null }>()
const emit = defineEmits<{ pick: [row: Scenario] }>()

const cuts = ref<Scenario[] | null>(null)
const error = ref('')
let lastRequest = 0
async function load() {
	const request = ++lastRequest
	error.value = ''
	try {
		const { quantite, lisiere, pince, marge_arriere } = props.reglages
		const rows = await getRollCuts(props.calcul, { laize: props.roll.laize, depl_max: props.roll.depl, quantite, lisiere, pince, marge_arriere })
		if (request === lastRequest) cuts.value = rows
	} catch (e) {
		if (request === lastRequest) error.value = (e as Error).message
	}
}
watch(() => [props.calcul, props.roll.laize, props.roll.depl], load, { immediate: true })
const title = computed(() => `Coupes de la bobine ${mm(props.roll.laize)} mm${props.roll.depl ? `, ${mm(props.roll.depl)} mm au plus` : ''}`)
const maxRate = computed(() => Math.max(1, ...(cuts.value ?? []).map((row) => row.taux_chutes)))
</script>

<template>
	<details class="atelier-cuts" open>
		<summary>{{ title }}</summary>
		<p v-if="error" role="alert" class="field-error m-0">{{ error }}</p>
		<p v-else-if="cuts === null" class="m-0 text-ink-gray-6">Calcul des coupes…</p>
		<p v-else-if="!cuts.length" class="m-0 text-ink-gray-6">Aucune coupe ne tient sur cette bobine.</p>
		<div v-else class="atelier-table-wrap">
			<table class="atelier-table">
				<thead><tr><th class="end">Coupe (mm)</th><th class="end">Grille</th><th class="end">Poses</th><th class="end">Chutes</th><th class="end">Feuilles</th><th class="end">Tonnage</th></tr></thead>
				<tbody>
					<tr v-for="row in cuts" :key="row.libelle" :data-retained="Boolean(current && sameSheet(current, row))" :aria-label="`Voir la coupe de ${mm(row.depl)} mm`" @click="emit('pick', row)">
						<td class="end">{{ mm(row.depl) }}<div v-if="presseAlert(row, presse)" class="atelier-row-alert">Dépasse {{ presse?.nom }}</div></td>
						<td class="end">{{ gridLabel(row) }}<template v-if="row.rotation"> · {{ row.rotation }}°</template></td>
						<td class="end">{{ row.nb_poses }}</td>
						<td class="end"><span class="atelier-rate-bar"><i><b :style="{ width: `${(row.taux_chutes / maxRate) * 100}%` }"></b></i>{{ percentLabel(row.taux_chutes) }}</span></td>
						<td class="end">{{ sheetsLabel(sheetsFor(row, reglages.quantite)) }}</td>
						<td class="end">{{ tonnageLabel(tonnageFor(row, reglages.quantite, grammage)) }}</td>
					</tr>
				</tbody>
			</table>
		</div>
		<p v-if="cuts?.length" class="m-0 mt-1 text-sm text-ink-gray-6">Cliquez sur une coupe pour voir sa feuille. Gardez-la ensuite pour pouvoir la retenir.</p>
	</details>
</template>
