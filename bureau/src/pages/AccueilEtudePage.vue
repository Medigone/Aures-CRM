<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb } from '@shared/shell'
import AccueilEtudeQueue from '@/components/AccueilEtudeQueue.vue'
import AccueilEtudeWatch from '@/components/AccueilEtudeWatch.vue'
import AccueilFlux from '@/components/AccueilFlux.vue'
import AppToast from '@/components/AppToast.vue'
import BureauShell from '@/components/BureauShell.vue'
import { getEtudeAccueil, runEtudeAction } from '@/lib/api'
import type { AccueilScope } from '@/lib/accueil'
import type { EtudeAccueilData, EtudeAccueilRow } from '@/lib/accueilEtude'

/** Accueil du poste Étude : où en sont les études, ce qui attend l'équipe, ce qui manque. */
const crumbs: Crumb[] = [{ label: 'Accueil' }]
const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const todayLabel = today.charAt(0).toUpperCase() + today.slice(1)

const data = ref<EtudeAccueilData | null>(null)
const scope = ref<AccueilScope>('team')
const error = ref('')
const actionError = ref('')
const busy = ref('')
const notice = ref('')

let lastRequest = 0
async function load() {
	const request = ++lastRequest
	error.value = ''
	try {
		const result = await getEtudeAccueil(scope.value)
		if (request === lastRequest) data.value = result
	} catch (failure) {
		if (request === lastRequest) error.value = failure instanceof Error ? failure.message : "L'accueil n'a pas pu être chargé."
	}
}
watch(scope, load)

/** L'erreur reste dans la page, et la file se recharge dans tous les cas : un refus vient souvent d'un autre. */
async function run(row: EtudeAccueilRow) {
	busy.value = row.name
	actionError.value = ''
	try {
		await runEtudeAction(row, row.action.action ?? '')
		notice.value = `Étude ${row.name} démarrée.`
	} catch (failure) {
		actionError.value = failure instanceof Error ? failure.message : "L'action n'a pas abouti."
	} finally {
		busy.value = ''
		await load()
	}
}

interface BureauEvent extends RealtimeEvent {
	ticket?: string | null
}
const reload = throttledReload(load, { delayMs: 1000, minIntervalMs: 4000 })
onMounted(() => {
	load()
	connectRealtime<BureauEvent>(
		'aures_bureau_update',
		(event) => {
			if (isForeignChange(event, window.user)) reload()
		},
		reload,
	)
})
onBeforeUnmount(closeRealtime)
</script>

<template>
	<BureauShell :crumbs="crumbs" active="accueil">
		<div class="accueil">
			<div class="accueil-head">
				<div class="accueil-head-title">
					<h1>Accueil</h1>
					<span>{{ todayLabel }}</span>
				</div>
			</div>

			<p v-if="!data && error" class="rounded-control tone-red px-3.5 py-2.5" role="alert">{{ error }} <button type="button" class="text-link underline" @click="load">Réessayer</button></p>
			<p v-else-if="!data" class="accueil-empty">Chargement…</p>
			<template v-else>
				<p v-if="error" class="rounded-control tone-red px-3.5 py-2.5" role="alert">{{ error }}</p>
				<p v-if="actionError" class="rounded-control tone-red px-3.5 py-2.5" role="alert">{{ actionError }}</p>
				<AccueilFlux :stages="data.stages" :stale-days="7" :chained="false" />
				<div class="accueil-columns-main">
					<AccueilEtudeQueue v-model:scope="scope" :data="data" :busy="busy" @run="run" />
					<AccueilEtudeWatch :rows="data.watch" />
				</div>
			</template>
		</div>
		<AppToast :message="notice" @close="notice = ''" />
	</BureauShell>
</template>
