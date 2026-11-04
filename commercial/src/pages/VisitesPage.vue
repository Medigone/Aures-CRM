<script lang="ts">
import { ref } from 'vue'

/** Recherche de la page Visites : conservée au retour d'une fiche. */
const rechercheVisites = ref('')
</script>

<script setup lang="ts">
import { computed, nextTick } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import LucideCalendar from '~icons/lucide/calendar'
import LucideSearch from '~icons/lucide/search'
import PageHeader from '@/components/PageHeader.vue'
import SuiviCard from '@/components/SuiviCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { visitesFiltres, visitesGroupes, visitesResume } from '@/lib/visites'
import { todayIso } from '@/lib/text'
import type { Visite } from '@/types'

/** Toutes les visites du portefeuille (12 mois) ; le filtre est dans l'URL pour le retrouver au retour d'une fiche. */
const store = useCommercialStore()
const route = useRoute()
const router = useRouter()
const today = todayIso()
const query = rechercheVisites

const communes = computed(() => new Map((store.references?.communes ?? []).map((c) => [c.name, c.commune])))
const wilayas = computed(() => new Map((store.references?.wilayas ?? []).map((w) => [w.name, w.wilaya])))
const lieu = (v: Visite) => (v.commune && communes.value.get(v.commune)) || (v.wilaya && wilayas.value.get(v.wilaya)) || null
const nomClient = (client: string) => store.clientsByName.get(client)?.customer_name

const filtres = computed(() => visitesFiltres(store.visites, today))
const filtre = computed(() => filtres.value.find((f) => f.key === route.query.filtre)?.key ?? filtres.value[0].key)
const groupes = computed(() => visitesGroupes(store.visites, filtre.value, query.value, { today, lieu, nomClient }))
const resume = computed(() => visitesResume(store.visites, today))

function pickFiltre(key: string) {
	router.replace({ query: { ...route.query, filtre: key === filtres.value[0].key ? undefined : key } })
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
		<PageHeader title="Visites" :subtitle="resume">
			<template #actions>
				<RouterLink :to="{ name: 'Week' }" class="icon-btn" aria-label="Ma semaine"><LucideCalendar class="h-5 w-5" aria-hidden="true" /></RouterLink>
				<button type="button" class="icon-btn" :aria-label="searchOpen ? 'Fermer la recherche' : 'Rechercher'" :aria-expanded="searchOpen" @click="toggleSearch">
					<LucideSearch class="h-5 w-5" aria-hidden="true" />
				</button>
			</template>
		</PageHeader>

		<div class="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 space-y-3 bg-surface-gray-1 px-4 pb-3 pt-1 before:absolute before:inset-x-0 before:bottom-full before:h-[env(safe-area-inset-top)] before:bg-surface-gray-1 dark:bg-surface-white dark:before:bg-surface-white">
			<label v-if="searchOpen" class="search-box">
				<LucideSearch class="h-5 w-5 shrink-0 text-ink-gray-5" aria-hidden="true" />
				<input ref="searchInput" v-model="query" type="search" class="min-h-11 w-full border-0 bg-transparent p-0 text-base focus:ring-0" placeholder="Client, type, commune…" aria-label="Rechercher une visite" />
			</label>
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
			<p class="text-sm text-ink-gray-6">{{ query ? `Aucun résultat pour « ${query} ».` : 'Aucune visite ici.' }}</p>
			<button v-if="query" type="button" class="btn-secondary min-h-11" @click="query = ''">Effacer la recherche</button>
			<RouterLink v-else :to="{ name: 'NewVisit' }" class="btn-secondary min-h-11">Planifier une visite</RouterLink>
		</div>

		<section v-for="g in groupes" :key="g.title ?? 'liste'" class="mb-4 space-y-2">
			<div class="flex items-baseline justify-between px-1">
				<h2 class="text-base font-semibold">{{ g.title }}</h2>
				<span class="text-sm tabular-nums text-ink-gray-6">{{ g.hint }}</span>
			</div>
			<SuiviCard v-for="r in g.rows" :key="r.key" :row="r" />
		</section>
	</div>
</template>
