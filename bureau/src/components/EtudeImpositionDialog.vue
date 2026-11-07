<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import FormDialog from '@shared/components/FormDialog.vue'
import { chooseImposition, getEtudeImpositions } from '@/lib/api'
import { percentLabel, quantityLabel, type EtudePieces, type ImpositionRow, type PiecesResult } from '@/lib/etudePieces'
import type { EtudeDetail } from '@/lib/etudes'

/** Les impositions du tracé, le meilleur taux de chutes d'abord. Choisir reporte le taux sur l'étude. */
const props = defineProps<{ etude: EtudeDetail; pieces: EtudePieces; atelierRoute: RouteLocationRaw }>()
const emit = defineEmits<{ close: []; saved: [result: PiecesResult, message: string]; manual: []; failed: [] }>()

const rows = ref<ImpositionRow[] | null>(null)
const busy = ref(false)
const error = ref('')
const current = () => props.pieces.imposition?.courante?.name

onMounted(async () => {
	try {
		rows.value = await getEtudeImpositions(props.etude.name)
	} catch (e) {
		rows.value = []
		error.value = (e as Error).message
	}
})
async function choose(row: ImpositionRow) {
	if (busy.value) return
	busy.value = true
	error.value = ''
	try {
		emit('saved', await chooseImposition(props.etude, row.name), `Imposition ${row.name} liée. Taux de chutes : ${percentLabel(row.taux_chutes)}.`)
		emit('close')
	} catch (e) {
		error.value = (e as Error).message
		emit('failed')
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog title="Choisir une imposition" :dirty="false" hint="" :busy="busy" @close="emit('close')">
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<p v-if="rows === null" class="m-0 text-ink-gray-6">Chargement des impositions…</p>
		<p v-else-if="!rows.length && !error" class="m-0 text-ink-gray-6">Aucune imposition pour ce tracé. Saisissez-en une, ou calculez-la dans l'atelier.</p>
		<ul v-else class="etude-picks">
			<li v-for="row in rows" :key="row.name" class="etude-pick" :data-current="row.name === current()">
				<div class="min-w-0">
					<p class="etude-pick-name">
						<span class="tabular-nums">{{ row.name }}</span>
						<span class="badge tone-gray">{{ row.origine }}</span>
						<span v-if="row.ideale" class="badge tone-green">Idéale</span>
						<span v-if="row.name === current()" class="badge tone-blue">Actuelle</span>
					</p>
					<p class="etude-pick-sub tabular-nums">{{ row.format || 'Format non renseigné' }} · {{ row.nbr_poses }} poses · {{ percentLabel(row.taux_chutes) }} de chutes · {{ quantityLabel(row.feuilles) }} feuilles</p>
					<p v-for="alert in row.alertes" :key="alert.text" class="etude-pick-alert" :data-tone="alert.tone">{{ alert.text }}</p>
				</div>
				<button type="button" class="btn-secondary" :disabled="busy || row.name === current()" @click="choose(row)">Choisir</button>
			</li>
		</ul>
		<template #hint>
			<RouterLink v-if="pieces.imposition?.atelier" class="btn-ghost mr-auto" :to="atelierRoute">Calculer dans l'atelier</RouterLink>
			<span v-else class="mr-auto"></span>
		</template>
		<template #actions><button v-if="pieces.imposition?.can_create" type="button" class="btn-secondary" :disabled="busy" @click="emit('manual')">Saisir à la main</button></template>
	</FormDialog>
</template>
