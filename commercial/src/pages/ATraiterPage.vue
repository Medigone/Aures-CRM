<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LucideChevronRight from '~icons/lucide/chevron-right'
import PageHeader from '@/components/PageHeader.vue'
import { useCommercialStore } from '@/stores/commercial'
import { useATraiter } from '@/lib/aTraiter'
import { formatDay, formatTime } from '@/lib/format'
import { formatMoney } from '@/lib/text'

const store = useCommercialStore()
const { ticketsAlerte, reclamationsRetard, relances, rappels, total } = useATraiter()
const clientName = (name?: string | null) => (name && store.clientsByName.get(name)?.customer_name) || name || '—'
</script>

<template>
	<div>
		<PageHeader title="À traiter" :subtitle="total ? `${total} élément${total > 1 ? 's' : ''}` : null" :back="{ name: 'Today' }" />
		<p v-if="!total" class="card p-6 text-center text-ink-gray-6">Rien à traiter pour le moment.</p>

		<section v-if="ticketsAlerte.length" class="mb-6">
			<div class="mb-2.5 flex items-baseline justify-between">
				<h2 class="section-title">Décisions sur mes tickets</h2><span class="text-sm text-ink-gray-6">{{ ticketsAlerte.length }}</span>
			</div>
			<div class="card divide-y divide-outline-gray-1 overflow-hidden">
				<RouterLink v-for="x in ticketsAlerte" :key="x.t.name" :to="{ name: 'Ticket', params: { id: x.t.name } }" class="flex items-center gap-3 px-4 py-3.5 active:bg-surface-gray-2">
					<span class="min-w-0 flex-1">
						<span class="block truncate font-semibold">{{ x.t.request_type }} · {{ x.t.customer_name || clientName(x.t.client) }}</span>
						<span class="block text-sm font-medium text-ink-amber-3">{{ x.alerte }}</span>
					</span>
					<LucideChevronRight class="h-[18px] w-[18px] shrink-0 text-ink-gray-6" aria-hidden="true" />
				</RouterLink>
			</div>
		</section>

		<section v-if="reclamationsRetard.length" class="mb-6">
			<div class="mb-2.5 flex items-baseline justify-between">
				<h2 class="section-title">Réclamations en retard</h2><span class="text-sm text-ink-gray-6">{{ reclamationsRetard.length }}</span>
			</div>
			<div class="card divide-y divide-outline-gray-1 overflow-hidden">
				<RouterLink v-for="r in reclamationsRetard" :key="r.name" :to="{ name: 'Reclamation', params: { id: r.name } }" class="flex items-center gap-3 px-4 py-3.5 active:bg-surface-gray-2">
					<span class="min-w-0 flex-1">
						<span class="block truncate font-semibold">Réclamation · {{ r.nom_client || clientName(r.client) }}</span>
						<span class="block text-sm font-medium text-ink-red-3">En retard (échéance {{ formatDay(r.date_echeance) }})</span>
					</span>
					<LucideChevronRight class="h-[18px] w-[18px] shrink-0 text-ink-gray-6" aria-hidden="true" />
				</RouterLink>
			</div>
		</section>

		<section v-if="relances.length" class="mb-6">
			<div class="mb-2.5 flex items-baseline justify-between">
				<h2 class="section-title">Relances de créances</h2><span class="text-sm text-ink-gray-6">{{ relances.length }}</span>
			</div>
			<div class="card divide-y divide-outline-gray-1 overflow-hidden">
				<RouterLink v-for="c in relances" :key="c.name" :to="{ name: 'Client', params: { id: c.client } }" class="flex items-center gap-3 px-4 py-3.5 active:bg-surface-gray-2">
					<span class="min-w-0 flex-1">
						<span class="block truncate font-semibold">{{ c.nom_client || clientName(c.client) }}</span>
						<span class="block text-sm text-ink-gray-6">{{ formatMoney(c.solde_restant) }} · relance prévue le {{ formatDay(c.date_prochaine_relance) }}</span>
					</span>
					<LucideChevronRight class="h-[18px] w-[18px] shrink-0 text-ink-gray-6" aria-hidden="true" />
				</RouterLink>
			</div>
		</section>

		<section v-if="rappels.length" class="mb-6">
			<div class="mb-2.5 flex items-baseline justify-between">
				<h2 class="section-title">Appels à rappeler</h2><span class="text-sm text-ink-gray-6">{{ rappels.length }}</span>
			</div>
			<div class="card divide-y divide-outline-gray-1 overflow-hidden">
				<RouterLink v-for="a in rappels" :key="a.name" :to="{ name: 'Appel', params: { id: a.name } }" class="flex items-center gap-3 px-4 py-3.5 active:bg-surface-gray-2">
					<span class="min-w-0 flex-1">
						<span class="block truncate font-semibold">{{ clientName(a.client) }}</span>
						<span class="block text-sm text-ink-gray-6">{{ a.type }}<template v-if="a.date_rappel"> · {{ formatTime(a.date_rappel) }}</template></span>
					</span>
					<LucideChevronRight class="h-[18px] w-[18px] shrink-0 text-ink-gray-6" aria-hidden="true" />
				</RouterLink>
			</div>
		</section>
	</div>
</template>
