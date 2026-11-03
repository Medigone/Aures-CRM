<script setup lang="ts">
import { computed } from 'vue'
import LucideRefreshCw from '~icons/lucide/refresh-cw'
import LucideCloudOff from '~icons/lucide/cloud-off'
import { useCommercialStore } from '@/stores/commercial'
import { relativeDays, formatTime } from '@/lib/format'

/** État de la synchro : hors-ligne, en cours, erreur ou heure de la dernière mise à jour ; un appui relance. */
const store = useCommercialStore()
const label = computed(() => {
	if (store.failed.length) return `${store.failed.length} à corriger`
	if (!store.online) return store.pendingCount ? `Hors ligne · ${store.pendingCount} en attente` : 'Hors ligne'
	if (store.syncing) return 'Synchro…'
	if (store.syncError) return 'Erreur de synchro'
	if (store.pendingCount) return `${store.pendingCount} en attente`
	const at = store.bundle?.synced_at
	if (!at) return 'Jamais synchronisé'
	const day = relativeDays(at)
	return day === "Aujourd'hui" ? `À jour ${formatTime(at)}` : `À jour : ${day.toLowerCase()}`
})
</script>

<template>
	<button
		type="button"
		class="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs"
		:class="store.syncError || store.failed.length ? 'border-outline-red-2 text-ink-red-3' : 'border-outline-gray-2 text-ink-gray-7'"
		:title="store.syncError || undefined"
		:disabled="store.syncing || !store.online"
		@click="store.sync()"
	>
		<LucideCloudOff v-if="!store.online" class="h-4 w-4" aria-hidden="true" />
		<LucideRefreshCw v-else class="h-4 w-4" :class="store.syncing && 'animate-spin'" aria-hidden="true" />
		{{ label }}
	</button>
</template>
