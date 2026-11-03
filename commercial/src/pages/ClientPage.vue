<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucidePhone from '~icons/lucide/phone'
import LucideMail from '~icons/lucide/mail'
import LucideNavigation from '~icons/lucide/navigation'
import LucideSearch from '~icons/lucide/search'
import LucideCalendarPlus from '~icons/lucide/calendar-plus'
import LucideClipboardPlus from '~icons/lucide/clipboard-plus'
import LucidePhoneCall from '~icons/lucide/phone-call'
import LucideMapPin from '~icons/lucide/map-pin'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import ArticleCard from '@/components/ArticleCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay, formatTime, normalizeSearch } from '@/lib/format'
import { formatMoney, gpsText, stripHtml } from '@/lib/text'
import { currentPosition } from '@/lib/geo'
import { refTo } from '@/lib/mutations'
import AffairesTabs from '@/components/AffairesTabs.vue'
import type { CreanceDetail } from '@/types'
import LucideTicket from '~icons/lucide/ticket'
import LucideMessageSquareWarning from '~icons/lucide/message-square-warning'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const router = useRouter()
// Un prospect créé sur l'appareil change de clé quand le serveur le confirme : la page suit.
const key = computed(() => store.resolveKey(props.id))
watch(key, (next) => {
	if (next !== props.id) router.replace({ name: 'Client', params: { id: next } })
})
const client = computed(() => store.clientsByName.get(key.value) ?? null)

type Tab = 'articles' | 'affaires' | 'infos' | 'contacts' | 'historique'
const tab = ref<Tab>('articles')
const tabs: { key: Tab; label: string }[] = [
	{ key: 'articles', label: 'Articles' },
	{ key: 'affaires', label: 'Affaires' },
	{ key: 'infos', label: 'Infos' },
	{ key: 'contacts', label: 'Contacts' },
	{ key: 'historique', label: 'Historique' },
]

// Créances du client : solde et relances (instantané) ; mouvements consultés en ligne puis gardés.
const creances = computed(() => store.creancesByClient.get(key.value) ?? [])
const openedCreance = ref<string | null>(null)
const creanceDetail = ref<CreanceDetail | null>(null)
const creanceError = ref<string | null>(null)
async function toggleCreance(name: string) {
	if (openedCreance.value === name) {
		openedCreance.value = null
		return
	}
	openedCreance.value = name
	creanceError.value = null
	creanceDetail.value = await store.cachedCreance(name)
	try {
		creanceDetail.value = await store.fetchCreance(name)
	} catch (error) {
		creanceError.value = (error as Error).message
	}
}

