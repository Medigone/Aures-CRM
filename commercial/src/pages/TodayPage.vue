<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideMapPin from '~icons/lucide/map-pin'
import LucidePlus from '~icons/lucide/plus'
import LucidePhone from '~icons/lucide/phone'
import PageHeader from '@/components/PageHeader.vue'
import SyncPill from '@/components/SyncPill.vue'
import StatusPill from '@/components/StatusPill.vue'
import ClientCard from '@/components/ClientCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition, distanceM, pickNearby, pointOf, type GpsPoint } from '@/lib/geo'
import { formatTime, parseServerDate } from '@/lib/format'
import { stripHtml, todayIso } from '@/lib/text'
import type { Client } from '@/types'
import { ticketAlerte } from '@/lib/affaires'
import { formatMoney } from '@/lib/text'

const store = useCommercialStore()
const today = todayIso()
const firstName = computed(() => (store.user?.full_name || '').split(' ')[0])
const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

const clientName = (name?: string | null) => (name && store.clientsByName.get(name)?.customer_name) || name || '—'

const rdvDuJour = computed(() =>
	store.rdv
		.filter((r) => (r.date_heure || '').slice(0, 10) === today && r.status !== 'Terminé')
		.sort((a, b) => (a.date_heure || '').localeCompare(b.date_heure || '')),
)
// Visites du jour, et celles restées en cours un jour précédent (à terminer).
const visitesDuJour = computed(() => store.visites.filter((v) => v.date === today || v.status === 'En Cours'))
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
		<PageHeader :title="firstName ? `Bonjour ${firstName}` : 'Aujourd\'hui'" :subtitle="dateLabel">
			<template #actions><SyncPill /></template>
		</PageHeader>

		<div v-if="!store.bundle && store.syncing" class="card p-6 text-center text-ink-gray-6">Premier chargement de votre portefeuille…</div>
		<div v-else-if="!store.bundle" class="card p-6 text-center text-ink-gray-6">
			Aucune donnée sur cet appareil. Connectez-vous au réseau pour charger votre portefeuille.
		</div>

		<template v-else>
			<div class="mb-6 flex gap-2">
				<RouterLink :to="{ name: 'NewVisit' }" class="btn-primary flex-1"><LucidePlus class="h-4 w-4" aria-hidden="true" />Visite</RouterLink>
				<RouterLink :to="{ name: 'NewAppel' }" class="btn-secondary flex-1"><LucidePhone class="h-4 w-4" aria-hidden="true" />Noter un appel</RouterLink>
			</div>

			<section class="mb-6">
				<h2 class="section-title mb-2">Rendez-vous du jour</h2>
				<p v-if="!rdvDuJour.length" class="text-sm text-ink-gray-6">Aucun rendez-vous aujourd'hui.</p>
				<div class="space-y-2">
					<RouterLink v-for="r in rdvDuJour" :key="r.name" :to="{ name: 'Rdv', params: { id: r.name } }" class="card-link flex items-center gap-3 p-3">
						<span class="w-12 shrink-0 text-lg font-semibold tabular-nums">{{ formatTime(r.date_heure) }}</span>
						<div class="min-w-0 flex-1">
							<p class="truncate font-medium">{{ r.raison_sociale || clientName(r.client) }}</p>
							<p v-if="r.details" class="truncate text-sm text-ink-gray-6">{{ stripHtml(r.details) }}</p>
						</div>
						<StatusPill :status="r.status" />
					</RouterLink>
				</div>
			</section>

			<section v-if="aTraiter" class="mb-6">
				<h2 class="section-title mb-2">À traiter</h2>
				<div class="space-y-2">
					<RouterLink v-for="x in ticketsAlerte" :key="x.t.name" :to="{ name: 'Ticket', params: { id: x.t.name } }" class="card-link p-3">
						<p class="truncate font-medium">{{ x.t.request_type }} · {{ x.t.customer_name || clientName(x.t.client) }}</p>
						<p class="text-sm font-medium text-ink-amber-3">{{ x.alerte }}</p>
					</RouterLink>
					<RouterLink v-for="r in reclamationsRetard" :key="r.name" :to="{ name: 'Reclamation', params: { id: r.name } }" class="card-link p-3">
						<p class="truncate font-medium">Réclamation · {{ r.nom_client || clientName(r.client) }}</p>
						<p class="text-sm font-medium text-ink-red-3">En retard (échéance {{ r.date_echeance }})</p>
					</RouterLink>
					<RouterLink v-for="c in relances" :key="c.name" :to="{ name: 'Client', params: { id: c.client } }" class="card-link p-3">
						<p class="truncate font-medium">Relance créance · {{ c.nom_client || clientName(c.client) }}</p>
						<p class="text-sm text-ink-gray-6">{{ formatMoney(c.solde_restant) }} · prévue le {{ c.date_prochaine_relance }}</p>
					</RouterLink>
				</div>
			</section>

			<section v-if="visitesDuJour.length" class="mb-6">
				<h2 class="section-title mb-2">Visites du jour</h2>
				<div class="space-y-2">
					<RouterLink v-for="v in visitesDuJour" :key="v.name" :to="{ name: 'Visit', params: { id: v.name } }" class="card-link flex items-center justify-between gap-3 p-3">
						<div class="min-w-0">
							<p class="truncate font-medium">{{ v.nom_client || clientName(v.client) }}</p>
							<p class="truncate text-sm text-ink-gray-6">{{ v.type_visite }}<template v-if="v.date !== today"> · commencée {{ v.date }}</template></p>
						</div>
						<span v-if="v._pending" class="pending-dot" title="En attente d'envoi" />
						<StatusPill :status="v.status" />
					</RouterLink>
				</div>
			</section>

			<section v-if="rappels.length" class="mb-6">
				<h2 class="section-title mb-2">Appels à rappeler</h2>
				<div class="space-y-2">
					<RouterLink v-for="a in rappels" :key="a.name" :to="{ name: 'Appel', params: { id: a.name } }" class="card-link p-3">
						<p class="truncate font-medium">{{ clientName(a.client) }}</p>
						<p class="truncate text-sm text-ink-gray-6">{{ a.type }}<template v-if="a.date_rappel"> · {{ formatTime(a.date_rappel) }}</template></p>
					</RouterLink>
				</div>
			</section>

			<section class="mb-6">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="section-title">À proximité</h2>
					<button type="button" class="btn-secondary min-h-9 px-3" :disabled="locating" @click="locate">
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
