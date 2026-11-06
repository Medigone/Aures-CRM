<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb } from '@shared/shell'
import BureauShell from '@/components/BureauShell.vue'
import QueueList from '@/components/QueueList.vue'
import TicketDrawer from '@/components/TicketDrawer.vue'
import TicketView from '@/components/TicketView.vue'
import { todoCount } from '@/lib/todoCount'
import { TICKET_VIEWS, useQueue } from '@/lib/useQueue'
import type { QueueView } from '@/types'

const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()
// La vue et la page restent dans l'adresse : un rechargement ramène au même endroit.
function viewFromRoute() {
	const value = route.query.vue
	return TICKET_VIEWS.some((view) => view.key === value) ? (value as QueueView) : undefined
}
function pageFromRoute() {
	const value = Number(route.query.page)
	return Number.isInteger(value) && value > 1 ? value - 1 : 0
}
const state = useQueue({ view: viewFromRoute(), page: pageFromRoute() })
function listQuery(extra: Record<string, string> = {}) {
	return {
		...(state.view.value === 'todo' ? {} : { vue: state.view.value }),
		...(state.page.value > 0 ? { page: String(state.page.value + 1) } : {}),
		...extra,
	}
}
const ticketView = ref<InstanceType<typeof TicketView> | null>(null)
const drawer = ref<InstanceType<typeof TicketDrawer> | null>(null)

/** Ticket de l'aperçu : dans l'adresse, pour survivre à un rechargement et au retour depuis la fiche. */
const preview = computed(() => (typeof route.query.apercu === 'string' ? route.query.apercu : undefined))
const stepFromRoute = computed(() => {
	const step = Number(route.query.etape)
	return route.query.etape !== undefined && Number.isInteger(step) ? step : null
})

function showPreview(name?: string) {
	return router.replace({ name: 'Home', query: listQuery(name ? { apercu: name } : {}) })
}
function openFiche(name: string, step?: number, activity?: boolean) {
	const query: Record<string, string> = {}
	if (step !== undefined) query.etape = String(step)
	if (activity) query.fil = '1'
	router.push({ name: 'Ticket', params: { id: name }, query })
}
function backToList() {
	if (props.id) state.reveal(props.id)
	router.push({ name: 'Home', query: listQuery(props.id ? { apercu: props.id } : {}) })
}
watch([state.view, state.page], () => {
	if (!props.id) router.replace({ name: 'Home', query: listQuery(preview.value ? { apercu: preview.value } : {}) })
})

// L'adresse commande aussi la vue : la palette ou le menu y mènent sans recharger la page. Une fiche garde la vue de la liste qu'elle a quittée.
watch([() => route.name, () => route.query.vue], () => {
	if (route.name === 'Home') state.view.value = viewFromRoute() ?? 'todo'
})

// Le compteur du menu reste affiché sur les autres pages du poste.
watch(
	() => state.queue.value?.counts.todo,
	(count) => {
		if (count !== undefined) todoCount.value = count
	},
)
const crumbs = computed<Crumb[]>(() => {
	if (!props.id) return [{ label: 'Tickets' }]
	const open = state.tickets.value.find((ticket) => ticket.name === props.id)
	return [{ label: 'Tickets', to: { name: 'Home' } }, { label: open ? `${open.client} · ${open.name}` : props.id }]
})

// Position dans la liste affichée, commune à l'aperçu et à la fiche.
const active = computed(() => props.id ?? preview.value)
const index = computed(() => state.names.value.indexOf(active.value ?? ''))
const position = computed(() => (index.value >= 0 ? `${index.value + 1} sur ${state.total.value}` : 'Hors de la vue'))
const noPrev = computed(() => index.value <= 0)
const noNext = computed(() => index.value < 0 || index.value >= state.names.value.length - 1)
async function go(offset: number) {
	const target = state.names.value[index.value + offset]
	if (!target) return
	// L'adresse d'abord : changer de page la réécrit, et doit y trouver le nouvel élément.
	if (props.id) await router.replace({ name: 'Ticket', params: { id: target } })
	else await showPreview(target)
	state.reveal(target)
}
const goToActivity = computed(() => route.query.fil === '1')

function refreshOpenTicket() {
	if (props.id) ticketView.value?.refresh()
	else drawer.value?.refresh()
}

// Temps réel : ce qui change ailleurs (Desk, collègue) remonte sans recharger la page.
interface BureauEvent extends RealtimeEvent {
	ticket?: string | null
}
const REALTIME_EVENT = 'aures_bureau_update'
let touchedOpenTicket = false
const reload = throttledReload(
	() => {
		state.load()
		const message = touchedOpenTicket ? 'Ce ticket vient d\'être modifié par ailleurs : il a été mis à jour.' : ''
		ticketView.value?.refresh(message)
		drawer.value?.refresh(message)
		touchedOpenTicket = false
	},
	{ delayMs: 1000, minIntervalMs: 4000 },
)
onMounted(() => {
	connectRealtime<BureauEvent>(
		REALTIME_EVENT,
		(event) => {
			if (!isForeignChange(event, window.user)) return
			if (event.ticket && event.ticket === active.value) touchedOpenTicket = true
			reload()
		},
		reload,
	)
})
onBeforeUnmount(closeRealtime)
</script>

<template>
	<BureauShell :crumbs="crumbs" active="tickets" @created="state.load()">
		<div class="bureau-work">
			<!-- Masquée et non retirée : la liste garde sa sélection et son défilement pendant qu'une fiche est ouverte. -->
			<QueueList v-show="!id" :state="state" :selected="id ? undefined : preview" @pick="showPreview" @open="openFiche" @changed="state.load(); refreshOpenTicket()">
				<template #drawer>
					<TicketDrawer
						v-if="!id && preview"
						:id="preview"
						ref="drawer"
						:position="position"
						:no-prev="noPrev"
						:no-next="noNext"
						@prev="go(-1)"
						@next="go(1)"
						@close="showPreview()"
						@open="(step, activity) => openFiche(preview!, step, activity)"
						@changed="state.load()"
					/>
				</template>
			</QueueList>

			<template v-if="id">
				<div class="flex flex-none flex-wrap items-center justify-between gap-2">
					<button type="button" class="btn-ghost" @click="backToList">
						<LucideArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
						Tickets
					</button>
					<div class="flex items-center gap-1.5">
						<span class="text-xs text-ink-gray-6">{{ position }}</span>
						<button type="button" class="icon-btn" aria-label="Ticket précédent" :disabled="noPrev" @click="go(-1)"><LucideChevronLeft class="h-4 w-4" aria-hidden="true" /></button>
						<button type="button" class="icon-btn" aria-label="Ticket suivant" :disabled="noNext" @click="go(1)"><LucideChevronRight class="h-4 w-4" aria-hidden="true" /></button>
					</div>
				</div>
				<TicketView :id="id" ref="ticketView" :step="stepFromRoute" :go-to-activity="goToActivity" @changed="state.load()" />
			</template>
		</div>
	</BureauShell>
</template>
