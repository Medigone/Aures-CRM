<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb } from '@shared/shell'
import BureauShell from '@/components/BureauShell.vue'
import DevisDrawer from '@/components/DevisDrawer.vue'
import DevisList from '@/components/DevisList.vue'
import { DEVIS_DOCTYPE, DEVIS_VIEWS, type DevisView } from '@/lib/devis'
import { deskUrl } from '@/lib/display'
import { conditionsFromQuery } from '@/lib/filters'
import { useDevisList } from '@/lib/useDevisList'

/** Liste des devis et leur aperçu. La fiche viendra avec le cycle du devis : en attendant, un devis s'ouvre sur le Desk. */
const route = useRoute()
const router = useRouter()

// La vue, la page et l'aperçu restent dans l'adresse : un rechargement ou un lien reçu ramène au même endroit.
function viewFromRoute() {
	const value = route.query.vue
	return DEVIS_VIEWS.some((view) => view.key === value) ? (value as DevisView) : undefined
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
function openOnDesk(name: string) {
	window.open(deskUrl(DEVIS_DOCTYPE, name), '_blank', 'noopener,noreferrer')
}
watch([state.view, state.page], () => {
	router.replace({ name: 'Devis', query: listQuery(preview.value ? { apercu: preview.value } : {}) })
})
// L'adresse commande aussi la vue : la palette ou le menu y mènent sans recharger la page.
watch([() => route.name, () => route.query.vue], () => {
	if (route.name === 'Devis') state.view.value = viewFromRoute() ?? 'all'
})

const crumbs: Crumb[] = [{ label: 'Devis' }]
const drawer = ref<InstanceType<typeof DevisDrawer> | null>(null)
const index = computed(() => state.names.value.indexOf(preview.value ?? ''))
const position = computed(() => (index.value >= 0 ? `${index.value + 1} sur ${state.total.value}` : 'Hors de la vue'))
const noPrev = computed(() => index.value <= 0)
const noNext = computed(() => index.value < 0 || index.value >= state.names.value.length - 1)
async function go(offset: number) {
	const target = state.names.value[index.value + offset]
	if (!target) return
	await showPreview(target)
	state.reveal(target)
}

// Temps réel : ce qui change sur le Desk ou chez un collègue remonte sans recharger la page.
const reload = throttledReload(
	() => {
		state.load()
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
			<DevisList :state="state" :selected="preview" @pick="showPreview" @open="openOnDesk" @changed="state.load(); drawer?.refresh()">
				<template #drawer>
					<DevisDrawer v-if="preview" :id="preview" ref="drawer" :position="position" :no-prev="noPrev" :no-next="noNext" @prev="go(-1)" @next="go(1)" @close="showPreview()" @changed="state.load()" />
				</template>
			</DevisList>
		</div>
	</BureauShell>
</template>
