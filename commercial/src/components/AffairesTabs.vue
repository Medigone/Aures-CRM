<script lang="ts">
import { ref } from 'vue'

/** Recherche de la page Suivi : conservée au retour d'une fiche. */
const rechercheSuivi = ref('')
</script>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LucideSearch from '~icons/lucide/search'
import PageHeader from './PageHeader.vue'
import SuiviCard from './SuiviCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { isSegment, suiviFiltres, suiviGroupes, suiviResume, suiviTuiles, type Segment, type SuiviData } from '@/lib/suivi'
import { todayIso } from '@/lib/text'

/**
 * Tickets, devis, commandes et réclamations : du portefeuille (page Suivi, onglet et filtre dans l'URL pour les
 * retrouver au retour d'une fiche), ou d'un client (`client`, sans en-tête).
 */
const props = defineProps<{ client?: string }>()
const store = useCommercialStore()
const route = useRoute()
const router = useRouter()
const today = todayIso()

const mine = <T extends { client: string }>(rows: T[]) => (props.client ? rows.filter((r) => r.client === props.client) : rows)
const data = computed<SuiviData>(() => ({
	tickets: mine(store.tickets),
	devis: mine(store.devis),
	commandes: mine(store.commandes),
	reclamations: mine(store.reclamations),
}))

// Fiche client : état local, l'URL est celle de la fiche et son onglet n'y figure pas.
const segmentLocal = ref<Segment>('tickets')
const filtreLocal = ref<string | null>(null)
const query = props.client ? ref('') : rechercheSuivi

const segment = computed<Segment>(() => {
	if (props.client) return segmentLocal.value
	return isSegment(route.query.onglet) ? route.query.onglet : 'tickets'
})
const tuiles = computed(() => suiviTuiles(data.value))
const filtres = computed(() => suiviFiltres(data.value, segment.value, today))
const filtre = computed(() => {
	const wanted = props.client ? filtreLocal.value : route.query.filtre
	return filtres.value.find((f) => f.key === wanted)?.key ?? filtres.value[0].key
})
const groupes = computed(() => suiviGroupes(data.value, segment.value, filtre.value, query.value, { today, client: props.client }))
const resume = computed(() => suiviResume(data.value))

function pickSegment(key: Segment) {
	if (props.client) {
		segmentLocal.value = key
		filtreLocal.value = null
	} else {
		router.replace({ query: { ...route.query, onglet: key === 'tickets' ? undefined : key, filtre: undefined } })
	}
}
function pickFiltre(key: string) {
	if (props.client) filtreLocal.value = key
	else router.replace({ query: { ...route.query, filtre: key === filtres.value[0].key ? undefined : key } })
}

const searchOpen = ref(!!query.value)
const searchInput = ref<HTMLInputElement | null>(null)
async function toggleSearch() {
	searchOpen.value = !searchOpen.value
	if (searchOpen.value) {
		await nextTick()
		searchInput.value?.focus()
	} else {
		query.value = ''
	}
}

</script>

<template>
	<div>
		<PageHeader v-if="!client" title="Suivi" :subtitle="resume">
			<template #actions>
				<button type="button" class="icon-btn" :aria-label="searchOpen ? 'Fermer la recherche' : 'Rechercher'" :aria-expanded="searchOpen" @click="toggleSearch">
					<LucideSearch class="h-5 w-5" aria-hidden="true" />
				</button>
			</template>
		</PageHeader>

		<!-- En-tête de liste : reste visible au défilement sur la page Suivi. -->
		<div
			class="space-y-3 pb-3"
			:class="!client && 'sticky top-[env(safe-area-inset-top)] z-10 -mx-4 bg-surface-gray-1 px-4 pt-1 before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top)] before:bg-surface-gray-1 dark:bg-surface-white dark:before:bg-surface-white'"
		>
			<label v-if="client || searchOpen" class="search-box">
				<LucideSearch class="h-5 w-5 shrink-0 text-ink-gray-5" aria-hidden="true" />
				<input ref="searchInput" v-model="query" type="search" class="min-h-11 w-full border-0 bg-transparent p-0 text-base focus:ring-0" placeholder="Client, article, n° de BC…" aria-label="Rechercher" />
			</label>

			<div class="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Type d'affaire">
				<button
					v-for="t in tuiles"
					:key="t.key"
					type="button"
					role="tab"
					:aria-selected="segment === t.key"
					class="relative flex min-h-[62px] flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-2 transition active:scale-[0.97]"
					:class="segment === t.key ? 'bg-primary text-on-primary' : 'bg-surface-white text-ink-gray-9 dark:bg-surface-cards'"
					@click="pickSegment(t.key)"
				>
					<span class="text-xl font-bold leading-tight tabular-nums">{{ t.count }}</span>
					<span class="text-[11px] leading-tight" :class="segment === t.key ? 'font-semibold' : 'font-medium'">{{ t.label }}</span>
					<span v-if="t.alertes" class="status-ink absolute right-2 top-2 h-2 w-2 rounded-full bg-current text-ink-red-3">
						<span class="sr-only">{{ t.alertes }} à traiter</span>
					</span>
				</button>
			</div>

			<div class="chip-scroller">
				<button
					v-for="f in filtres"
					:key="f.key"
					type="button"
					class="gap-1.5 whitespace-nowrap"
					:class="filtre === f.key ? 'chip-on' : 'chip-off'"
					:aria-pressed="filtre === f.key"
					@click="pickFiltre(f.key)"
				>
					{{ f.label }}<span class="font-medium tabular-nums opacity-70">{{ f.count }}</span>
				</button>
			</div>
		</div>

		<div v-if="!groupes.length" class="flex flex-col items-center gap-3 py-10 text-center">
			<p class="text-sm text-ink-gray-6">{{ query ? `Aucun résultat pour « ${query} ».` : 'Rien ici pour le moment.' }}</p>
			<button v-if="query" type="button" class="btn-secondary min-h-11" @click="query = ''">Effacer la recherche</button>
		</div>

		<section v-for="g in groupes" :key="g.title ?? 'liste'" class="mb-4 space-y-2">
			<div v-if="g.title" class="flex items-baseline justify-between px-1">
				<h2 class="text-base font-semibold">{{ g.title }}</h2>
				<span v-if="g.hint" class="text-sm tabular-nums text-ink-gray-6">{{ g.hint }}</span>
			</div>
			<SuiviCard v-for="r in g.rows" :key="r.key" :row="r" />
		</section>
	</div>
</template>
