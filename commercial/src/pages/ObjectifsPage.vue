<script setup lang="ts">
import { computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { METRIC_LABELS, PERIOD_LABELS, formatMetric, progressOf, visitsDoneSince } from '@/lib/objectifs'
import { formatDay, relativeDays } from '@/lib/format'
import { formatMoney, todayIso } from '@/lib/text'

/** Mes objectifs (Pilotage Commercial) : cibles de la période, indicateurs et actions du manager. */
const store = useCommercialStore()
const objectifs = computed(() => store.bundle?.objectifs ?? null)
const monthStart = `${todayIso().slice(0, 7)}-01`
const visitesDuMois = computed(() => visitsDoneSince(store.visites, monthStart))

const indicateurs = computed(() => {
	const o = objectifs.value
	if (!o) return []
	return [
		["CA réalisé", formatMoney(o.revenue_achieved)],
		['Atteinte des objectifs', formatMetric(o.target_achievement_pct, 'percent')],
		['Visites réalisées', formatMetric(o.visits_completed, 'count')],
		['Taux de conversion', formatMetric(o.conversion_rate, 'percent')],
		['Couverture du portefeuille', formatMetric(o.coverage_rate, 'percent')],
		['Clients actifs / portefeuille', `${formatMetric(o.active_customers_count, 'count')} / ${formatMetric(o.portfolio_accounts_count, 'count')}`],
	]
})
</script>

<template>
	<div>
		<PageHeader title="Mes objectifs" :subtitle="objectifs?.sales_zone || objectifs?.commercial_type || null" :back="{ name: 'Today' }" />

		<p v-if="!objectifs" class="card p-6 text-center text-sm text-ink-gray-6">
			Aucun pilotage commercial n'est encore défini pour vous. Votre superviseur le crée dans le CRM.
		</p>
		<template v-else>
			<p class="mb-3 text-xs text-ink-gray-6">
				Indicateurs recalculés chaque nuit<template v-if="objectifs.stats_last_refresh_at"> · dernière mise à jour : {{ relativeDays(objectifs.stats_last_refresh_at).toLowerCase() }}</template>.
				Ce mois-ci, {{ visitesDuMois }} visite(s) terminée(s) sur cet appareil.
			</p>

			<section class="mb-6">
				<h2 class="section-title mb-2">Cibles en cours</h2>
				<p v-if="!objectifs.cibles.length" class="text-sm text-ink-gray-6">Aucune cible sur la période en cours.</p>
				<div class="space-y-2">
					<div v-for="(c, i) in objectifs.cibles" :key="i" class="card p-3">
						<div class="mb-1 flex items-baseline justify-between gap-2">
							<span class="font-medium">{{ METRIC_LABELS[c.metric_code] || c.metric_code }}</span>
							<span class="text-xs text-ink-gray-6">{{ PERIOD_LABELS[c.period_type || ''] || c.period_type }}</span>
						</div>
						<div class="mb-1 flex justify-between text-sm">
							<span class="tabular-nums">{{ formatMetric(c.achieved_value, c.unit) }} / {{ formatMetric(c.target_value, c.unit) }}</span>
							<span class="font-semibold tabular-nums">{{ Math.round(c.achievement_pct || 0) }} %</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-surface-gray-2" role="progressbar" :aria-valuenow="progressOf(c)" aria-valuemin="0" aria-valuemax="100">
							<div class="h-full rounded-full" :class="progressOf(c) >= 100 ? 'bg-surface-green-3' : 'bg-accent'" :style="{ width: `${progressOf(c)}%` }" />
						</div>
						<p v-if="c.period_end" class="mt-1 text-xs text-ink-gray-6">Jusqu'au {{ formatDay(c.period_end) }}</p>
					</div>
				</div>
			</section>

			<section class="mb-6">
				<h2 class="section-title mb-2">Indicateurs</h2>
				<div class="card divide-y divide-outline-gray-1 text-sm">
					<div v-for="[label, value] in indicateurs" :key="label" class="flex justify-between gap-4 px-3 py-2.5">
						<span class="text-ink-gray-6">{{ label }}</span><span class="font-medium tabular-nums">{{ value }}</span>
					</div>
					<div v-if="objectifs.monthly_revenue_target" class="flex justify-between gap-4 px-3 py-2.5">
						<span class="text-ink-gray-6">Objectif CA mensuel</span><span class="font-medium">{{ formatMoney(objectifs.monthly_revenue_target) }}</span>
					</div>
					<div v-if="objectifs.visit_target_current" class="flex justify-between gap-4 px-3 py-2.5">
						<span class="text-ink-gray-6">Objectif de visites</span><span class="font-medium">{{ objectifs.visit_target_current }}</span>
					</div>
					<div v-if="objectifs.next_review_date" class="flex justify-between gap-4 px-3 py-2.5">
						<span class="text-ink-gray-6">Prochaine revue</span><span class="font-medium">{{ formatDay(objectifs.next_review_date) }}</span>
					</div>
				</div>
			</section>

			<section v-if="objectifs.actions.length">
				<h2 class="section-title mb-2">Actions de suivi</h2>
				<div class="space-y-2">
					<div v-for="(a, i) in objectifs.actions" :key="i" class="card p-3 text-sm">
						<div class="flex justify-between gap-2">
							<span class="font-medium">{{ a.action_title }}</span>
							<StatusPill :status="a.status" />
						</div>
						<p class="text-ink-gray-6">
							{{ a.action_type }}<template v-if="a.priority"> · priorité {{ a.priority.toLowerCase() }}</template><template v-if="a.due_date"> · avant le {{ formatDay(a.due_date) }}</template>
						</p>
						<p v-if="a.description" class="mt-1 text-ink-gray-7">{{ a.description }}</p>
					</div>
				</div>
			</section>
		</template>
	</div>
</template>
