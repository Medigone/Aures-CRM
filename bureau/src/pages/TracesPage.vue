<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import type { Crumb } from '@shared/shell'
import BureauShell from '@/components/BureauShell.vue'
import TraceDrawer from '@/components/TraceDrawer.vue'
import TraceList from '@/components/TraceList.vue'
import TraceView from '@/components/TraceView.vue'
import { DEFAULT_TRACE_VIEW, TRACE_VIEWS, type TraceView as TraceViewKey } from '@/lib/traces'
import { conditionsFromQuery } from '@/lib/filters'
import { useTraces } from '@/lib/useTraces'

const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()
const defaultView = DEFAULT_TRACE_VIEW

// La vue, la page et l'aperçu restent dans l'adresse : un rechargement ramène au même endroit.
function viewFromRoute() {
	const value = route.query.vue
	return TRACE_VIEWS.some((view) => view.key === value) ? (value as TraceViewKey) : undefined
}
function pageFromRoute() {
	const value = Number(route.query.page)
	return Number.isInteger(value) && value > 1 ? value - 1 : 0
}
const state = useTraces({ view: viewFromRoute() ?? defaultView, page: pageFromRoute() })
state.conditions.value = conditionsFromQuery(route.query.filtres)
function listQuery(extra: Record<string, string> = {}) {
	return {
		...(state.view.value === defaultView ? {} : { vue: state.view.value }),
		...(state.page.value > 0 ? { page: String(state.page.value + 1) } : {}),
		...extra,
	}
}
const preview = computed(() => (typeof route.query.apercu === 'string' ? route.query.apercu : undefined))
function showPreview(name?: string) {
	return router.replace({ name: 'Traces', query: listQuery(name ? { apercu: name } : {}) })
}
const tabFromRoute = computed(() => (typeof route.query.onglet === 'string' ? route.query.onglet : undefined))
function openFiche(name: string, tab?: string) {
	router.push({ name: 'Trace', params: { id: name }, query: tab ? { onglet: tab } : {} })
}
function backToList() {
	if (props.id) state.reveal(props.id)
	router.push({ name: 'Traces', query: listQuery(props.id ? { apercu: props.id } : {}) })
}
watch([state.view, state.page], () => {
	if (props.id) return
	router.replace({ name: 'Traces', query: listQuery(preview.value ? { apercu: preview.value } : {}) })
})
// L'adresse commande aussi la vue : la palette ou le menu y mènent sans recharger la page.
watch([() => route.name, () => route.query.vue], () => {
	if (route.name === 'Traces') state.view.value = viewFromRoute() ?? defaultView
})

const fiche = ref<InstanceType<typeof TraceView> | null>(null)
const crumbs = computed<Crumb[]>(() => (props.id ? [{ label: 'Tracés', to: { name: 'Traces' } }, { label: props.id }] : [{ label: 'Tracés' }]))
const drawer = ref<InstanceType<typeof TraceDrawer> | null>(null)
const active = computed(() => props.id ?? preview.value)
const index = computed(() => state.names.value.indexOf(active.value ?? ''))
const position = computed(() => (index.value >= 0 ? `${index.value + 1} sur ${state.total.value}` : 'Hors de la vue'))
const noPrev = computed(() => index.value <= 0)
const noNext = computed(() => index.value < 0 || index.value >= state.names.value.length - 1)
async function go(offset: number) {
	const target = state.names.value[index.value + offset]
	if (!target) return
	if (props.id) await router.replace({ name: 'Trace', params: { id: target } })
	else await showPreview(target)
	state.reveal(target)
}

// Temps réel : ce qui change sur le Desk ou chez un collègue remonte sans recharger la page.
const reload = throttledReload(
	() => {
		state.load()
		fiche.value?.refresh()
		drawer.value?.refresh()
	},
	{ delayMs: 1000, minIntervalMs: 4000 },
)
onMounted(() => {
	connectRealtime<RealtimeEvent>(
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
	<BureauShell :crumbs="crumbs" active="traces" @created="state.load()">
		<div class="bureau-work">
			<!-- Masquée et non retirée : la liste garde son défilement pendant qu'une fiche est ouverte. -->
			<TraceList v-show="!id" :state="state" :selected="id ? undefined : preview" @pick="showPreview" @open="openFiche" @changed="state.load(); drawer?.refresh()">
				<template #drawer>
					<TraceDrawer v-if="!id && preview" :id="preview" ref="drawer" :position="position" :no-prev="noPrev" :no-next="noNext" @prev="go(-1)" @next="go(1)" @close="showPreview()" @open="(tab) => openFiche(preview!, tab)" @changed="state.load()" />
				</template>
			</TraceList>

			<template v-if="id">
				<div class="flex flex-none flex-wrap items-center justify-between gap-2">
					<button type="button" class="btn-ghost" @click="backToList">
						<LucideArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
						Tracés
					</button>
					<div class="flex items-center gap-1.5">
						<span class="text-xs text-ink-gray-6">{{ position }}</span>
						<button type="button" class="icon-btn" aria-label="Tracé précédent" :disabled="noPrev" @click="go(-1)"><LucideChevronLeft class="h-4 w-4" aria-hidden="true" /></button>
						<button type="button" class="icon-btn" aria-label="Tracé suivant" :disabled="noNext" @click="go(1)"><LucideChevronRight class="h-4 w-4" aria-hidden="true" /></button>
					</div>
				</div>
				<TraceView :id="id" ref="fiche" :tab="tabFromRoute" @changed="state.load()" @moved="(name) => router.replace({ name: 'Trace', params: { id: name } })" />
			</template>
		</div>
	</BureauShell>
</template>
