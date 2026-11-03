<script setup lang="ts">
import { RouterLink } from 'vue-router'
import StatusPill from './StatusPill.vue'
import { relativeDays } from '@/lib/format'
import { formatDistance } from '@/lib/geo'
import type { Client } from '@/types'

defineProps<{ client: Client; meters?: number | null }>()
</script>

<template>
	<RouterLink :to="{ name: 'Client', params: { id: client.name } }" class="card-link p-3">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<p class="truncate font-medium">{{ client.customer_name }}</p>
				<p class="truncate text-sm text-ink-gray-6">
					{{ [client.commune, client.wilaya].filter(Boolean).join(' · ') || client.name }}
				</p>
			</div>
			<StatusPill :status="client.statut" />
		</div>
		<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-gray-6">
			<span>Visite : {{ relativeDays(client.derniere_visite).toLowerCase() }}</span>
			<span>{{ client.nb_articles }} article{{ client.nb_articles > 1 ? 's' : '' }}</span>
			<span v-if="meters != null">{{ formatDistance(meters) }}</span>
			<span v-if="client.grand_compte" class="font-medium text-accent">Grand compte</span>
		</div>
	</RouterLink>
</template>
