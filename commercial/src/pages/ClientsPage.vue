<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideSearch from '~icons/lucide/search'
import PageHeader from '@/components/PageHeader.vue'
import SyncPill from '@/components/SyncPill.vue'
import ClientCard from '@/components/ClientCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition, distanceM, pointOf, sortByDistance, type GpsPoint } from '@/lib/geo'
import { normalizeSearch } from '@/lib/format'
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
</script>

<template>
	<div>
		<PageHeader title="Clients" :subtitle="`${store.clients.length} dans votre portefeuille`">
			<template #actions><SyncPill /></template>
		</PageHeader>

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
