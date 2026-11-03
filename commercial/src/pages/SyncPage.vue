<script setup lang="ts">
import PageHeader from '@/components/PageHeader.vue'
import SyncPill from '@/components/SyncPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay, formatTime } from '@/lib/format'
import { MUTATION_LABELS, keyFrom, type Mutation } from '@/lib/mutations'

/** File d'envoi : saisies en attente, en échec (à réessayer ou abandonner). */
const store = useCommercialStore()

function subject(m: Mutation) {
	const p = m.payload
	if (m.type === 'prospect_create') return p.customer_name
	const ticket = keyFrom(p, 'ticket')
	if (ticket) {
		const t = store.ticketsByName.get(store.resolveKey(ticket))
		if (t) return `${t.request_type} · ${t.customer_name || t.client}`
	}
	const visite = keyFrom(p, 'visite')
	if (visite) {
		const v = store.visitesByName.get(store.resolveKey(visite))
		if (v) return v.nom_client || v.client
	}
	const client = keyFrom(p, 'client')
	if (client) return store.clientsByName.get(store.resolveKey(client))?.customer_name || client
	return ''
}

function discard(m: Mutation) {
	if (window.confirm('Abandonner cette saisie ? Elle ne sera jamais envoyée.')) store.discardFailed(m.id)
}
function discardForeign() {
	if (window.confirm(`Abandonner les saisies de ${store.owner} ? Elles seront perdues.`)) store.discardForeignOutbox()
}
</script>

<template>
	<div>
		<PageHeader title="Synchronisation" :back="{ name: 'Settings' }">
			<template #actions><SyncPill /></template>
		</PageHeader>

		<div v-if="store.foreignOutbox" class="card mb-4 border-amber-300 bg-surface-amber-1 p-3 text-sm">
			<p class="font-medium">Saisies d'un autre compte</p>
			<p class="mt-1 text-ink-gray-7">Cet appareil garde des saisies de {{ store.owner }}. Reconnectez-vous avec ce compte pour les envoyer.</p>
			<button type="button" class="btn-danger mt-2 w-full" @click="discardForeign">Les abandonner</button>
		</div>

		<section class="mb-6">
			<h2 class="section-title mb-2">À corriger ({{ store.failed.length }})</h2>
			<p v-if="!store.failed.length" class="text-sm text-ink-gray-6">Aucune saisie refusée.</p>
			<div class="space-y-2">
				<div v-for="m in store.failed" :key="m.id" class="card p-3">
					<p class="font-medium">{{ MUTATION_LABELS[m.type] }}<template v-if="subject(m)"> · {{ subject(m) }}</template></p>
					<p class="text-xs text-ink-gray-6">Saisie {{ formatDay(m.created_at) }} {{ formatTime(m.created_at) }}</p>
					<p v-if="m.error" class="mt-1 text-sm text-ink-red-3">{{ m.error }}</p>
					<div class="mt-2 flex gap-2">
						<button type="button" class="btn-secondary flex-1" @click="store.retryFailed(m.id)">Réessayer</button>
						<button type="button" class="btn-danger flex-1" @click="discard(m)">Abandonner</button>
					</div>
				</div>
			</div>
		</section>

		<section>
			<h2 class="section-title mb-2">En attente d'envoi ({{ store.outbox.length }})</h2>
			<p v-if="!store.outbox.length" class="text-sm text-ink-gray-6">Tout est envoyé.</p>
			<div class="space-y-2">
				<div v-for="m in store.outbox" :key="m.id" class="card p-3">
					<p class="font-medium">{{ MUTATION_LABELS[m.type] }}<template v-if="subject(m)"> · {{ subject(m) }}</template></p>
					<p class="text-xs text-ink-gray-6">
						Saisie {{ formatDay(m.created_at) }} {{ formatTime(m.created_at) }}<template v-if="m.attempts"> · {{ m.attempts }} essai(s)</template>
					</p>
					<p v-if="m.error" class="mt-1 text-sm text-ink-amber-3">{{ m.error }}</p>
				</div>
			</div>
		</section>
	</div>
</template>
