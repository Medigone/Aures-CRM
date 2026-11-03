<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideChevronLeft from '~icons/lucide/chevron-left'
import LucideChevronRight from '~icons/lucide/chevron-right'
import LucidePlus from '~icons/lucide/plus'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { addDays, formatTime, parseServerDate, weekStart } from '@/lib/format'
import { todayIso } from '@/lib/text'

/** Planning de la semaine (dimanche → samedi) : visites et rendez-vous, de la semaine passée à la suivante +1. */
const store = useCommercialStore()
const offset = ref(0)
const today = todayIso()
const start = computed(() => addDays(weekStart(), offset.value * 7))
const days = computed(() => Array.from({ length: 7 }, (_, i) => addDays(start.value, i)))
const title = computed(() => (offset.value === 0 ? 'Cette semaine' : offset.value === 1 ? 'Semaine prochaine' : offset.value === -1 ? 'Semaine passée' : 'Dans deux semaines'))

const clientName = (name?: string | null) => (name && store.clientsByName.get(name)?.customer_name) || name || '—'

type Entry = { key: string; time: string; title: string; detail: string | null; status: string; pending?: boolean; to: object }
const byDay = computed(() => {
	const map = new Map<string, Entry[]>(days.value.map((d) => [d, []]))
	for (const v of store.visites) {
		map.get(v.date)?.push({
			key: v.name,
			time: v.debut ? formatTime(v.debut) : '',
			title: v.nom_client || clientName(v.client),
			detail: `Visite · ${v.type_visite || ''}`,
			status: v.status,
			pending: v._pending,
			to: { name: 'Visit', params: { id: v.name } },
		})
	}
	for (const r of store.rdv) {
		const day = (r.date_heure || '').slice(0, 10)
		map.get(day)?.push({
			key: r.name,
			time: formatTime(r.date_heure),
			title: r.raison_sociale || clientName(r.client),
			detail: 'Rendez-vous',
			status: r.status,
			pending: r._pending,
			to: { name: 'Rdv', params: { id: r.name } },
		})
	}
	for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time))
	return map
})
const dayLabel = (day: string) => parseServerDate(`${day} 00:00:00`)?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }) ?? day
const count = computed(() => [...byDay.value.values()].reduce((n, list) => n + list.length, 0))
</script>

<template>
	<div>
		<PageHeader :title="title" :subtitle="`${count} visite(s) et rendez-vous`">
			<template #actions>
				<button type="button" class="icon-btn" :disabled="offset <= -1" aria-label="Semaine précédente" @click="offset--"><LucideChevronLeft class="h-5 w-5" /></button>
				<button type="button" class="icon-btn" :disabled="offset >= 2" aria-label="Semaine suivante" @click="offset++"><LucideChevronRight class="h-5 w-5" /></button>
			</template>
		</PageHeader>

		<div class="mb-4 flex gap-2">
			<RouterLink :to="{ name: 'NewVisit' }" class="btn-primary flex-1"><LucidePlus class="h-4 w-4" aria-hidden="true" />Visite</RouterLink>
			<RouterLink :to="{ name: 'NewRdv' }" class="btn-secondary flex-1"><LucidePlus class="h-4 w-4" aria-hidden="true" />Rendez-vous</RouterLink>
		</div>

		<section v-for="day in days" :key="day" class="mb-4">
			<div class="mb-1 flex items-center justify-between">
				<h2 class="section-title capitalize" :class="day === today && 'text-accent'">{{ dayLabel(day) }}</h2>
				<RouterLink v-if="day >= today" :to="{ name: 'NewVisit', query: { date: day } }" class="text-sm text-accent">+ Planifier</RouterLink>
			</div>
			<p v-if="!byDay.get(day)?.length" class="text-sm text-ink-gray-5">—</p>
			<div class="space-y-2">
				<RouterLink v-for="e in byDay.get(day)" :key="e.key" :to="e.to" class="card-link flex items-center gap-3 p-3">
					<span class="w-12 shrink-0 text-sm font-semibold tabular-nums">{{ e.time }}</span>
					<div class="min-w-0 flex-1">
						<p class="truncate font-medium">{{ e.title }}</p>
						<p class="truncate text-sm text-ink-gray-6">{{ e.detail }}</p>
					</div>
					<span v-if="e.pending" class="pending-dot" title="En attente d'envoi" />
					<StatusPill :status="e.status" />
				</RouterLink>
			</div>
		</section>
	</div>
</template>
