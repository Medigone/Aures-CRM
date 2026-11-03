<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useCommercialStore } from '@/stores/commercial'
import { formatMoney } from '@/lib/text'
import type { LigneVente } from '@/types'

defineProps<{ lignes: LigneVente[]; currency: string }>()
const store = useCommercialStore()
</script>

<template>
	<div class="card divide-y divide-outline-gray-1 text-sm">
		<div v-for="(l, i) in lignes" :key="`${l.item_code}-${i}`" class="px-3 py-2.5">
			<RouterLink v-if="store.articlesByName.has(l.item_code)" :to="{ name: 'Article', params: { id: l.item_code } }" class="font-medium text-accent">{{ l.item_name || l.item_code }}</RouterLink>
			<p v-else class="font-medium">{{ l.item_name || l.item_code }}</p>
			<p class="text-ink-gray-6">{{ new Intl.NumberFormat('fr-FR').format(l.qty) }} × {{ formatMoney(l.rate, currency) }} = {{ formatMoney(l.amount, currency) }}</p>
		</div>
	</div>
</template>
