<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideSearch from '~icons/lucide/search'
import LucidePlus from '~icons/lucide/plus'
import LucideMapPin from '~icons/lucide/map-pin'
import LucideChevronDown from '~icons/lucide/chevron-down'
import PageHeader from '@/components/PageHeader.vue'
import ClientCard from '@/components/ClientCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition, distanceM, pickNearby, pointOf, sortByDistance, type GpsPoint } from '@/lib/geo'
import { normalizeSearch, parseServerDate } from '@/lib/format'
import type { Client } from '@/types'

const store = useCommercialStore()
const query = ref('')
const statut = ref<string | null>(null)
type Tri = 'nom' | 'visite' | 'proximite'
const tri = ref<Tri>('nom')
const position = ref<GpsPoint | null>(null)
const LIMIT_STEP = 60
const limit = ref(LIMIT_STEP)

const statuts = computed(() => store.references?.statuts_client ?? ['Prospect', 'Actif', 'Dormant', 'Perdu'])
const placeOf = (c: Client) => pointOf(c.lat, c.lon)

const filtered = computed(() => {
	const q = normalizeSearch(query.value)
	let rows = store.clients.filter((c) => {
		if (statut.value && c.statut !== statut.value) return false
		if (!q) return true
		return normalizeSearch([c.customer_name, c.name, c.wilaya, c.commune, c.contact_principal].join(' ')).includes(q)
	})
	if (tri.value === 'visite') rows = [...rows].sort((a, b) => (a.derniere_visite || '').localeCompare(b.derniere_visite || ''))
	if (tri.value === 'proximite') rows = sortByDistance(rows, position.value, placeOf)
	return rows
})
const visible = computed(() => filtered.value.slice(0, limit.value))

async function setTri(value: Tri) {
	tri.value = value
	limit.value = LIMIT_STEP
	if (value === 'proximite' && !position.value) position.value = await currentPosition()
}
const distanceTo = (c: Client) => {
	const at = placeOf(c)
	return tri.value === 'proximite' && position.value && at ? distanceM(position.value, at) : null
}

// Pistes de visite (venues de l'accueil) : clients proches non visités depuis 30 jours, clients actifs à revoir.
const lastSeen = (c: Client) => parseServerDate(c.derniere_visite ? `${c.derniere_visite} 00:00:00` : null)
const locating = ref(false)
const locateError = ref(false)
async function locate() {
	locating.value = true
	locateError.value = false
	position.value = await currentPosition()
	locateError.value = !position.value
	locating.value = false
}
const proches = computed(() => (position.value ? pickNearby(store.clients, position.value, placeOf, lastSeen, { radiusM: 5000, staleDays: 30 }).slice(0, 8) : []))
const STALE_DAYS = 60
const aRevoir = computed(() => {
	const limitTime = Date.now() - STALE_DAYS * 86400000
	return store.clients
		.filter((c) => c.statut === 'Actif')
		.filter((c) => {
			const seen = lastSeen(c)
			return !seen || seen.getTime() < limitTime
		})
		.sort((a, b) => (a.derniere_visite || '').localeCompare(b.derniere_visite || ''))
})
const showARevoir = ref(false)
const searching = computed(() => Boolean(query.value || statut.value))
const distanceFromHere = (c: Client) => {
	const at = placeOf(c)
	return position.value && at ? distanceM(position.value, at) : null
}
</script>

