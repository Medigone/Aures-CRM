<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import LucideFileText from '~icons/lucide/file-text'
import LucideLogOut from '~icons/lucide/log-out'
import LucideMoon from '~icons/lucide/moon'
import LucidePackage from '~icons/lucide/package'
import LucideShoppingCart from '~icons/lucide/shopping-cart'
import LucideSun from '~icons/lucide/sun'
import LucideTicket from '~icons/lucide/ticket'
import LucideWallet from '~icons/lucide/wallet'
import { call } from '@shared/api'
import AppShell from '@shared/components/AppShell.vue'
import { closeRealtime, connectRealtime, isForeignChange, realtimeConnected, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb, NavGroup } from '@shared/shell'
import GlobalSearch from '@/components/GlobalSearch.vue'
import QueueList from '@/components/QueueList.vue'
import TicketDrawer from '@/components/TicketDrawer.vue'
import TicketView from '@/components/TicketView.vue'
import { initials } from '@/lib/display'
import { useAppTheme } from '@/lib/theme'
import { useQueue } from '@/lib/useQueue'
import type { QueueView } from '@/types'

const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()
const userName = window.user_fullname || window.user || ''
const theme = useAppTheme()
const nextThemeLabel = computed(() => (theme.resolved.value === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'))
function toggleTheme() {
	theme.setPreference(theme.resolved.value === 'dark' ? 'light' : 'dark')
}
async function logout() {
	await call('logout', {}, true)
	window.location.href = '/login'
}

// La vue et la page restent dans l'adresse : un rechargement ramène au même endroit.
const QUEUE_VIEWS: QueueView[] = ['todo', 'mine', 'urgent', 'creance', 'closed']
function viewFromRoute() {
	const value = route.query.vue
	return QUEUE_VIEWS.includes(value as QueueView) ? (value as QueueView) : undefined
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
	router.replace({ name: 'Home', query: listQuery(name ? { apercu: name } : {}) })
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

// Menu : les écrans pas encore repris dans le poste de bureau s'ouvrent sur le Desk.
const navGroups = computed<NavGroup[]>(() => [
	{
		title: 'Mon travail',
		items: [
			{ id: 'tickets', label: 'Tickets', icon: LucideTicket, to: { name: 'Home' }, count: state.queue.value?.counts.todo, active: true },
			{ id: 'commandes', label: 'Commandes', icon: LucideShoppingCart, href: '/app/sales-order' },
			{ id: 'devis', label: 'Devis', icon: LucideFileText, href: '/app/quotation' },
			{ id: 'creances', label: 'Créances', icon: LucideWallet, href: '/app/suivi-creance' },
		],
	},
	{
		title: 'Référentiel',
		items: [
			{ id: 'clients', label: 'Clients', icon: LucideBuilding2, href: '/app/customer' },
			{ id: 'articles', label: 'Articles', icon: LucidePackage, href: '/app/item' },
		],
	},
])
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
function go(offset: number) {
	const target = state.names.value[index.value + offset]
	if (!target) return
	state.reveal(target)
	if (props.id) router.replace({ name: 'Ticket', params: { id: target } })
	else showPreview(target)
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
	<AppShell poste="Back office" :groups="navGroups" :crumbs="crumbs" :user-name="userName" :initials="initials(userName)" storage-key="bureau-menu">
		<template #search>
			<GlobalSearch @open="openFiche" />
		</template>
		<template #status>
			<span class="live-status" :data-live="realtimeConnected" :title="realtimeConnected ? 'Les changements faits ailleurs arrivent seuls' : 'Les changements faits ailleurs n\'arrivent plus seuls : actualisez la liste'">
				<i aria-hidden="true"></i>
				<span>{{ realtimeConnected ? 'À jour' : 'Temps réel coupé' }}</span>
			</span>
		</template>
		<template #account="{ close }">
			<button type="button" class="app-menu-item" role="menuitem" @click="toggleTheme(); close()">
				<LucideSun v-if="theme.resolved.value === 'dark'" class="h-3.5 w-3.5" aria-hidden="true" />
				<LucideMoon v-else class="h-3.5 w-3.5" aria-hidden="true" />
				{{ nextThemeLabel }}
			</button>
			<a href="/app" class="app-menu-item" role="menuitem" target="_blank" rel="noopener noreferrer" @click="close()">
				<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
				Ouvrir le Desk
			</a>
			<div class="app-menu-sep"></div>
			<button type="button" class="app-menu-item" role="menuitem" @click="logout">
				<LucideLogOut class="h-3.5 w-3.5" aria-hidden="true" />
				Se déconnecter
			</button>
		</template>
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
	</AppShell>
</template>
