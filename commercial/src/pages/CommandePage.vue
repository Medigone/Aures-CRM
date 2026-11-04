<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import SaleLines from '@/components/SaleLines.vue'
import { useCommercialStore } from '@/stores/commercial'
import { fabricationProgress } from '@/lib/affaires'
import { formatDay } from '@/lib/format'
import { formatMoney } from '@/lib/text'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const commande = computed(() => store.commandesByName.get(props.id) ?? null)
const progress = computed(() => fabricationProgress(commande.value?.fabrication))
const articleName = (code: string | null) => (code && store.articlesByName.get(code)?.designation) || code || ''
const percent = (value: number) => `${Math.round(value || 0)} %`
</script>

<template>
	<div v-if="!commande" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Commande introuvable" :back="{ name: 'Suivi' }" />
		Cette commande n'est pas sur cet appareil (commandes des 12 derniers mois).
	</div>
	<div v-else>
		<PageHeader :title="commande.name" :subtitle="commande.customer_name || commande.client" :back="{ name: 'Suivi' }">
			<template #actions><StatusPill :status="commande.docstatus === 0 ? 'Brouillon' : commande.status" /></template>
		</PageHeader>

		<section class="card mb-4 divide-y divide-outline-gray-1 text-sm">
			<RouterLink :to="{ name: 'Client', params: { id: commande.client } }" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Client</span><span class="font-medium text-accent">{{ commande.customer_name || commande.client }}</span>
			</RouterLink>
			<div v-if="commande.bon_commande_client" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">BC client</span><span class="font-medium">{{ commande.bon_commande_client }}<template v-if="commande.date_bon_commande"> du {{ formatDay(commande.date_bon_commande) }}</template></span>
			</div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Date</span><span class="font-medium">{{ formatDay(commande.date) }}</span></div>
			<div v-if="commande.delivery_date" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Livraison prévue</span><span class="font-medium">{{ formatDay(commande.delivery_date) }}</span></div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Livré / facturé</span><span class="font-medium">{{ percent(commande.per_delivered) }} / {{ percent(commande.per_billed) }}</span></div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Montant</span><span class="font-semibold">{{ formatMoney(commande.grand_total, commande.currency) }}</span></div>
			<RouterLink v-if="commande.devis && store.devisByName.has(commande.devis)" :to="{ name: 'Devis', params: { id: commande.devis } }" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Devis</span><span class="font-medium text-accent">{{ commande.devis }}</span>
			</RouterLink>
		</section>

		<section class="mb-4">
			<h2 class="section-title mb-2">Fabrication</h2>
			<p v-if="!progress" class="text-sm text-ink-gray-6">Pas encore de dossier de fabrication.</p>
			<div v-else class="card p-3">
				<div class="mb-1 flex justify-between text-sm"><span>{{ progress.label }}</span><span class="font-semibold tabular-nums">{{ progress.percent }} %</span></div>
				<div class="h-2 overflow-hidden rounded-full bg-surface-gray-2" role="progressbar" :aria-valuenow="progress.percent" aria-valuemin="0" aria-valuemax="100">
					<div class="h-full rounded-full bg-accent" :style="{ width: `${progress.percent}%` }" />
				</div>
				<p v-if="commande.fabrication?.dossier" class="mt-3 flex justify-between text-sm">
					<span class="text-ink-gray-6">Dossier {{ commande.fabrication.dossier.name }}</span><StatusPill :status="commande.fabrication.dossier.status" />
				</p>
				<ul v-if="commande.fabrication?.ordres.length" class="mt-3 space-y-2 text-sm">
					<li v-for="o in commande.fabrication.ordres" :key="o.name" class="rounded-lg bg-surface-gray-1 p-2">
						<div class="flex justify-between gap-2"><span class="font-medium">{{ articleName(o.article) || o.name }}</span><StatusPill :status="o.status" /></div>
						<p class="text-ink-gray-6">
							{{ new Intl.NumberFormat('fr-FR').format(o.quantite_produite || 0) }} / {{ new Intl.NumberFormat('fr-FR').format(o.quantite_a_produire || 0) }}
							<template v-if="o.date_fin_prevue"> · fin prévue {{ formatDay(o.date_fin_prevue) }}</template>
							<template v-if="o.priorite && o.priorite !== 'Normale'"> · {{ o.priorite }}</template>
						</p>
					</li>
				</ul>
				<ul v-else-if="commande.fabrication?.etudes.length" class="mt-3 space-y-1 text-sm">
					<li v-for="e in commande.fabrication.etudes" :key="e.name" class="flex justify-between gap-2">
						<span>{{ e.nom_article || e.article || e.name }}</span><StatusPill :status="e.status" />
					</li>
				</ul>
			</div>
		</section>

		<h2 class="section-title mb-2">Articles</h2>
		<SaleLines :lignes="commande.lignes" :currency="commande.currency" />
	</div>
</template>
