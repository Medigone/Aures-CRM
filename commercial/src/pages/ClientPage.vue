<script setup lang="ts">
import { computed, ref } from 'vue'
import LucidePhone from '~icons/lucide/phone'
import LucideMail from '~icons/lucide/mail'
import LucideNavigation from '~icons/lucide/navigation'
import LucideSearch from '~icons/lucide/search'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import ArticleCard from '@/components/ArticleCard.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay, formatTime, normalizeSearch } from '@/lib/format'
import { formatMoney, stripHtml } from '@/lib/text'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const client = computed(() => store.clientsByName.get(props.id) ?? null)

type Tab = 'articles' | 'infos' | 'contacts' | 'historique'
const tab = ref<Tab>('articles')
const tabs: { key: Tab; label: string }[] = [
	{ key: 'articles', label: 'Articles' },
	{ key: 'infos', label: 'Infos' },
	{ key: 'contacts', label: 'Contacts' },
	{ key: 'historique', label: 'Historique' },
]

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
const clientArticles = computed(() => store.articlesByClient.get(props.id) ?? [])
const procedes = computed(() => [...new Set(clientArticles.value.map((a) => a.procede).filter(Boolean) as string[])].sort())
const articles = computed(() => {
	const q = normalizeSearch(articleQuery.value)
	return clientArticles.value.filter((a) => {
		if (procede.value && a.procede !== procede.value) return false
		if (!q) return true
		return normalizeSearch([a.designation, a.name, a.code_client, a.support, a.dimensions].join(' ')).includes(q)
	})
})

const contacts = computed(() => store.contactsByClient.get(props.id) ?? [])

type Event = { key: string; date: string; kind: string; title: string; detail: string; status: string | null }
const historique = computed<Event[]>(() => {
	const events: Event[] = []
	for (const v of store.visitesByClient.get(props.id) ?? []) {
		const recouvrement = v.montant_encaisse ? ` · encaissé ${formatMoney(v.montant_encaisse)}` : ''
		events.push({ key: v.name, date: v.debut || v.date, kind: 'Visite', title: v.type_visite || 'Visite', detail: stripHtml(v.notes) + recouvrement, status: v.status })
	}
	for (const r of store.rdvByClient.get(props.id) ?? []) {
		events.push({ key: r.name, date: r.date_heure || '', kind: 'Rendez-vous', title: `RDV ${formatTime(r.date_heure)}`, detail: stripHtml(r.details), status: r.status })
	}
	for (const a of store.appelsByClient.get(props.id) ?? []) {
		events.push({ key: a.name, date: a.heure || a.date || '', kind: 'Appel', title: a.type || 'Appel', detail: stripHtml(a.notes), status: a.status })
	}
	return events.sort((a, b) => b.date.localeCompare(a.date))
})

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

		<div class="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-surface-gray-2 p-1" role="tablist">
			<button
				v-for="t in tabs"
				:key="t.key"
				type="button"
				role="tab"
				:aria-selected="tab === t.key"
				class="min-h-10 rounded-lg text-sm"
				:class="tab === t.key ? 'bg-surface-white font-medium shadow-sm' : 'text-ink-gray-6'"
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

		<section v-else-if="tab === 'infos'" class="card divide-y divide-outline-gray-1">
			<div v-for="[label, value] in infos" :key="label" class="flex justify-between gap-4 px-3 py-2.5 text-sm">
				<span class="text-ink-gray-6">{{ label }}</span>
				<span class="text-right font-medium">{{ value }}</span>
			</div>
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
				<li v-for="e in historique" :key="e.key" class="card p-3">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<p class="text-xs text-ink-gray-6">{{ e.kind }} · {{ formatDay(e.date) }}</p>
							<p class="font-medium">{{ e.title }}</p>
						</div>
						<StatusPill :status="e.status" />
					</div>
					<p v-if="e.detail" class="mt-1 line-clamp-3 text-sm text-ink-gray-7">{{ e.detail }}</p>
				</li>
			</ol>
		</section>
	</div>
</template>
