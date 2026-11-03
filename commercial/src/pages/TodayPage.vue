<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideMapPin from '~icons/lucide/map-pin'
import LucideMic from '~icons/lucide/mic'
import LucideBell from '~icons/lucide/bell'
import SyncPill from '@/components/SyncPill.vue'
import StatusPill from '@/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { useATraiter } from '@/lib/aTraiter'
import { ticketOuvert } from '@/lib/affaires'
import { formatDay, formatTime } from '@/lib/format'
import { stripHtml, todayIso } from '@/lib/text'

/** Accueil : la journée du commercial, visites (et rendez-vous) d'un côté, tickets ouverts de l'autre. */
const store = useCommercialStore()
const today = todayIso()
const dateLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const clientName = (name?: string | null) => (name && store.clientsByName.get(name)?.customer_name) || name || '—'
const { total: aTraiter } = useATraiter()

type Onglet = 'visites' | 'tickets'
const TAB_KEY = 'aures-accueil-onglet'
const tab = ref<Onglet>('visites')
try {
	if (localStorage.getItem(TAB_KEY) === 'tickets') tab.value = 'tickets'
} catch {
	/* stockage indisponible : onglet Visites */
}
watch(tab, (value) => {
	try {
		localStorage.setItem(TAB_KEY, value)
	} catch {
		/* préférence non gardée */
	}
})

// Visites du jour, et celles restées en cours un jour précédent (à terminer).
const visitesDuJour = computed(() => store.visites.filter((v) => v.date === today || v.status === 'En Cours'))
const visiteEnCours = computed(() => visitesDuJour.value.find((v) => v.status === 'En Cours') ?? null)
// Carte mise en avant : la visite en cours, sinon la première à faire aujourd'hui.
const aLaUne = computed(() => visiteEnCours.value ?? visitesDuJour.value.find((v) => v.status === 'Nouveau') ?? null)
const visitesFaites = computed(() => visitesDuJour.value.filter((v) => v.status === 'Terminé').length)
const rdvDuJour = computed(() => store.rdv.filter((r) => (r.date_heure || '').slice(0, 10) === today && r.status !== 'Terminé'))

/** Agenda du jour : visites et rendez-vous mêlés, dans l'ordre de l'heure (les visites non démarrées à la fin). */
const agenda = computed(() =>
	[
		...visitesDuJour.value
			.filter((v) => v.name !== aLaUne.value?.name)
			.map((v) => ({
				key: v.name,
				to: { name: 'Visit', params: { id: v.name } },
				at: v.debut || `${v.date} 99`,
				time: v.debut ? formatTime(v.debut) : '—',
				title: v.nom_client || clientName(v.client),
				sub: `${v.type_visite || 'Visite'}${v.date !== today ? ` · commencée le ${formatDay(v.date)}` : ''}`,
				status: v.status,
				pending: v._pending,
			})),
		...rdvDuJour.value.map((r) => ({
			key: r.name,
			to: { name: 'Rdv', params: { id: r.name } },
			at: r.date_heure || '',
			time: formatTime(r.date_heure),
			title: r.raison_sociale || clientName(r.client),
			sub: r.details ? `Rendez-vous · ${stripHtml(r.details)}` : 'Rendez-vous',
			status: r.status,
			pending: r._pending,
		})),
	].sort((a, b) => a.at.localeCompare(b.at)),
)

const ticketsOuverts = computed(() =>
	store.tickets.filter(ticketOuvert).sort((a, b) => (b.creation || b.modified || '').localeCompare(a.creation || a.modified || '')),
)
const TICKETS_SHOWN = 8
</script>

