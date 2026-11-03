<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideMapPin from '~icons/lucide/map-pin'
import LucideMic from '~icons/lucide/mic'
import LucideCalendarRange from '~icons/lucide/calendar-range'
import PageHeader from '@/components/PageHeader.vue'
import SyncPill from '@/components/SyncPill.vue'
import StatusPill from '@/components/StatusPill.vue'
import ClientCard from '@/components/ClientCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition, distanceM, pickNearby, pointOf, type GpsPoint } from '@/lib/geo'
import { formatTime, parseServerDate } from '@/lib/format'
import { stripHtml, todayIso } from '@/lib/text'
import type { Client } from '@/types'
import { ticketAlerte, ticketOuvert } from '@/lib/affaires'
import { METRIC_LABELS, formatMetric } from '@/lib/objectifs'
import { formatMoney } from '@/lib/text'

const store = useCommercialStore()
const today = todayIso()
const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

const clientName = (name?: string | null) => (name && store.clientsByName.get(name)?.customer_name) || name || '—'

const rdvDuJour = computed(() =>
	store.rdv
		.filter((r) => (r.date_heure || '').slice(0, 10) === today && r.status !== 'Terminé')
		.sort((a, b) => (a.date_heure || '').localeCompare(b.date_heure || '')),
)
// Visites du jour, et celles restées en cours un jour précédent (à terminer).
const visitesDuJour = computed(() =>
	store.visites
		.filter((v) => v.date === today || v.status === 'En Cours')
		.sort((a, b) => (a.debut || a.date || '').localeCompare(b.debut || b.date || '')),
)
const visiteEnCours = computed(() => store.visites.find((v) => v.status === 'En Cours') ?? null)
const visitesFaites = computed(() => visitesDuJour.value.filter((v) => v.status === 'Terminé').length)
const mesTickets = computed(() =>
	store.tickets
		.filter(ticketOuvert)
		.sort((a, b) => (b.creation || b.modified || '').localeCompare(a.creation || a.modified || ''))
		.slice(0, 3),
)
const rappels = computed(() =>
	store.appels
		.filter((a) => a.status === 'À Rappeler' && (!a.date_rappel || a.date_rappel.slice(0, 10) <= today))
		.sort((a, b) => (a.date_rappel || '').localeCompare(b.date_rappel || '')),
)

// À traiter : décisions sur ses tickets, réclamations en retard, relances de créances dues.
const ticketsAlerte = computed(() => store.tickets.map((t) => ({ t, alerte: ticketAlerte(t) })).filter((x) => x.alerte))
const reclamationsRetard = computed(() => store.reclamations.filter((r) => r.status === 'En retard'))
const relances = computed(() =>
	store.creances
		.filter((c) => c.date_prochaine_relance && c.date_prochaine_relance <= today && (c.solde_restant || 0) > 0)
		.sort((a, b) => (a.date_prochaine_relance || '').localeCompare(b.date_prochaine_relance || '')),
)
// Mes objectifs : la cible principale de la période (CA, sinon la première), en une ligne.
const objectifs = computed(() => store.bundle?.objectifs ?? null)
const ciblePrincipale = computed(() => objectifs.value?.cibles.find((c) => c.metric_code === 'revenue') ?? objectifs.value?.cibles[0] ?? null)

const aTraiter = computed(() => ticketsAlerte.value.length + reclamationsRetard.value.length + relances.value.length)

/** Clients actifs sans visite depuis 60 jours (ou jamais), les plus anciens d'abord. */
const STALE_DAYS = 60
const aRevoir = computed(() => {
	const limit = Date.now() - STALE_DAYS * 86400000
	return store.clients
		.filter((c) => c.statut === 'Actif')
		.filter((c) => {
			const seen = parseServerDate(c.derniere_visite ? `${c.derniere_visite} 00:00:00` : null)
			return !seen || seen.getTime() < limit
		})
		.sort((a, b) => (a.derniere_visite || '').localeCompare(b.derniere_visite || ''))
		.slice(0, 8)
})

const position = ref<GpsPoint | null>(null)
const locating = ref(false)
const locateError = ref(false)
async function locate() {
	locating.value = true
	locateError.value = false
	position.value = await currentPosition()
	locateError.value = !position.value
	locating.value = false
}
const placeOf = (c: Client) => pointOf(c.lat, c.lon)
const proches = computed(() => {
	if (!position.value) return []
	return pickNearby(store.clients, position.value, placeOf, (c) => parseServerDate(c.derniere_visite ? `${c.derniere_visite} 00:00:00` : null), {
		radiusM: 5000,
		staleDays: 30,
	}).slice(0, 8)
})
const distanceTo = (c: Client) => {
	const at = placeOf(c)
	return position.value && at ? distanceM(position.value, at) : null
}
</script>

