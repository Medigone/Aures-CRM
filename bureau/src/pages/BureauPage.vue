<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import BrandMark from '@shared/components/BrandMark.vue'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import QueueList from '@/components/QueueList.vue'
import TicketDrawer from '@/components/TicketDrawer.vue'
import TicketView from '@/components/TicketView.vue'
import { initials } from '@/lib/display'
import { useQueue } from '@/lib/useQueue'

const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()
const userName = window.user_fullname || window.user || ''

const state = useQueue()
const ticketView = ref<InstanceType<typeof TicketView> | null>(null)
const drawer = ref<InstanceType<typeof TicketDrawer> | null>(null)

/** Ticket de l'aperçu : dans l'adresse, pour survivre à un rechargement et au retour depuis la fiche. */
const preview = computed(() => (typeof route.query.apercu === 'string' ? route.query.apercu : undefined))
const stepFromRoute = computed(() => {
	const step = Number(route.query.etape)
	return route.query.etape !== undefined && Number.isInteger(step) ? step : null
})

function showPreview(name?: string) {
	router.replace({ name: 'Home', query: name ? { apercu: name } : {} })
}
function openFiche(name: string, step?: number) {
	router.push({ name: 'Ticket', params: { id: name }, query: step === undefined ? {} : { etape: step } })
}
function backToList() {
	router.push({ name: 'Home', query: props.id ? { apercu: props.id } : {} })
}

// Position dans la liste affichée, commune à l'aperçu et à la fiche.
const active = computed(() => props.id ?? preview.value)
const index = computed(() => state.tickets.value.findIndex((ticket) => ticket.name === active.value))
const position = computed(() => (index.value >= 0 ? `${index.value + 1} sur ${state.tickets.value.length}` : 'Hors de la vue'))
const noPrev = computed(() => index.value <= 0)
const noNext = computed(() => index.value < 0 || index.value >= state.tickets.value.length - 1)
function go(offset: number) {
	const target = state.tickets.value[index.value + offset]
	if (!target) return
	if (props.id) router.replace({ name: 'Ticket', params: { id: target.name } })
	else showPreview(target.name)
}

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
	<div class="bureau-shell">
		<header class="flex min-h-11 flex-none flex-wrap items-center gap-x-3 gap-y-1 border-b border-outline-gray-1 bg-surface-white px-4 py-1">
			<BrandMark />
			<span class="h-4 w-px bg-surface-gray-4" aria-hidden="true"></span>
			<span class="font-semibold">Back office</span>
			<div class="ml-auto flex items-center gap-4">
				<a href="/app" class="inline-flex min-h-[var(--ctl)] items-center gap-1.5 text-sm font-medium text-accent hover:underline">
					Ouvrir le Desk
					<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
				</a>
				<span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary" :title="userName" role="img" :aria-label="`Compte : ${userName}`">{{ initials(userName) }}</span>
			</div>
		</header>
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
						@open="(step) => openFiche(preview!, step)"
						@changed="state.load()"
					/>
				</template>
			</QueueList>

			<template v-if="id">
				<div class="flex flex-none flex-wrap items-center justify-between gap-2">
					<button type="button" class="btn-secondary" @click="backToList">
						<LucideArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
						Retour à la liste
					</button>
					<div class="flex items-center gap-1.5">
						<span class="text-xs text-ink-gray-6">{{ position }}</span>
						<button type="button" class="icon-btn" aria-label="Ticket précédent" :disabled="noPrev" @click="go(-1)"><LucideChevronLeft class="h-4 w-4" aria-hidden="true" /></button>
						<button type="button" class="icon-btn" aria-label="Ticket suivant" :disabled="noNext" @click="go(1)"><LucideChevronRight class="h-4 w-4" aria-hidden="true" /></button>
					</div>
				</div>
				<TicketView :id="id" ref="ticketView" :step="stepFromRoute" @changed="state.load()" />
			</template>
		</div>
	</div>
</template>
