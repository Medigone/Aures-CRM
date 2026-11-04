<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import SaleLines from '@/components/SaleLines.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay } from '@/lib/format'
import { formatMoney, todayIso } from '@/lib/text'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const devis = computed(() => store.devisByName.get(props.id) ?? null)
const commandes = computed(() => store.commandes.filter((c) => c.devis === props.id))
const expire = computed(() => Boolean(devis.value?.valid_till && devis.value.valid_till < todayIso()))
</script>

<template>
	<div v-if="!devis" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Devis introuvable" :back="{ name: 'Suivi' }" />
		Ce devis n'est pas sur cet appareil (devis des 12 derniers mois).
	</div>
	<div v-else>
		<PageHeader :title="devis.name" :subtitle="devis.customer_name || devis.client" :back="{ name: 'Suivi' }">
			<template #actions><StatusPill :status="devis.docstatus === 0 ? 'Brouillon' : devis.status" /></template>
		</PageHeader>
		<section class="card mb-4 divide-y divide-outline-gray-1 text-sm">
			<RouterLink :to="{ name: 'Client', params: { id: devis.client } }" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Client</span><span class="font-medium text-accent">{{ devis.customer_name || devis.client }}</span>
			</RouterLink>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Date</span><span class="font-medium">{{ formatDay(devis.date) }}</span></div>
			<div v-if="devis.valid_till" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Valable jusqu'au</span><span class="font-medium" :class="expire && 'text-ink-red-3'">{{ formatDay(devis.valid_till) }}</span>
			</div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Montant</span><span class="font-semibold">{{ formatMoney(devis.grand_total, devis.currency) }}</span></div>
			<div v-if="devis.statut_commande" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Commande</span><StatusPill :status="devis.statut_commande" /></div>
			<div v-if="devis.demande_faisabilite" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Demande de faisabilité</span><span class="font-medium">{{ devis.demande_faisabilite }}</span></div>
		</section>
		<h2 class="section-title mb-2">Articles</h2>
		<SaleLines :lignes="devis.lignes" :currency="devis.currency" class="mb-4" />
		<template v-if="commandes.length">
			<h2 class="section-title mb-2">Commandes</h2>
			<div class="space-y-2">
				<RouterLink v-for="c in commandes" :key="c.name" :to="{ name: 'Commande', params: { id: c.name } }" class="card-link flex justify-between gap-2 p-3 text-sm">
					<span class="font-medium">{{ c.name }}<template v-if="c.bon_commande_client"> · BC {{ c.bon_commande_client }}</template></span>
					<StatusPill :status="c.status" />
				</RouterLink>
			</div>
		</template>
	</div>
</template>