<template>
	<div>
		<PageHeader title="Aujourd'hui" :subtitle="dateLabel">
			<template #actions><SyncPill /></template>
		</PageHeader>

		<div v-if="!store.bundle && store.syncing" class="card p-6 text-center text-ink-gray-6">Premier chargement de votre portefeuille…</div>
		<div v-else-if="!store.bundle" class="card p-6 text-center text-ink-gray-6">
			Aucune donnée sur cet appareil. Connectez-vous au réseau pour charger votre portefeuille.
		</div>

		<template v-else>
			<!-- Les deux gestes du terrain : la visite (ou la reprendre) et le ticket dicté. -->
			<div class="mb-6 grid grid-cols-2 gap-3">
				<RouterLink
					:to="visiteEnCours ? { name: 'Visit', params: { id: visiteEnCours.name } } : { name: 'NewVisit' }"
					class="flex min-h-[8.25rem] flex-col justify-between gap-6 rounded-[22px] bg-primary p-4 text-on-primary transition active:scale-[0.98]"
				>
					<span class="flex h-10 w-10 items-center justify-center rounded-full bg-on-primary/15"><LucideMapPin class="h-5 w-5" aria-hidden="true" /></span>
					<span>
						<span class="block text-base font-semibold">{{ visiteEnCours ? 'Reprendre la visite' : 'Démarrer une visite' }}</span>
						<span class="block truncate text-xs opacity-75">{{ visiteEnCours ? visiteEnCours.nom_client || clientName(visiteEnCours.client) : 'GPS + dictée prête' }}</span>
					</span>
				</RouterLink>
				<RouterLink :to="{ name: 'NewTicket', query: { dictee: '1' } }" class="card flex min-h-[8.25rem] flex-col justify-between gap-6 !rounded-[22px] p-4 transition active:scale-[0.98]">
					<span class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-gray-2"><LucideMic class="h-5 w-5" aria-hidden="true" /></span>
					<span>
						<span class="block text-base font-semibold">Dicter un ticket</span>
						<span class="block text-xs text-ink-gray-6">Voix, photos, fichiers</span>
					</span>
				</RouterLink>
			</div>

			<section v-if="aTraiter" class="mb-6">
				<h2 class="section-title mb-2.5">À traiter</h2>
				<div class="space-y-2">
					<RouterLink v-for="x in ticketsAlerte" :key="x.t.name" :to="{ name: 'Ticket', params: { id: x.t.name } }" class="card-link p-4">
						<p class="truncate font-semibold">{{ x.t.request_type }} · {{ x.t.customer_name || clientName(x.t.client) }}</p>
						<p class="text-sm font-medium text-ink-amber-3">{{ x.alerte }}</p>
					</RouterLink>
					<RouterLink v-for="r in reclamationsRetard" :key="r.name" :to="{ name: 'Reclamation', params: { id: r.name } }" class="card-link p-4">
						<p class="truncate font-semibold">Réclamation · {{ r.nom_client || clientName(r.client) }}</p>
						<p class="text-sm font-medium text-ink-red-3">En retard (échéance {{ r.date_echeance }})</p>
					</RouterLink>
					<RouterLink v-for="c in relances" :key="c.name" :to="{ name: 'Client', params: { id: c.client } }" class="card-link p-4">
						<p class="truncate font-semibold">Relance créance · {{ c.nom_client || clientName(c.client) }}</p>
						<p class="text-sm text-ink-gray-6">{{ formatMoney(c.solde_restant) }} · prévue le {{ c.date_prochaine_relance }}</p>
					</RouterLink>
				</div>
			</section>

			<section class="mb-6">
				<div class="mb-2.5 flex items-baseline justify-between">
					<h2 class="section-title">Visites du jour</h2>
					<span v-if="visitesDuJour.length" class="text-sm text-ink-gray-6">{{ visitesFaites }} / {{ visitesDuJour.length }} faites</span>
				</div>
				<p v-if="!visitesDuJour.length" class="text-sm text-ink-gray-6">Aucune visite prévue aujourd'hui.</p>
				<div v-else class="card divide-y divide-outline-gray-1 overflow-hidden">
					<RouterLink v-for="v in visitesDuJour" :key="v.name" :to="{ name: 'Visit', params: { id: v.name } }" class="flex items-center gap-3 px-4 py-3.5 active:bg-surface-gray-2">
						<span class="w-11 shrink-0 text-sm font-semibold tabular-nums text-ink-gray-6">{{ v.debut ? formatTime(v.debut) : '—' }}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{{ v.nom_client || clientName(v.client) }}</span>
							<span class="block truncate text-xs text-ink-gray-6">{{ v.type_visite }}<template v-if="v.date !== today"> · commencée {{ v.date }}</template></span>
						</span>
						<span v-if="v._pending" class="pending-dot" title="En attente d'envoi" />
						<StatusPill :status="v.status" />
					</RouterLink>
				</div>
			</section>

			<section v-if="rdvDuJour.length" class="mb-6">
				<h2 class="section-title mb-2.5">Rendez-vous du jour</h2>
				<div class="card divide-y divide-outline-gray-1 overflow-hidden">
					<RouterLink v-for="r in rdvDuJour" :key="r.name" :to="{ name: 'Rdv', params: { id: r.name } }" class="flex items-center gap-3 px-4 py-3.5 active:bg-surface-gray-2">
						<span class="w-11 shrink-0 text-sm font-semibold tabular-nums text-ink-gray-6">{{ formatTime(r.date_heure) }}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{{ r.raison_sociale || clientName(r.client) }}</span>
							<span v-if="r.details" class="block truncate text-xs text-ink-gray-6">{{ stripHtml(r.details) }}</span>
						</span>
						<StatusPill :status="r.status" />
					</RouterLink>
				</div>
			</section>

			<section v-if="mesTickets.length" class="mb-6">
				<div class="mb-2.5 flex items-baseline justify-between">
					<h2 class="section-title">Mes tickets ouverts</h2>
					<RouterLink :to="{ name: 'Suivi' }" class="text-sm font-medium">Tout voir</RouterLink>
				</div>
				<div class="space-y-2">
					<RouterLink v-for="t in mesTickets" :key="t.name" :to="{ name: 'Ticket', params: { id: t.name } }" class="card-link space-y-2 p-4">
						<StatusPill :status="t.status" />
						<div class="flex items-baseline justify-between gap-3">
							<span class="truncate font-semibold">{{ t.request_type || 'Ticket' }}</span>
							<span class="shrink-0 truncate text-sm text-ink-gray-6">{{ t.customer_name || clientName(t.client) }}</span>
						</div>
					</RouterLink>
				</div>
			</section>

			<RouterLink v-if="objectifs" :to="{ name: 'Objectifs' }" class="mb-6 block rounded-[20px] bg-accent-fonce p-4 text-white transition active:scale-[0.99]">
				<div class="flex items-baseline justify-between gap-2">
					<span class="text-sm font-medium text-white/70">Mes objectifs</span>
					<span class="text-sm font-semibold tabular-nums text-white">{{ Math.round(objectifs.target_achievement_pct || 0) }} %</span>
				</div>
				<p v-if="ciblePrincipale" class="mt-1 text-lg font-semibold">
					{{ formatMetric(ciblePrincipale.achieved_value, ciblePrincipale.unit) }}
					<span class="text-sm font-normal text-white/70">/ {{ formatMetric(ciblePrincipale.target_value, ciblePrincipale.unit) }} {{ METRIC_LABELS[ciblePrincipale.metric_code] || ciblePrincipale.metric_code }}</span>
				</p>
				<div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
					<div class="h-full rounded-full bg-white" :style="{ width: `${Math.min(100, Math.round(objectifs.target_achievement_pct || 0))}%` }" />
				</div>
			</RouterLink>

			<section v-if="rappels.length" class="mb-6">
				<h2 class="section-title mb-2.5">Appels à rappeler</h2>
				<div class="space-y-2">
					<RouterLink v-for="a in rappels" :key="a.name" :to="{ name: 'Appel', params: { id: a.name } }" class="card-link p-4">
						<p class="truncate font-medium">{{ clientName(a.client) }}</p>
						<p class="truncate text-sm text-ink-gray-6">{{ a.type }}<template v-if="a.date_rappel"> · {{ formatTime(a.date_rappel) }}</template></p>
					</RouterLink>
				</div>
			</section>

			<RouterLink :to="{ name: 'Week' }" class="btn-secondary mb-6 w-full"><LucideCalendarRange class="h-4 w-4" aria-hidden="true" />Ma semaine</RouterLink>

			<section class="mb-6">
				<div class="mb-2.5 flex items-center justify-between">
					<h2 class="section-title">À proximité</h2>
					<button type="button" class="btn-secondary min-h-9 px-3 text-sm" :disabled="locating" @click="locate">
						<LucideMapPin class="h-4 w-4" aria-hidden="true" />
						{{ locating ? 'Localisation…' : position ? 'Actualiser' : 'Me localiser' }}
					</button>
				</div>
				<p v-if="locateError" class="text-sm text-ink-red-3">Position indisponible : autorisez la localisation pour cette application.</p>
				<p v-else-if="position && !proches.length" class="text-sm text-ink-gray-6">Aucun client non visité depuis 30 jours dans un rayon de 5 km.</p>
				<p v-else-if="!position" class="text-sm text-ink-gray-6">Les clients à moins de 5 km, non visités depuis 30 jours.</p>
				<div class="space-y-2">
					<ClientCard v-for="p in proches" :key="p.row.name" :client="p.row" :meters="p.meters" />
				</div>
			</section>

			<section v-if="aRevoir.length">
				<h2 class="section-title mb-2">Clients actifs à revoir</h2>
				<p class="mb-2 text-sm text-ink-gray-6">Sans visite depuis plus de {{ STALE_DAYS }} jours.</p>
				<div class="space-y-2">
					<ClientCard v-for="c in aRevoir" :key="c.name" :client="c" :meters="distanceTo(c)" />
				</div>
			</section>
		</template>
	</div>
</template>
