<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay } from '@/lib/format'
import { htmlToText } from '@/lib/text'

/** Réclamation client (traitée par Coordination) : consultation seule. */
const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const reclamation = computed(() => store.reclamationsByName.get(props.id) ?? null)
</script>

<template>
	<div v-if="!reclamation" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Réclamation introuvable" :back="{ name: 'Suivi' }" />
		Cette réclamation n'est pas sur cet appareil.
	</div>
	<div v-else>
		<PageHeader :title="reclamation.type_reclamation || 'Réclamation'" :subtitle="`${reclamation.nom_client || reclamation.client} · ${reclamation.name}`" :back="{ name: 'Suivi' }">
			<template #actions><StatusPill :status="reclamation.status" /></template>
		</PageHeader>
		<section class="card mb-4 divide-y divide-outline-gray-1 text-sm">
			<RouterLink :to="{ name: 'Client', params: { id: reclamation.client } }" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Client</span><span class="font-medium text-accent">{{ reclamation.nom_client || reclamation.client }}</span>
			</RouterLink>
			<div v-if="reclamation.procede" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Procédé</span><span class="font-medium">{{ reclamation.procede }}</span></div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Ouverte le</span><span class="font-medium">{{ formatDay(reclamation.date_creation) }}</span></div>
			<div v-if="reclamation.date_echeance" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Échéance</span><span class="font-medium" :class="reclamation.status === 'En retard' && 'text-ink-red-3'">{{ formatDay(reclamation.date_echeance) }}</span>
			</div>
			<div v-if="reclamation.date_resolution" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Résolue le</span><span class="font-medium">{{ formatDay(reclamation.date_resolution) }}</span></div>
			<RouterLink v-if="reclamation.visite && store.visitesByName.has(reclamation.visite)" :to="{ name: 'Visit', params: { id: reclamation.visite } }" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Visite</span><span class="font-medium text-accent">{{ reclamation.visite }}</span>
			</RouterLink>
		</section>
		<template v-if="reclamation.observations">
			<h2 class="section-title mb-2">Observations</h2>
			<p class="card mb-4 whitespace-pre-line p-3 text-sm">{{ htmlToText(reclamation.observations) }}</p>
		</template>
		<template v-if="reclamation.traitement">
			<h2 class="section-title mb-2">Traitement</h2>
			<p class="card mb-4 whitespace-pre-line p-3 text-sm">{{ htmlToText(reclamation.traitement) }}</p>
		</template>
	</div>
</template>
