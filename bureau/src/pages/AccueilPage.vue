<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LucidePlus from '~icons/lucide/plus'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb } from '@shared/shell'
import AccueilData from '@/components/AccueilData.vue'
import AccueilFlux from '@/components/AccueilFlux.vue'
import AccueilQueue from '@/components/AccueilQueue.vue'
import AccueilTrends from '@/components/AccueilTrends.vue'
import AppToast from '@/components/AppToast.vue'
import BureauShell from '@/components/BureauShell.vue'
import DemandeDialog from '@/components/DemandeDialog.vue'
import { getAccueil, getReferences, runAction, setAssignee } from '@/lib/api'
import type { AccueilData as AccueilResponse, AccueilRow, AccueilScope } from '@/lib/accueil'
import { loadTodoCount } from '@/lib/todoCount'
import type { Option } from '@/types'

/** Accueil du poste : ce que le back office doit transformer en action, faire avancer et mettre à jour. */
const router = useRouter()
const crumbs: Crumb[] = [{ label: 'Accueil' }]
const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const todayLabel = today.charAt(0).toUpperCase() + today.slice(1)

const shell = ref<InstanceType<typeof BureauShell> | null>(null)
const data = ref<AccueilResponse | null>(null)
const assignees = ref<Option[]>([])
const scope = ref<AccueilScope>('team')
const loading = ref(false)
const error = ref('')
const actionError = ref('')
const busy = ref('')
const notice = ref('')
const creatingFrom = ref('')
const createdDemande = ref('')

let lastRequest = 0
async function load() {
	const request = ++lastRequest
	loading.value = !data.value
	error.value = ''
	try {
		const result = await getAccueil(scope.value)
		if (request === lastRequest) data.value = result
	} catch (failure) {
		if (request === lastRequest) error.value = failure instanceof Error ? failure.message : "L'accueil n'a pas pu être chargé."
	} finally {
		if (request === lastRequest) loading.value = false
	}
}
watch(scope, load)

async function refreshAfterChange() {
	await load()
	loadTodoCount()
}

/** Une action de ligne : l'erreur reste dans la page, et la file se recharge dans tous les cas (un refus vient souvent d'un autre). */
async function act(row: AccueilRow, run: () => Promise<unknown>, done: string) {
	busy.value = row.name
	actionError.value = ''
	try {
		await run()
		notice.value = done
	} catch (failure) {
		actionError.value = failure instanceof Error ? failure.message : "L'action n'a pas abouti."
	} finally {
		busy.value = ''
		await refreshAfterChange()
	}
}
function onRun(row: AccueilRow) {
	act(row, () => runAction(row, row.action.action ?? ''), `Ticket ${row.name} : ${row.action.label.toLowerCase()} fait.`)
}
function onAssign(row: AccueilRow, user: string) {
	act(row, () => setAssignee(row, user), `Ticket ${row.name} attribué.`)
}
function onDemandeCreated(name: string) {
	creatingFrom.value = ''
	createdDemande.value = name
	refreshAfterChange()
}
function openTicket(row: AccueilRow) {
	router.push({ name: 'Ticket', params: { id: row.name } })
}
function openCreatedDemande() {
	const name = createdDemande.value
	createdDemande.value = ''
	router.push({ name: 'Demande', params: { id: name } })
}

interface BureauEvent extends RealtimeEvent {
	ticket?: string | null
}
const reload = throttledReload(load, { delayMs: 1000, minIntervalMs: 4000 })
onMounted(async () => {
	load()
	loadTodoCount()
	connectRealtime<BureauEvent>(
		'aures_bureau_update',
		(event) => {
			if (isForeignChange(event, window.user)) reload()
		},
		reload,
	)
	try {
		assignees.value = (await getReferences()).assignees
	} catch {
		// Sans cette liste, le menu d'attribution propose seulement de se l'attribuer.
	}
})
onBeforeUnmount(closeRealtime)
</script>

<template>
	<BureauShell ref="shell" :crumbs="crumbs" active="accueil" @created="refreshAfterChange">
		<div class="accueil">
			<div class="accueil-head">
				<div class="accueil-head-title">
					<h1>Accueil</h1>
					<span>{{ todayLabel }}</span>
				</div>
				<button type="button" class="btn-primary" @click="shell?.startCreating('ticket')"><LucidePlus class="h-4 w-4" aria-hidden="true" />Nouveau ticket</button>
			</div>

			<p v-if="!data && error" class="rounded-control tone-red px-3.5 py-2.5" role="alert">{{ error }} <button type="button" class="text-link underline" @click="load">Réessayer</button></p>
			<p v-else-if="!data" class="accueil-empty">Chargement…</p>
			<template v-else>
				<p v-if="error" class="rounded-control tone-red px-3.5 py-2.5" role="alert">{{ error }}</p>
				<p v-if="actionError" class="rounded-control tone-red px-3.5 py-2.5" role="alert">{{ actionError }}</p>
				<AccueilFlux :stages="data.stages" :stale-days="data.stale_days" />
				<div class="accueil-columns-main">
					<AccueilQueue v-model:scope="scope" :groups="data.queue" :assignees="assignees" :busy="busy" :max-rows="data.max_rows" @run="onRun" @assign="onAssign" @demande="(row) => (creatingFrom = row.name)" @open="openTicket" />
					<AccueilData :data="data" />
				</div>
				<AccueilTrends v-if="data.trends" :trends="data.trends" />
			</template>
		</div>
		<DemandeDialog v-if="creatingFrom" :ticket="creatingFrom" @close="creatingFrom = ''" @created="onDemandeCreated" />
		<AppToast :message="notice" @close="notice = ''" />
		<AppToast :message="createdDemande ? `Demande ${createdDemande} créée.` : ''" :duration="0" @close="createdDemande = ''">
			<button type="button" class="app-toast-action" @click="openCreatedDemande">Ouvrir la fiche</button>
		</AppToast>
	</BureauShell>
</template>
