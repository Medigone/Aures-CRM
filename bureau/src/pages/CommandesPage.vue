<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { closeRealtime, connectRealtime, isForeignChange, throttledReload, type RealtimeEvent } from '@shared/realtime'
import type { Crumb } from '@shared/shell'
import BureauShell from '@/components/BureauShell.vue'
import CommandeDrawer from '@/components/CommandeDrawer.vue'
import CommandesList from '@/components/CommandesList.vue'
import { COMMANDE_VIEWS, type CommandeView } from '@/lib/commandes'
import { conditionsFromQuery } from '@/lib/filters'
import { useCommandesList } from '@/lib/useCommandesList'

/** Liste des commandes et aperçu. La fiche arrive avec la validation sur le bureau. */
const route = useRoute()
const router = useRouter()

// La vue, la page et l'aperçu restent dans l'adresse : un rechargement ou un lien reçu ramène au même endroit.
function viewFromRoute() {
	const value = route.query.vue
	return COMMANDE_VIEWS.some((view) => view.key === value) ? (value as CommandeView) : undefined
}
function pageFromRoute() {
	const value = Number(route.query.page)
	return Number.isInteger(value) && value > 1 ? value - 1 : 0
}
const state = useCommandesList({ view: viewFromRoute(), page: pageFromRoute() })
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
	return router.replace({ name: 'Commandes', query: listQuery(name ? { apercu: name } : {}) })
}
watch([state.view, state.page], () => {
	router.replace({ name: 'Commandes', query: listQuery(preview.value ? { apercu: preview.value } : {}) })
})
// L'adresse commande aussi la vue : la palette ou le menu y mènent sans recharger la page.
watch([() => route.name, () => route.query.vue], () => {
	if (route.name === 'Commandes') state.view.value = viewFromRoute() ?? 'all'
})
// Arrivé par un lien (depuis un devis), l'aperçu montre sa ligne dans la liste.
const stopReveal = watch(state.names, (names) => {
	if (!preview.value || !names.includes(preview.value)) return
	state.reveal(preview.value)
	stopReveal()
})

const crumbs: Crumb[] = [{ label: 'Commandes' }]
const drawer = ref<InstanceType<typeof CommandeDrawer> | null>(null)
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
	<BureauShell :crumbs="crumbs" active="commandes">
		<div class="bureau-work">
			<CommandesList :state="state" :selected="preview" @pick="showPreview" @open="showPreview" @changed="state.load(); drawer?.refresh()">
				<template #drawer>
					<CommandeDrawer v-if="preview" :id="preview" ref="drawer" :position="position" :no-prev="noPrev" :no-next="noNext" @prev="go(-1)" @next="go(1)" @close="showPreview()" @changed="state.load()" />
				</template>
			</CommandesList>
		</div>
	</BureauShell>
</template>