<template>
	<div>
		<PageHeader title="Clients" :subtitle="`${store.clients.length} dans votre portefeuille`">
			<template #actions>
				<RouterLink :to="{ name: 'NewProspect' }" class="icon-btn" aria-label="Nouveau prospect"><LucidePlus class="h-5 w-5" /></RouterLink>
			</template>
		</PageHeader>

		<div v-if="!searching" class="mb-5 space-y-2.5">
			<section class="card space-y-3 p-4">
				<div class="flex items-center justify-between gap-2">
					<div>
						<h2 class="text-[15px] font-semibold">À proximité</h2>
						<p class="text-xs text-ink-gray-6">À moins de 5 km, non visités depuis 30 jours</p>
					</div>
					<button type="button" class="btn-secondary min-h-9 px-3 text-sm" :disabled="locating" @click="locate">
						<LucideMapPin class="h-4 w-4" aria-hidden="true" />{{ locating ? 'Localisation…' : position ? 'Actualiser' : 'Me localiser' }}
					</button>
				</div>
				<p v-if="locateError" class="text-sm text-ink-red-3">Position indisponible : autorisez la localisation pour cette application.</p>
				<p v-else-if="position && !proches.length" class="text-sm text-ink-gray-6">Aucun client à revoir dans ce rayon.</p>
				<div v-if="proches.length" class="space-y-2">
					<ClientCard v-for="p in proches" :key="p.row.name" :client="p.row" :meters="p.meters" />
				</div>
			</section>
			<section v-if="aRevoir.length" class="card overflow-hidden">
				<button type="button" class="flex min-h-[54px] w-full items-center gap-3 px-4 text-left" :aria-expanded="showARevoir" @click="showARevoir = !showARevoir">
					<span class="min-w-0 flex-1">
						<span class="block text-[15px] font-semibold">Clients actifs à revoir</span>
						<span class="block text-xs text-ink-gray-6">Sans visite depuis plus de {{ STALE_DAYS }} jours</span>
					</span>
					<span class="text-sm text-ink-gray-6">{{ aRevoir.length }}</span>
					<LucideChevronDown class="h-[18px] w-[18px] text-ink-gray-6 transition" :class="showARevoir && 'rotate-180'" aria-hidden="true" />
				</button>
				<div v-if="showARevoir" class="space-y-2 px-3 pb-3">
					<ClientCard v-for="c in aRevoir.slice(0, 20)" :key="c.name" :client="c" :meters="distanceFromHere(c)" />
				</div>
			</section>
		</div>

		<label class="search-box mb-3">
			<LucideSearch class="h-5 w-5 text-ink-gray-5" aria-hidden="true" />
			<input v-model="query" type="search" class="min-h-11 w-full border-0 bg-transparent p-0 text-base focus:ring-0" placeholder="Nom, code, wilaya, contact…" aria-label="Rechercher un client" />
		</label>

		<div class="chip-scroller mb-2">
			<button type="button" :class="statut === null ? 'chip-on' : 'chip-off'" @click="statut = null">Tous</button>
			<button v-for="s in statuts" :key="s" type="button" :class="statut === s ? 'chip-on' : 'chip-off'" @click="statut = statut === s ? null : s">{{ s }}</button>
		</div>
		<div class="mb-3 flex items-center gap-2 text-sm text-ink-gray-6">
			<span>Trier :</span>
			<button type="button" :class="tri === 'nom' ? 'font-medium text-accent' : ''" @click="setTri('nom')">Nom</button>
			<span aria-hidden="true">·</span>
			<button type="button" :class="tri === 'visite' ? 'font-medium text-accent' : ''" @click="setTri('visite')">Dernière visite</button>
			<span aria-hidden="true">·</span>
			<button type="button" :class="tri === 'proximite' ? 'font-medium text-accent' : ''" @click="setTri('proximite')">Proximité</button>
		</div>

		<p v-if="!filtered.length" class="py-10 text-center text-sm text-ink-gray-6">Aucun client ne correspond.</p>
		<div class="space-y-2">
			<ClientCard v-for="c in visible" :key="c.name" :client="c" :meters="distanceTo(c)" />
		</div>
		<button v-if="filtered.length > visible.length" type="button" class="btn-secondary mt-3 w-full" @click="limit += LIMIT_STEP">
			Afficher plus ({{ filtered.length - visible.length }})
		</button>
	</div>
</template>
