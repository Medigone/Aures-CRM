<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideSearch from '~icons/lucide/search'
import StatusPill from './StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { commandeEnCours, devisOuvert, fabricationProgress, reclamationOuverte, ticketAlerte, ticketOuvert } from '@/lib/affaires'
import { formatDay, normalizeSearch } from '@/lib/format'
import { formatMoney } from '@/lib/text'

/** Tickets, devis, commandes et réclamations : du portefeuille, ou d'un client (`client`). */
const props = defineProps<{ client?: string }>()
const store = useCommercialStore()

type Segment = 'tickets' | 'devis' | 'commandes' | 'reclamations'
const segment = ref<Segment>('tickets')
const ouverts = ref(true)
const query = ref('')

const mine = <T extends { client: string }>(rows: T[]) => (props.client ? rows.filter((r) => r.client === props.client) : rows)
const matches = (...values: (string | null | undefined)[]) => {
	const q = normalizeSearch(query.value)
	return !q || normalizeSearch(values.join(' ')).includes(q)
}

type Row = { key: string; to: object; title: string; subtitle: string; meta: string; status: string; alert?: string | null; pending?: boolean; progress?: number | null }
const rows = computed<Row[]>(() => {
	if (segment.value === 'tickets')
		return mine(store.tickets)
			.filter((t) => !ouverts.value || ticketOuvert(t))
			.filter((t) => matches(t.customer_name, t.request_type, t.name, t.description))
			.map((t) => ({
				key: t.name,
				to: { name: 'Ticket', params: { id: t.name } },
				title: t.request_type || 'Ticket',
				subtitle: t.customer_name || t.client,
				meta: `${t.name.startsWith('local:') ? 'À envoyer' : t.name} · ${formatDay(t.creation_date)}${t.niveau_urgence && t.niveau_urgence !== 'U0' ? ` · ${t.niveau_urgence}` : ''}`,
				status: t.status,
				alert: ticketAlerte(t),
				pending: t._pending,
			}))
	if (segment.value === 'devis')
		return mine(store.devis)
			.filter((d) => !ouverts.value || devisOuvert(d))
			.filter((d) => matches(d.customer_name, d.name, ...d.lignes.map((l) => l.item_name)))
			.map((d) => ({
				key: d.name,
				to: { name: 'Devis', params: { id: d.name } },
				title: d.name,
				subtitle: d.customer_name || d.client,
				meta: `${formatDay(d.date)} · ${formatMoney(d.grand_total, d.currency)}`,
				status: d.statut_commande || d.status,
			}))
	if (segment.value === 'commandes')
		return mine(store.commandes)
			.filter((c) => !ouverts.value || commandeEnCours(c))
			.filter((c) => matches(c.customer_name, c.name, c.bon_commande_client, ...c.lignes.map((l) => l.item_name)))
			.map((c) => ({
				key: c.name,
				to: { name: 'Commande', params: { id: c.name } },
				title: c.bon_commande_client ? `BC ${c.bon_commande_client}` : c.name,
				subtitle: c.customer_name || c.client,
				meta: `${c.name} · livraison ${formatDay(c.delivery_date)}`,
				status: c.status,
				progress: fabricationProgress(c.fabrication)?.percent ?? null,
			}))
	return mine(store.reclamations)
		.filter((r) => !ouverts.value || reclamationOuverte(r))
		.filter((r) => matches(r.nom_client, r.type_reclamation, r.name))
		.map((r) => ({
			key: r.name,
			to: { name: 'Reclamation', params: { id: r.name } },
			title: r.type_reclamation || 'Réclamation',
			subtitle: r.nom_client || r.client,
			meta: `${r.name} · échéance ${formatDay(r.date_echeance)}`,
			status: r.status,
		}))
})

const segments: { key: Segment; label: string }[] = [
	{ key: 'tickets', label: 'Tickets' },
	{ key: 'devis', label: 'Devis' },
	{ key: 'commandes', label: 'Commandes' },
	{ key: 'reclamations', label: 'Réclam.' },
]
const counts = computed(() => ({
	tickets: mine(store.tickets).filter(ticketOuvert).length,
	devis: mine(store.devis).filter(devisOuvert).length,
	commandes: mine(store.commandes).filter(commandeEnCours).length,
	reclamations: mine(store.reclamations).filter(reclamationOuverte).length,
}))
</script>

<template>
	<div>
		<div class="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-surface-gray-2 p-1" role="tablist">
			<button
				v-for="s in segments"
				:key="s.key"
				type="button"
				role="tab"
				:aria-selected="segment === s.key"
				class="min-h-10 rounded-lg text-sm"
				:class="segment === s.key ? 'bg-surface-white font-medium shadow-sm' : 'text-ink-gray-6'"
				@click="segment = s.key"
			>
				{{ s.label }}<template v-if="counts[s.key]"> ({{ counts[s.key] }})</template>
			</button>
		</div>
		<div class="mb-3 flex items-center gap-2">
			<label class="search-box flex-1">
				<LucideSearch class="h-5 w-5 text-ink-gray-5" aria-hidden="true" />
				<input v-model="query" type="search" class="min-h-11 w-full border-0 bg-transparent p-0 text-base focus:ring-0" placeholder="Rechercher…" aria-label="Rechercher" />
			</label>
			<button type="button" :class="ouverts ? 'chip-on' : 'chip-off'" @click="ouverts = !ouverts">{{ ouverts ? 'En cours' : 'Tous' }}</button>
		</div>
		<p v-if="!rows.length" class="py-8 text-center text-sm text-ink-gray-6">{{ ouverts ? 'Rien en cours.' : 'Aucun élément.' }}</p>
		<div class="space-y-2">
			<RouterLink v-for="r in rows" :key="r.key" :to="r.to" class="card-link p-3">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="truncate font-medium">{{ r.title }}</p>
						<p v-if="!client" class="truncate text-sm text-ink-gray-6">{{ r.subtitle }}</p>
						<p class="truncate text-xs text-ink-gray-6">{{ r.meta }}</p>
					</div>
					<span class="flex shrink-0 items-center gap-2">
						<span v-if="r.pending" class="pending-dot" title="En attente d'envoi" />
						<StatusPill :status="r.status" />
					</span>
				</div>
				<p v-if="r.alert" class="mt-1 text-xs font-medium text-ink-amber-3">{{ r.alert }}</p>
				<div v-if="r.progress != null" class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-gray-2">
					<div class="h-full rounded-full bg-accent" :style="{ width: `${r.progress}%` }" />
				</div>
			</RouterLink>
		</div>
	</div>
</template>
