<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb } from '@shared/shell'
import BureauShell from '@/components/BureauShell.vue'
import ClientDrawer from '@/components/ClientDrawer.vue'
import ClientList from '@/components/ClientList.vue'
import ClientView from '@/components/ClientView.vue'
import { CLIENT_VIEWS, type ClientView as ClientViewKey } from '@/lib/clients'
import { loadTodoCount, todoCount } from '@/lib/todoCount'
import { useClients } from '@/lib/useClients'

const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()

// La vue, la page et l'aperçu restent dans l'adresse : un rechargement ou le retour d'une fiche ramène au même endroit.
function viewFromRoute() {
	const value = route.query.vue
	return CLIENT_VIEWS.some((view) => view.key === value) ? (value as ClientViewKey) : undefined
}
function pageFromRoute() {
	const value = Number(route.query.page)
	return Number.isInteger(value) && value > 1 ? value - 1 : 0
}
const state = useClients({ view: viewFromRoute(), page: pageFromRoute() })
function listQuery(extra: Record<string, string> = {}) {
	return {
		...(state.view.value === 'all' ? {} : { vue: state.view.value }),
		...(state.page.value > 0 ? { page: String(state.page.value + 1) } : {}),
		...extra,
	}
}
const preview = computed(() => (typeof route.query.apercu === 'string' ? route.query.apercu : undefined))
const tabFromRoute = computed(() => (typeof route.query.onglet === 'string' ? route.query.onglet : undefined))

function showPreview(name?: string) {
	return router.replace({ name: 'Clients', query: listQuery(name ? { apercu: name } : {}) })
}
function openFiche(name: string, tab?: string) {
	router.push({ name: 'Client', params: { id: name }, query: tab ? { onglet: tab } : {} })
}
function backToList() {
	if (props.id) state.reveal(props.id)
	router.push({ name: 'Clients', query: listQuery(props.id ? { apercu: props.id } : {}) })
}
function setTab(tab: string) {
	router.replace({ query: tab === 'apercu' ? {} : { onglet: tab } })
}
watch([state.view, state.page], () => {
	if (!props.id) router.replace({ name: 'Clients', query: listQuery(preview.value ? { apercu: preview.value } : {}) })
})

// L'adresse commande aussi la vue : la palette ou le menu y mènent sans recharger la page. Une fiche garde la vue de la liste qu'elle a quittée.
watch([() => route.name, () => route.query.vue], () => {
	if (route.name === 'Clients') state.view.value = viewFromRoute() ?? 'all'
})

const fiche = ref<InstanceType<typeof ClientView> | null>(null)
const drawer = ref<InstanceType<typeof ClientDrawer> | null>(null)
const crumbs = computed<Crumb[]>(() => {
	if (!props.id) return [{ label: 'Clients' }]
	const label = fiche.value?.client?.client ?? state.clients.value.find((client) => client.name === props.id)?.client ?? props.id
	return [{ label: 'Clients', to: { name: 'Clients' } }, { label }]
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
	if (props.id) await router.replace({ name: 'Client', params: { id: target } })
	else await showPreview(target)
	state.reveal(target)
}

// Temps réel : ce qui change ailleurs (Desk, collègue) remonte sans recharger la page.
interface BureauEvent extends RealtimeEvent {
	ticket?: string | null
}
const reload = throttledReload(
	() => {
		state.load()
		fiche.value?.refresh()
		drawer.value?.refresh()
	},
	{ delayMs: 1000, minIntervalMs: 4000 },
)
onMounted(() => {
	if (todoCount.value === undefined) loadTodoCount()
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
	<BureauShell :crumbs="crumbs" active="clients" @created="state.load()">
		<div class="bureau-work">
			<!-- Masquée et non retirée : la liste garde son défilement pendant qu'une fiche est ouverte. -->
			<ClientList v-show="!id" :state="state" :selected="id ? undefined : preview" @pick="showPreview" @open="openFiche" @changed="state.load(); drawer?.refresh()">
				<template #drawer>
					<ClientDrawer v-if="!id && preview" :id="preview" ref="drawer" :position="position" :no-prev="noPrev" :no-next="noNext" @prev="go(-1)" @next="go(1)" @close="showPreview()" @open="(tab) => openFiche(preview!, tab)" @changed="state.load()" />
				</template>
			</ClientList>

			<template v-if="id">
				<div class="flex flex-none flex-wrap items-center justify-between gap-2">
					<button type="button" class="btn-ghost" @click="backToList">
						<LucideArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
						Clients
					</button>
					<div class="flex items-center gap-1.5">
						<span class="text-xs text-ink-gray-6">{{ position }}</span>
						<button type="button" class="icon-btn" aria-label="Client précédent" :disabled="noPrev" @click="go(-1)"><LucideChevronLeft class="h-4 w-4" aria-hidden="true" /></button>
						<button type="button" class="icon-btn" aria-label="Client suivant" :disabled="noNext" @click="go(1)"><LucideChevronRight class="h-4 w-4" aria-hidden="true" /></button>
					</div>
				</div>
				<ClientView :id="id" ref="fiche" :tab="tabFromRoute" @tab="setTab" @changed="state.load()" />
			</template>
		</div>
	</BureauShell>
</template>