const telephone = computed(() => client.value?.telephone_principal || client.value?.telephone || null)
const mapsUrl = computed(() => {
	const c = client.value
	if (!c) return null
	if (c.lat != null && c.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`
	const place = [c.commune, c.wilaya].filter(Boolean).join(' ')
	return place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.customer_name} ${place}`)}` : null
})

// Articles du client : recherche et filtre par procédé, hors-ligne.
const articleQuery = ref('')
const procede = ref<string | null>(null)
const clientArticles = computed(() => store.articlesByClient.get(key.value) ?? [])
const procedes = computed(() => [...new Set(clientArticles.value.map((a) => a.procede).filter(Boolean) as string[])].sort())
const articles = computed(() => {
	const q = normalizeSearch(articleQuery.value)
	return clientArticles.value.filter((a) => {
		if (procede.value && a.procede !== procede.value) return false
		if (!q) return true
		return normalizeSearch([a.designation, a.name, a.code_client, a.support, a.dimensions].join(' ')).includes(q)
	})
})

const contacts = computed(() => store.contactsByClient.get(key.value) ?? [])

type Event = { key: string; date: string; kind: string; title: string; detail: string; status: string | null; to: object; pending?: boolean }
const historique = computed<Event[]>(() => {
	const events: Event[] = []
	for (const v of store.visitesByClient.get(key.value) ?? []) {
		const recouvrement = v.montant_encaisse ? ` · encaissé ${formatMoney(v.montant_encaisse)}` : ''
		events.push({ key: v.name, date: v.debut || v.date, kind: 'Visite', title: v.type_visite || 'Visite', detail: stripHtml(v.notes) + recouvrement, status: v.status, to: { name: 'Visit', params: { id: v.name } }, pending: v._pending })
	}
	for (const r of store.rdvByClient.get(key.value) ?? []) {
		events.push({ key: r.name, date: r.date_heure || '', kind: 'Rendez-vous', title: `RDV ${formatTime(r.date_heure)}`, detail: stripHtml(r.details), status: r.status, to: { name: 'Rdv', params: { id: r.name } }, pending: r._pending })
	}
	for (const a of store.appelsByClient.get(key.value) ?? []) {
		events.push({ key: a.name, date: a.heure || a.date || '', kind: 'Appel', title: a.type || 'Appel', detail: stripHtml(a.notes), status: a.status, to: { name: 'Appel', params: { id: a.name } }, pending: a._pending })
	}
	return events.sort((a, b) => b.date.localeCompare(a.date))
})

// Position du client : enregistrée sur place (adresse GPS du Customer).
const locating = ref(false)
const gpsMessage = ref<string | null>(null)
async function saveGps() {
	if (!client.value) return
	locating.value = true
	const position = await currentPosition()
	locating.value = false
	if (!position) {
		gpsMessage.value = 'Position indisponible : autorisez la localisation.'
		return
	}
	store.enqueue('client_update_gps', { ...refTo('client', client.value.name), gps: gpsText(position) }, client.value.name)
	gpsMessage.value = `Position enregistrée (précision ${position.precision ?? '?'} m).`
}

const infos = computed(() => {
	const c = client.value
	if (!c) return []
	return [
		['Code client', c.name],
		['Groupe client', c.groupe],
		['Groupe de sociétés', c.groupe_societes],
		['Wilaya', c.wilaya],
		['Commune', c.commune],
		['Région', c.region],
		['Contact principal', c.contact_principal],
		['Téléphone', telephone.value],
		['Email', c.email],
		['Commercial principal', c.commercial],
		['Position GPS', c.lat != null ? `${c.lat}, ${c.lon}` : null],
	].filter(([, value]) => value) as [string, string][]
})
</script>

<template>
	<div v-if="!client" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Client introuvable" :back="{ name: 'Clients' }" />
		Ce client n'est pas dans votre portefeuille sur cet appareil.
	</div>
	<div v-else>
		<PageHeader :title="client.customer_name" :subtitle="[client.commune, client.wilaya].filter(Boolean).join(' · ') || client.name" :back="{ name: 'Clients' }">
			<template #actions><StatusPill :status="client.statut" /></template>
		</PageHeader>

		<div class="quick-actions mb-4">
			<a v-if="telephone" :href="`tel:${telephone}`" class="quick-action"><LucidePhone aria-hidden="true" />Appeler</a>
			<a v-if="client.email" :href="`mailto:${client.email}`" class="quick-action"><LucideMail aria-hidden="true" />Email</a>
			<a v-if="mapsUrl" :href="mapsUrl" target="_blank" rel="noopener" class="quick-action"><LucideNavigation aria-hidden="true" />Itinéraire</a>
		</div>
		<div class="quick-actions mb-4">
			<RouterLink :to="{ name: 'NewVisit', query: { client: client.name } }" class="quick-action"><LucideClipboardPlus aria-hidden="true" />Visite</RouterLink>
			<RouterLink :to="{ name: 'NewRdv', query: { client: client.name } }" class="quick-action"><LucideCalendarPlus aria-hidden="true" />Rendez-vous</RouterLink>
			<RouterLink :to="{ name: 'NewAppel', query: { client: client.name } }" class="quick-action"><LucidePhoneCall aria-hidden="true" />Appel</RouterLink>
			<RouterLink :to="{ name: 'NewTicket', query: { client: client.name } }" class="quick-action"><LucideTicket aria-hidden="true" />Ticket</RouterLink>
			<RouterLink :to="{ name: 'NewTicket', query: { client: client.name, type: 'Réclamation' } }" class="quick-action"><LucideMessageSquareWarning aria-hidden="true" />Réclamation</RouterLink>
		</div>

		<div class="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4" role="tablist" style="scrollbar-width: none">
			<button
				v-for="t in tabs"
				:key="t.key"
				type="button"
				role="tab"
				:aria-selected="tab === t.key"
				class="min-h-10 shrink-0 rounded-full px-4 text-sm"
				:class="tab === t.key ? 'bg-accent font-medium text-white' : 'bg-surface-gray-2 text-ink-gray-7'"
				@click="tab = t.key"
			>
				{{ t.label }}<template v-if="t.key === 'articles'"> ({{ clientArticles.length }})</template>
			</button>
		</div>

		<section v-if="tab === 'articles'">
			<label v-if="clientArticles.length > 5" class="search-box mb-3">
				<LucideSearch class="h-5 w-5 text-ink-gray-5" aria-hidden="true" />
				<input v-model="articleQuery" type="search" class="min-h-11 w-full border-0 bg-transparent p-0 text-base focus:ring-0" placeholder="Désignation, code, réf. client…" aria-label="Rechercher un article" />
			</label>
			<div v-if="procedes.length > 1" class="chip-scroller mb-3">
				<button type="button" :class="procede === null ? 'chip-on' : 'chip-off'" @click="procede = null">Tous</button>
				<button v-for="p in procedes" :key="p" type="button" :class="procede === p ? 'chip-on' : 'chip-off'" @click="procede = procede === p ? null : p">{{ p }}</button>
			</div>
			<p v-if="!clientArticles.length" class="py-8 text-center text-sm text-ink-gray-6">Aucun article enregistré pour ce client.</p>
			<p v-else-if="!articles.length" class="py-8 text-center text-sm text-ink-gray-6">Aucun article ne correspond.</p>
			<div class="space-y-2">
				<ArticleCard v-for="a in articles" :key="a.name" :article="a" />
			</div>
		</section>

		<section v-else-if="tab === 'affaires'">
			<template v-if="creances.length">
				<h2 class="section-title mb-2">Créances</h2>
				<div class="mb-5 space-y-2">
					<div v-for="c in creances" :key="c.name" class="card p-3 text-sm">
						<button type="button" class="flex w-full items-start justify-between gap-2 text-left" :aria-expanded="openedCreance === c.name" @click="toggleCreance(c.name)">
							<span>
								<span class="block text-base font-semibold">{{ formatMoney(c.solde_restant) }}</span>
								<span class="block text-ink-gray-6">
									{{ c.name }}<template v-if="c.date_prochaine_relance"> · relance {{ formatDay(c.date_prochaine_relance) }}</template>
								</span>
							</span>
							<StatusPill :status="c.statut" />
						</button>
						<div v-if="openedCreance === c.name" class="mt-2 border-t border-outline-gray-1 pt-2">
							<p v-if="!creanceDetail && !store.online" class="text-ink-gray-6">Mouvements non consultés sur cet appareil.</p>
							<p v-else-if="creanceError && !creanceDetail" class="text-ink-red-3">{{ creanceError }}</p>
							<p v-else-if="creanceDetail && !creanceDetail.mouvements.length" class="text-ink-gray-6">Aucun mouvement.</p>
							<ul v-if="creanceDetail" class="space-y-1">
								<li v-for="m in creanceDetail.mouvements" :key="m.name" class="flex justify-between gap-2">
									<span class="text-ink-gray-7">{{ formatDay(m.date_mouvement) }} · {{ m.type_mouvement }}<template v-if="m.type_paiement"> ({{ m.type_paiement }})</template></span>
									<span class="font-medium tabular-nums" :class="m.sens === 'Crédit' && 'text-ink-green-3'">{{ m.sens === 'Crédit' ? '−' : '' }}{{ formatMoney(m.montant) }}</span>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</template>
			<AffairesTabs :client="client.name" />
		</section>

		<section v-else-if="tab === 'infos'">
			<div class="card divide-y divide-outline-gray-1">
				<div v-for="[label, value] in infos" :key="label" class="flex justify-between gap-4 px-3 py-2.5 text-sm">
					<span class="text-ink-gray-6">{{ label }}</span>
					<span class="text-right font-medium">{{ value }}</span>
				</div>
			</div>
			<button type="button" class="btn-secondary mt-3 w-full" :disabled="locating" @click="saveGps">
				<LucideMapPin class="h-4 w-4" aria-hidden="true" />{{ locating ? 'Localisation…' : client.lat != null ? 'Corriger la position (je suis chez le client)' : 'Enregistrer la position (je suis chez le client)' }}
			</button>
			<p v-if="gpsMessage" class="mt-1 text-sm text-ink-gray-6">{{ gpsMessage }}</p>
		</section>

		<section v-else-if="tab === 'contacts'">
			<p v-if="!contacts.length" class="py-8 text-center text-sm text-ink-gray-6">Aucun contact lié à ce client.</p>
			<div class="space-y-2">
				<div v-for="c in contacts" :key="c.cle" class="card p-3">
					<p class="font-medium">{{ c.nom || c.name }}<span v-if="c.principal" class="ml-2 text-xs text-accent">principal</span></p>
					<p v-if="c.fonction" class="text-sm text-ink-gray-6">{{ c.fonction }}</p>
					<div class="mt-2 flex flex-wrap gap-2">
						<a v-if="c.mobile || c.telephone" :href="`tel:${c.mobile || c.telephone}`" class="btn-secondary min-h-9 px-3"><LucidePhone class="h-4 w-4" aria-hidden="true" />{{ c.mobile || c.telephone }}</a>
						<a v-if="c.email" :href="`mailto:${c.email}`" class="btn-secondary min-h-9 px-3"><LucideMail class="h-4 w-4" aria-hidden="true" />Email</a>
					</div>
				</div>
			</div>
		</section>

		<section v-else>
			<p v-if="!historique.length" class="py-8 text-center text-sm text-ink-gray-6">Aucune visite, aucun rendez-vous ni appel récent.</p>
			<ol class="space-y-2">
				<li v-for="e in historique" :key="e.key">
					<RouterLink :to="e.to" class="card-link p-3">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0">
								<p class="text-xs text-ink-gray-6">{{ e.kind }} · {{ formatDay(e.date) }}</p>
								<p class="font-medium">{{ e.title }}</p>
							</div>
							<span class="flex items-center gap-2">
								<span v-if="e.pending" class="pending-dot" title="En attente d'envoi" />
								<StatusPill :status="e.status" />
							</span>
						</div>
						<p v-if="e.detail" class="mt-1 line-clamp-3 text-sm text-ink-gray-7">{{ e.detail }}</p>
					</RouterLink>
				</li>
			</ol>
		</section>
	</div>
</template>
