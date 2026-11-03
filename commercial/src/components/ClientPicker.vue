<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideSearch from '~icons/lucide/search'
import { useCommercialStore } from '@/stores/commercial'
import { normalizeSearch } from '@/lib/format'

/** Choix d'un client du portefeuille (recherche hors-ligne). */
const model = defineModel<string | null>({ required: true })
const store = useCommercialStore()
const query = ref('')
const selected = computed(() => (model.value ? store.clientsByName.get(model.value) ?? null : null))
const initials = computed(() =>
	(selected.value?.customer_name || '')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase())
		.join(''),
)
const matches = computed(() => {
	const q = normalizeSearch(query.value)
	if (!q) return []
	return store.clients.filter((c) => normalizeSearch(`${c.customer_name} ${c.name} ${c.commune ?? ''} ${c.wilaya ?? ''}`).includes(q)).slice(0, 8)
})
function choose(name: string) {
	model.value = name
	query.value = ''
}
</script>

<template>
	<div>
		<div v-if="selected" class="card flex items-center gap-3 p-3.5">
			<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-gray-2 text-sm font-semibold" aria-hidden="true">{{ initials }}</span>
			<div class="min-w-0 flex-1">
				<p class="truncate font-medium">{{ selected.customer_name }}</p>
				<p class="truncate text-sm text-ink-gray-6">{{ [selected.commune, selected.wilaya].filter(Boolean).join(' · ') || selected.name }}</p>
			</div>
			<button type="button" class="min-h-11 px-2 text-sm font-medium text-ink-gray-7" @click="model = null">Changer</button>
		</div>
		<template v-else>
			<label class="search-box">
				<LucideSearch class="h-5 w-5 text-ink-gray-5" aria-hidden="true" />
				<input v-model="query" type="search" class="min-h-12 w-full border-0 bg-transparent p-0 text-base focus:ring-0" placeholder="Rechercher un client…" aria-label="Rechercher un client" />
			</label>
			<div v-if="matches.length" class="card mt-2 divide-y divide-outline-gray-1 overflow-hidden">
				<button v-for="c in matches" :key="c.name" type="button" class="block w-full px-4 py-3 text-left active:bg-surface-gray-2" @click="choose(c.name)">
					<span class="block font-medium">{{ c.customer_name }}</span>
					<span class="block text-sm text-ink-gray-6">{{ [c.commune, c.wilaya].filter(Boolean).join(' · ') || c.name }}</span>
				</button>
			</div>
			<p v-else-if="query" class="mt-2 text-sm text-ink-gray-6">Aucun client ne correspond.</p>
		</template>
	</div>
</template>
