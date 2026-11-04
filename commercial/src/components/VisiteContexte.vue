<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { formatDay } from '@/lib/format'
import { formatMoney } from '@/lib/text'
import type { visiteContexte } from '@/lib/visites'

/** Ce qu'il faut savoir du client pendant une visite ; chaque ligne ouvre sa fiche (ou la visite précédente). */
defineProps<{ client: string; contexte: ReturnType<typeof visiteContexte> }>()
</script>

<template>
	<div class="card divide-y divide-outline-gray-1 overflow-hidden text-sm">
		<RouterLink
			:to="contexte.derniereVisite ? { name: 'Visit', params: { id: contexte.derniereVisite.name } } : { name: 'Client', params: { id: client } }"
			class="flex min-h-[52px] items-center justify-between gap-3 px-4 active:bg-surface-gray-2"
		>
			<span class="shrink-0 text-ink-gray-6">Dernière visite</span>
			<span class="min-w-0 truncate font-medium">
				<template v-if="contexte.derniereVisite">{{ formatDay(contexte.derniereVisite.date) }} · {{ contexte.derniereVisite.type_visite || 'Visite' }}</template>
				<template v-else>Aucune</template>
			</span>
		</RouterLink>
		<RouterLink :to="{ name: 'Client', params: { id: client } }" class="flex min-h-[52px] items-center justify-between gap-3 px-4 active:bg-surface-gray-2">
			<span class="text-ink-gray-6">Tickets ouverts</span><span class="font-medium tabular-nums">{{ contexte.tickets }}</span>
		</RouterLink>
		<RouterLink :to="{ name: 'Client', params: { id: client } }" class="flex min-h-[52px] items-center justify-between gap-3 px-4 active:bg-surface-gray-2">
			<span class="text-ink-gray-6">Commandes en cours</span>
			<span class="status-ink font-medium tabular-nums" :class="contexte.commandesEnRetard ? 'text-ink-red-3' : ''">
				{{ contexte.commandes }}<template v-if="contexte.commandesEnRetard">, dont {{ contexte.commandesEnRetard }} en retard</template>
			</span>
		</RouterLink>
		<RouterLink :to="{ name: 'Client', params: { id: client } }" class="flex min-h-[52px] items-center justify-between gap-3 px-4 active:bg-surface-gray-2">
			<span class="text-ink-gray-6">Réclamations ouvertes</span><span class="font-medium tabular-nums">{{ contexte.reclamations }}</span>
		</RouterLink>
		<RouterLink v-if="contexte.solde" :to="{ name: 'Client', params: { id: client } }" class="flex min-h-[52px] items-center justify-between gap-3 px-4 active:bg-surface-gray-2">
			<span class="text-ink-gray-6">Solde de créance</span><span class="font-medium tabular-nums">{{ formatMoney(contexte.solde) }}</span>
		</RouterLink>
	</div>
</template>
