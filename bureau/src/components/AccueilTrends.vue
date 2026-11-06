<script setup lang="ts">
import { computed, ref } from 'vue'
import { chartMax, chartTicks, loadChartsVisible, monthLong, monthShort, saveChartsVisible, type AccueilData } from '@/lib/accueil'

/** Les tendances : le rythme des tickets, l'ancienneté de ce qui reste ouvert et la complétude des fiches. */
const props = defineProps<{ trends: NonNullable<AccueilData['trends']> }>()

const PLOT_HEIGHT = 110

const visible = ref(loadChartsVisible())
const table = ref(false)
const hoveredMonth = ref<number | null>(null)

function toggleVisible() {
	visible.value = !visible.value
	saveChartsVisible(visible.value)
}

const monthMax = computed(() => chartMax(props.trends.months.flatMap((row) => [row.received, row.closed])))
const ticks = computed(() => chartTicks(monthMax.value))
const barHeight = (value: number, max: number) => `${Math.round((value * PLOT_HEIGHT) / max)}px`
const months = computed(() =>
	props.trends.months.map((row) => ({
		...row,
		short: monthShort(row.month),
		long: monthLong(row.month),
		aria: `${monthLong(row.month)} : ${row.received} reçus, ${row.closed} clos`,
	})),
)
const period = computed(() => {
	const rows = months.value
	return rows.length ? `${rows[0].long} à ${rows[rows.length - 1].long}` : ''
})
const totals = computed(() => ({
	received: props.trends.months.reduce((sum, row) => sum + row.received, 0),
	closed: props.trends.months.reduce((sum, row) => sum + row.closed, 0),
}))
const readout = computed(() => (hoveredMonth.value === null ? `Sur 12 mois : ${totals.value.received} reçus, ${totals.value.closed} clos` : months.value[hoveredMonth.value].aria))

const ageMax = computed(() => Math.max(1, ...props.trends.ages.map((row) => row.count)))
const openTotal = computed(() => props.trends.ages.reduce((sum, row) => sum + row.count, 0))
const ageAria = computed(() => `Tickets ouverts par ancienneté : ${props.trends.ages.map((row) => `${row.label}, ${row.count}`).join(' ; ')}`)

const complete = computed(() =>
	[
		{ label: 'Clients', value: props.trends.completeness.clients },
		{ label: 'Articles', value: props.trends.completeness.articles },
	].flatMap(({ label, value }) => (value ? [{ label, ...value }] : [])),
)
</script>

<template>
	<section class="accueil-trends" aria-label="Tendances">
		<div class="accueil-trends-head">
			<h2 class="accueil-title">Tendances</h2>
			<button v-if="visible" type="button" class="accueil-pill" :aria-pressed="table" @click="table = !table">{{ table ? 'Voir les graphiques' : 'Voir en tableau' }}</button>
			<button type="button" class="accueil-pill" @click="toggleVisible">{{ visible ? 'Masquer' : 'Afficher les tendances' }}</button>
		</div>
		<div v-if="visible" class="accueil-charts">
			<div class="card accueil-chart accueil-chart-wide">
				<h3 class="accueil-chart-title">Tickets reçus et clos par mois</h3>
				<p class="accueil-chart-sub">{{ period }}</p>
				<div class="accueil-legend">
					<span class="accueil-key"><i style="background: var(--tone-blue-ink)"></i>Reçus</span>
					<span class="accueil-key"><i style="background: var(--tone-green-ink)"></i>Clos</span>
					<span class="accueil-readout" aria-live="polite">{{ readout }}</span>
				</div>
				<div v-if="!table" class="accueil-plot">
					<div class="accueil-grid" aria-hidden="true">
						<span v-for="(tick, index) in ticks" :key="index" class="accueil-grid-line" :style="{ top: `${(index * PLOT_HEIGHT) / 3}px` }"><b class="tabular-nums">{{ tick }}</b></span>
					</div>
					<div class="accueil-columns">
						<button
							v-for="(row, index) in months"
							:key="row.month"
							type="button"
							class="accueil-column"
							:aria-label="row.aria"
							@mouseenter="hoveredMonth = index"
							@mouseleave="hoveredMonth = null"
							@focus="hoveredMonth = index"
							@blur="hoveredMonth = null"
						>
							<span class="accueil-bars">
								<i :style="{ height: barHeight(row.received, monthMax), background: 'var(--tone-blue-ink)' }"></i>
								<i :style="{ height: barHeight(row.closed, monthMax), background: 'var(--tone-green-ink)' }"></i>
							</span>
							<span class="accueil-column-label">{{ row.short }}</span>
						</button>
					</div>
				</div>
				<table v-else class="accueil-table">
					<thead><tr><th>Mois</th><th class="accueil-num">Reçus</th><th class="accueil-num">Clos</th></tr></thead>
					<tbody>
						<tr v-for="row in months" :key="row.month"><td>{{ row.long }}</td><td class="accueil-num">{{ row.received }}</td><td class="accueil-num">{{ row.closed }}</td></tr>
					</tbody>
				</table>
			</div>

			<div class="card accueil-chart">
				<h3 class="accueil-chart-title">Ancienneté des tickets ouverts</h3>
				<p class="accueil-chart-sub">{{ openTotal }} tickets, depuis leur création</p>
				<div v-if="!table" class="accueil-ages" role="img" :aria-label="ageAria">
					<div v-for="row in trends.ages" :key="row.label" class="accueil-age">
						<div class="accueil-age-plot">
							<b class="tabular-nums">{{ row.count }}</b>
							<i :style="{ height: `${Math.round((row.count * 88) / ageMax)}px` }"></i>
						</div>
						<span class="accueil-column-label">{{ row.label }}</span>
					</div>
				</div>
				<table v-else class="accueil-table">
					<thead><tr><th>Ancienneté</th><th class="accueil-num">Tickets</th></tr></thead>
					<tbody>
						<tr v-for="row in trends.ages" :key="row.label"><td>{{ row.label }}</td><td class="accueil-num">{{ row.count }}</td></tr>
					</tbody>
				</table>
			</div>

			<div class="card accueil-chart">
				<h3 class="accueil-chart-title">Complétude des fiches</h3>
				<p class="accueil-chart-sub">Part des champs suivis qui sont remplis</p>
				<div class="accueil-complete">
					<div v-for="row in complete" :key="row.label">
						<div class="accueil-complete-head">
							<span>{{ row.label }}</span>
							<b class="tabular-nums">{{ row.percent }} %</b>
						</div>
						<div class="accueil-track" role="img" :aria-label="`${row.label} : ${row.percent} % des champs suivis sont remplis`"><i :style="{ width: `${row.percent}%` }"></i></div>
						<p class="accueil-chart-sub">{{ row.filled }} champs remplis sur {{ row.expected }}</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