<template>
	<div>
		<!-- Ligne de marque : logo et nom à gauche, synchro et « À traiter » à droite ; le titre prend ensuite toute la largeur. -->
		<div class="mb-3 flex items-center gap-2">
			<svg viewBox="0 0 100 100" class="h-7 w-7 shrink-0 text-ink-gray-9" aria-hidden="true">
				<polygon points="50,20 20,80 50,70" fill="currentColor" />
				<polygon points="50,20 50,70 80,80" fill="currentColor" fill-opacity="0.55" />
			</svg>
			<p class="min-w-0 flex-1 truncate text-sm font-bold tracking-tight">Aures <span class="font-medium text-ink-gray-6">Emballages</span></p>
			<SyncPill />
			<RouterLink :to="{ name: 'ATraiter' }" class="relative flex h-11 w-11 items-center justify-center rounded-full bg-surface-white dark:bg-surface-cards" :aria-label="aTraiter ? `À traiter : ${aTraiter}` : 'À traiter'">
				<LucideBell class="h-5 w-5" aria-hidden="true" />
				<span v-if="aTraiter" class="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-700 px-1 text-[11px] font-bold text-white">{{ aTraiter }}</span>
			</RouterLink>
		</div>
		<div class="mb-4">
			<h1 class="text-[28px] font-bold leading-tight tracking-tight">Aujourd'hui</h1>
			<p class="text-sm text-ink-gray-6">{{ dateLabel }}</p>
		</div>

		<div v-if="!store.bundle && store.syncing" class="card p-6 text-center text-ink-gray-6">Premier chargement de votre portefeuille…</div>
		<div v-else-if="!store.bundle" class="card p-6 text-center text-ink-gray-6">
			Aucune donnée sur cet appareil. Connectez-vous au réseau pour charger votre portefeuille.
		</div>

		<template v-else>
			<!-- Les deux gestes du terrain : la visite (ou la reprendre) et le ticket dicté. -->
			<div class="mb-5 grid grid-cols-2 gap-3">
				<RouterLink
					:to="visiteEnCours ? { name: 'Visit', params: { id: visiteEnCours.name } } : { name: 'NewVisit' }"
					class="flex min-h-[7.5rem] flex-col justify-between gap-5 rounded-[22px] bg-primary p-4 text-on-primary transition active:scale-[0.98]"
				>
					<span class="flex h-10 w-10 items-center justify-center rounded-full bg-on-primary/15"><LucideMapPin class="h-5 w-5" aria-hidden="true" /></span>
					<span>
						<span class="block text-base font-semibold">{{ visiteEnCours ? 'Reprendre la visite' : 'Démarrer une visite' }}</span>
						<span class="block truncate text-xs opacity-75">{{ visiteEnCours ? visiteEnCours.nom_client || clientName(visiteEnCours.client) : 'GPS + dictée prête' }}</span>
					</span>
				</RouterLink>
				<RouterLink :to="{ name: 'NewTicket', query: { dictee: '1' } }" class="card flex min-h-[7.5rem] flex-col justify-between gap-5 !rounded-[22px] p-4 transition active:scale-[0.98]">
					<span class="flex h-10 w-10 items-center justify-center rounded-full bg-surface-gray-2"><LucideMic class="h-5 w-5" aria-hidden="true" /></span>
					<span>
						<span class="block text-base font-semibold">Dicter un ticket</span>
						<span class="block text-xs text-ink-gray-6">Voix, photos, fichiers</span>
					</span>
				</RouterLink>
			</div>

			<div class="mb-4 grid grid-cols-2 gap-1 rounded-full bg-surface-gray-3 p-1" role="tablist" aria-label="Visites ou tickets">
				<button
					type="button"
					role="tab"
					:aria-selected="tab === 'visites'"
					class="min-h-[42px] rounded-full text-sm transition"
					:class="tab === 'visites' ? 'bg-surface-white font-semibold shadow-sm dark:bg-surface-gray-1' : 'font-medium text-ink-gray-7'"
					@click="tab = 'visites'"
				>
					Visites<template v-if="visitesDuJour.length"> · {{ visitesFaites }}/{{ visitesDuJour.length }}</template>
				</button>
				<button
					type="button"
					role="tab"
					:aria-selected="tab === 'tickets'"
					class="min-h-[42px] rounded-full text-sm transition"
					:class="tab === 'tickets' ? 'bg-surface-white font-semibold shadow-sm dark:bg-surface-gray-1' : 'font-medium text-ink-gray-7'"
					@click="tab = 'tickets'"
				>
					Tickets ouverts<template v-if="ticketsOuverts.length"> · {{ ticketsOuverts.length }}</template>
				</button>
			</div>

			<section v-if="tab === 'visites'" class="space-y-2.5" role="tabpanel" aria-label="Visites du jour">
				<div v-if="aLaUne" class="card space-y-2.5 p-4">
					<div class="flex items-center justify-between gap-2">
						<span v-if="aLaUne.status === 'En Cours'" class="badge gap-1.5 bg-surface-green-2 font-semibold text-ink-green-3">
							<span class="h-1.5 w-1.5 rounded-full bg-ink-green-3" aria-hidden="true" />En cours depuis {{ formatTime(aLaUne.debut) }}
						</span>
						<span v-else class="badge bg-surface-blue-2 font-semibold text-ink-blue-3">À faire aujourd'hui</span>
						<span v-if="aLaUne._pending" class="pending-dot" title="En attente d'envoi" />
					</div>
					<div>
						<p class="text-base font-semibold">{{ aLaUne.nom_client || clientName(aLaUne.client) }}</p>
						<p class="text-sm text-ink-gray-6">{{ aLaUne.type_visite || 'Visite' }}</p>
					</div>
					<RouterLink :to="{ name: 'Visit', params: { id: aLaUne.name } }" class="btn-primary min-h-11 w-full">{{ aLaUne.status === 'En Cours' ? 'Reprendre' : 'Ouvrir et démarrer' }}</RouterLink>
				</div>

				<p v-if="!aLaUne && !agenda.length" class="py-6 text-center text-sm text-ink-gray-6">Aucune visite ni rendez-vous aujourd'hui.</p>
				<div v-if="agenda.length" class="card divide-y divide-outline-gray-1 overflow-hidden">
					<RouterLink v-for="item in agenda" :key="item.key" :to="item.to" class="flex items-center gap-3 px-4 py-3.5 active:bg-surface-gray-2">
						<span class="w-11 shrink-0 text-sm font-semibold tabular-nums text-ink-gray-6">{{ item.time }}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{{ item.title }}</span>
							<span class="block truncate text-xs text-ink-gray-6">{{ item.sub }}</span>
						</span>
						<span v-if="item.pending" class="pending-dot" title="En attente d'envoi" />
						<StatusPill :status="item.status" />
					</RouterLink>
				</div>
				<RouterLink :to="{ name: 'Week' }" class="block py-2.5 text-center text-sm font-medium text-ink-gray-7">Voir ma semaine</RouterLink>
			</section>

			<section v-else class="space-y-2" role="tabpanel" aria-label="Tickets ouverts">
				<p v-if="!ticketsOuverts.length" class="py-6 text-center text-sm text-ink-gray-6">Aucun ticket ouvert.</p>
				<RouterLink v-for="t in ticketsOuverts.slice(0, TICKETS_SHOWN)" :key="t.name" :to="{ name: 'Ticket', params: { id: t.name } }" class="card-link space-y-2 p-4">
					<div class="flex items-center justify-between gap-2">
						<StatusPill :status="t.status" />
						<span class="flex items-center gap-1.5 text-xs text-ink-gray-6">
							<span v-if="t._pending" class="pending-dot" title="En attente d'envoi" />{{ formatDay(t.creation_date) }}
						</span>
					</div>
					<div class="flex items-baseline justify-between gap-3">
						<span class="truncate font-semibold">{{ t.request_type || 'Ticket' }}</span>
						<span class="max-w-[50%] shrink-0 truncate text-right text-sm text-ink-gray-6">{{ t.customer_name || clientName(t.client) }}</span>
					</div>
				</RouterLink>
				<RouterLink :to="{ name: 'Suivi' }" class="block py-2.5 text-center text-sm font-medium text-ink-gray-7">Tous les tickets</RouterLink>
			</section>
		</template>
	</div>
</template>
