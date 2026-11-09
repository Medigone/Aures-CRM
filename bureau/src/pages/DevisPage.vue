<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LucideArrowLeft from '~icons/lucide/arrow-left'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb } from '@shared/shell'
import BureauShell from '@/components/BureauShell.vue'
import DevisDrawer from '@/components/DevisDrawer.vue'
import DevisList from '@/components/DevisList.vue'
import DevisView from '@/components/DevisView.vue'
import { DEVIS_VIEWS, type DevisView as DevisViewKey } from '@/lib/devis'
import { conditionsFromQuery } from '@/lib/filters'
import { useDevisList } from '@/lib/useDevisList'

/** Liste des devis, aperçu et fiche. */
const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()

// La vue, la page et l'aperçu restent dans l'adresse : un rechargement ou un lien reçu ramène au même endroit.
function viewFromRoute() {
	const value = route.query.vue
	return DEVIS_VIEWS.some((view) => view.key === value) ? (value as DevisViewKey) : undefined
}
function pageFromRoute() {
	const value = Number(route.query.page)
	return Number.isInteger(value) && value > 1 ? value - 1 : 0
}
const state = useDevisList({ view: viewFromRoute(), page: pageFromRoute() })
state.conditions.value = conditionsFromQuery(route.query.filtres)
function listQuery(extra: Record<string, string> = {}) {
	return {
		...(state.view.value === 'all' ? {} : { vue: state.view.value }),
		...(state.page.value > 0 ? { page: String(state.page.value + 1) } : {}),
		...extra,
	}
}
const preview = computed(() => (typeof route.query.apercu === 'string' ? route.query.apercu : undefined))
function showPreview(name?: string) {
	return router.replace({ name: 'Devis', query: listQuery(name ? { apercu: name } : {}) })
}
const tabFromRoute = computed(() => (typeof route.query.onglet === 'string' ? route.query.onglet : undefined))
function openFiche(name: string, tab?: string) {
	router.push({ name: 'DevisFiche', params: { id: name }, query: tab ? { onglet: tab } : {} })
}
function backToList() {
	if (props.id) state.reveal(props.id)
	router.push({ name: 'Devis', query: listQuery(props.id ? { apercu: props.id } : {}) })
}
watch([state.view, state.page], () => {
	if (props.id) return
	router.replace({ name: 'Devis', query: listQuery(preview.value ? { apercu: preview.value } : {}) })
})
// L'adresse commande aussi la vue : la palette ou le menu y mènent sans recharger la page.
watch([() => route.name, () => route.query.vue], () => {
	if (route.name === 'Devis') state.view.value = viewFromRoute() ?? 'all'
})

const crumbs = computed<Crumb[]>(() => (props.id ? [{ label: 'Devis', to: { name: 'Devis' } }, { label: props.id }] : [{ label: 'Devis' }]))
const fiche = ref<InstanceType<typeof DevisView> | null>(null)
const drawer = ref<InstanceType<typeof DevisDrawer> | null>(null)
const active = computed(() => props.id ?? preview.value)
const index = computed(() => state.names.value.indexOf(active.value ?? ''))
const position = computed(() => (index.value >= 0 ? `${index.value + 1} sur ${state.total.value}` : 'Hors de la vue'))
const noPrev = computed(() => index.value <= 0)
const noNext = computed(() => index.value < 0 || index.value >= state.names.value.length - 1)
async function go(offset: number) {
	const target = state.names.value[index.value + offset]
	if (!target) return
	if (props.id) await router.replace({ name: 'DevisFiche', params: { id: target } })
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
	<BureauShell :crumbs="crumbs" active="devis" @created="state.load()">
		<div class="bureau-work">
			<!-- Masquée et non retirée : la liste garde son défilement pendant qu'une fiche est ouverte. -->
			<DevisList v-show="!id" :state="state" :selected="id ? undefined : preview" @pick="showPreview" @open="openFiche" @changed="state.load(); drawer?.refresh()">
				<template #drawer>
					<DevisDrawer v-if="!id && preview" :id="preview" ref="drawer" :position="position" :no-prev="noPrev" :no-next="noNext" @prev="go(-1)" @next="go(1)" @close="showPreview()" @open="(tab) => openFiche(preview!, tab)" @changed="state.load()" />
				</template>
			</DevisList>

			<template v-if="id">
				<div class="flex flex-none flex-wrap items-center justify-between gap-2">
					<button type="button" class="btn-ghost" @click="backToList">
						<LucideArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
						Devis
					</button>
					<div class="flex items-center gap-1.5">
						<span class="text-xs text-ink-gray-6">{{ position }}</span>
						<button type="button" class="icon-btn" aria-label="Devis précédent" :disabled="noPrev" @click="go(-1)"><LucideChevronLeft class="h-4 w-4" aria-hidden="true" /></button>
						<button type="button" class="icon-btn" aria-label="Devis suivant" :disabled="noNext" @click="go(1)"><LucideChevronRight class="h-4 w-4" aria-hidden="true" /></button>
					</div>
				</div>
				<DevisView :id="id" ref="fiche" :tab="tabFromRoute" @changed="state.load()" />
			</template>
		</div>
	</BureauShell>
</template>
