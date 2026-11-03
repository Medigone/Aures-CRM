<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideSiren from '~icons/lucide/siren'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import NotesField from '@/components/NotesField.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay, relativeDays } from '@/lib/format'
import { ticketAlerte } from '@/lib/affaires'
import { refTo } from '@/lib/mutations'
import { htmlToText } from '@/lib/text'
import type { TicketCycle } from '@/types'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const router = useRouter()
const key = computed(() => store.resolveKey(props.id))
watch(key, (next) => {
	if (next !== props.id) router.replace({ name: 'Ticket', params: { id: next } })
})
const ticket = computed(() => store.ticketsByName.get(key.value) ?? null)
const site = computed(() => store.references?.sites?.find((s) => s.name === ticket.value?.site)?.title || ticket.value?.site)
const alerte = computed(() => (ticket.value ? ticketAlerte(ticket.value) : null))
const editable = computed(() => ticket.value?.docstatus === 0 && !['Terminé', 'Annulé'].includes(ticket.value.status))

// Cycle : en ligne, puis gardé pour la consultation hors-ligne. Rien pour un ticket pas encore envoyé.
const cycle = ref<TicketCycle | null>(null)
const cycleError = ref<string | null>(null)
async function loadCycle() {
	cycle.value = null
	cycleError.value = null
	if (!ticket.value || ticket.value._pending && key.value.startsWith('local:')) return
	cycle.value = await store.cachedCycle(key.value)
	try {
		cycle.value = await store.fetchCycle(key.value)
	} catch (error) {
		cycleError.value = (error as Error).message
	}
}
watch(key, loadCycle, { immediate: true })
const cycleEmpty = computed(() => cycle.value && !cycle.value.demandes.length && !cycle.value.dossiers.length)
const routeFor = (doctype: string, name: string) =>
	doctype === 'Quotation' && store.devisByName.has(name)
		? { name: 'Devis', params: { id: name } }
		: doctype === 'Sales Order' && store.commandesByName.has(name)
			? { name: 'Commande', params: { id: name } }
			: null
const DOCTYPE_LABELS: Record<string, string> = { Quotation: 'Devis', 'Sales Order': 'Commande', 'Etude Faisabilite': 'Étude faisabilité', 'Etude Faisabilite Flexo': 'Étude faisabilité Flexo' }

// Urgence : demande (U1 à U3, motif) ou retrait, traités par l'Administration des ventes.
const askUrgence = ref(false)
const niveau = ref('U1')
const motif = ref('')
const urgenceError = ref<string | null>(null)
function requestUrgence() {
	if (!ticket.value) return
	if (!motif.value.trim()) {
		urgenceError.value = "Expliquez le motif de l'urgence."
		return
	}
	store.enqueue('ticket_urgence_request', { ...refTo('ticket', ticket.value.name), niveau: niveau.value, motif: motif.value.trim() }, ticket.value.name)
	askUrgence.value = false
	motif.value = ''
	urgenceError.value = null
}
function cancelUrgence() {
	if (ticket.value && window.confirm("Retirer la demande d'urgence ?")) store.enqueue('ticket_urgence_cancel', refTo('ticket', ticket.value.name), ticket.value.name)
}
</script>

<template>
	<div v-if="!ticket" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Ticket introuvable" :back="{ name: 'Suivi' }" />
		Ce ticket n'est pas (ou plus) sur cet appareil.
	</div>
	<div v-else>
		<PageHeader :title="ticket.request_type || 'Ticket'" :subtitle="`${ticket.customer_name || ticket.client} · ${key.startsWith('local:') ? 'en attente d\'envoi' : key}`" :back="{ name: 'Suivi' }">
			<template #actions>
				<span v-if="ticket._pending" class="pending-dot" title="En attente d'envoi" />
				<StatusPill :status="ticket.status" />
			</template>
		</PageHeader>

		<p v-if="alerte" class="mb-4 rounded-xl bg-surface-amber-2 px-3 py-2 text-sm text-ink-amber-3">{{ alerte }}</p>

		<section class="card mb-4 divide-y divide-outline-gray-1 text-sm">
			<RouterLink :to="{ name: 'Client', params: { id: ticket.client } }" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Client</span><span class="text-right font-medium text-accent">{{ ticket.customer_name || ticket.client }}</span>
			</RouterLink>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Priorité</span><span class="font-medium">{{ ticket.priority }}</span></div>
			<div v-if="ticket.channel" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Canal</span><span class="font-medium">{{ ticket.channel }}</span></div>
			<div v-if="site" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Site</span><span class="font-medium">{{ site }}</span></div>
			<div v-if="ticket.echeance" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Échéance</span><span class="font-medium">{{ formatDay(ticket.echeance) }}</span></div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Urgence</span><span class="font-medium">{{ ticket.niveau_urgence || 'U0' }}</span></div>
			<div v-if="ticket.statut_creance" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Créance</span><span class="font-medium">{{ ticket.statut_creance }}</span></div>
			<div v-if="ticket.assigne_a_nom" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Pris en charge par</span><span class="font-medium">{{ ticket.assigne_a_nom }}</span></div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Créé</span><span class="font-medium">{{ formatDay(ticket.creation_date) }}</span></div>
		</section>

		<p v-if="ticket.description" class="card mb-4 whitespace-pre-line p-3 text-sm">{{ htmlToText(ticket.description) }}</p>
		<p v-if="ticket.pieces_locales" class="mb-4 text-xs text-ink-gray-6">{{ ticket.pieces_locales }} pièce(s) jointe(s) partiront avec le ticket.</p>
		<p v-if="ticket.motif_blocage_creance" class="mb-4 text-sm text-ink-red-3">Blocage créance : {{ ticket.motif_blocage_creance }}</p>

		<!-- Urgence -->
		<section v-if="editable" class="mb-6">
			<h2 class="section-title mb-2">Urgence</h2>
			<template v-if="ticket.statut_demande_urgence === 'En attente'">
				<p class="mb-2 text-sm text-ink-gray-7">Demande {{ ticket.niveau_urgence_demande }} en attente de validation.</p>
				<button type="button" class="btn-secondary w-full" @click="cancelUrgence">Retirer la demande</button>
			</template>
			<template v-else>
				<p v-if="ticket.statut_demande_urgence === 'Refusée'" class="mb-2 text-sm text-ink-red-3">
					Demande refusée<template v-if="ticket.commentaire_validation_urgence"> : {{ ticket.commentaire_validation_urgence }}</template>
				</p>
				<p v-else-if="ticket.statut_demande_urgence === 'Validée'" class="mb-2 text-sm text-ink-green-3">Urgence {{ ticket.niveau_urgence }} validée.</p>
				<button v-if="!askUrgence" type="button" class="btn-secondary w-full" @click="askUrgence = true">
					<LucideSiren class="h-4 w-4" aria-hidden="true" />Demander une urgence
				</button>
				<button v-if="ticket.statut_demande_urgence === 'Validée' && !askUrgence" type="button" class="btn-secondary mt-2 w-full" @click="cancelUrgence">Retirer l'urgence</button>
				<div v-if="askUrgence" class="card space-y-3 p-3">
					<div class="flex gap-2">
						<button v-for="n in ['U1', 'U2', 'U3']" :key="n" type="button" :class="niveau === n ? 'chip-on' : 'chip-off'" @click="niveau = n">{{ n }}</button>
					</div>
					<NotesField v-model="motif" label="Motif" placeholder="Pourquoi ce délai est-il impératif ?" />
					<p v-if="urgenceError" class="text-sm text-ink-red-3">{{ urgenceError }}</p>
					<div class="flex gap-2">
						<button type="button" class="btn-secondary flex-1" @click="askUrgence = false">Annuler</button>
						<button type="button" class="btn-primary flex-1" @click="requestUrgence">Envoyer la demande</button>
					</div>
				</div>
			</template>
		</section>

		<!-- Cycle -->
		<section class="mb-4">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="section-title">Cycle du ticket</h2>
				<span v-if="cycle" class="text-xs text-ink-gray-6">mis à jour : {{ relativeDays(cycle.fetched_at).toLowerCase() }}</span>
			</div>
			<p v-if="key.startsWith('local:')" class="text-sm text-ink-gray-6">Le cycle s'affichera une fois le ticket envoyé.</p>
			<p v-else-if="!cycle && !store.online" class="text-sm text-ink-gray-6">Cycle non consulté sur cet appareil : il se chargera dès le retour du réseau.</p>
			<p v-else-if="cycleError && !cycle" class="text-sm text-ink-red-3">{{ cycleError }}</p>
			<p v-else-if="cycleEmpty" class="text-sm text-ink-gray-6">Aucune demande de faisabilité ni devis pour l'instant.</p>
			<template v-if="cycle">
				<div v-for="d in [...cycle.demandes, ...cycle.dossiers]" :key="d.name" class="card mb-2 p-3 text-sm">
					<div class="flex justify-between gap-2">
						<span class="font-medium">{{ d.name }}<template v-if="'type' in d && d.type"> · {{ d.type }}</template></span>
						<StatusPill :status="d.status" />
					</div>
					<ul v-if="d.etudes.length" class="mt-2 space-y-1">
						<li v-for="e in d.etudes" :key="e.name" class="flex justify-between gap-2 text-ink-gray-7">
							<span>{{ DOCTYPE_LABELS[e.doctype || ''] || 'Étude' }} {{ e.name }}<template v-if="e.article"> · {{ e.article }}</template></span>
							<StatusPill :status="e.status" />
						</li>
					</ul>
					<ul v-if="d.sales_documents.length" class="mt-2 space-y-1">
						<li v-for="sd in d.sales_documents" :key="sd.name" class="flex justify-between gap-2">
							<RouterLink v-if="routeFor(sd.doctype, sd.name)" :to="routeFor(sd.doctype, sd.name)!" class="text-accent">{{ DOCTYPE_LABELS[sd.doctype] || sd.doctype }} {{ sd.name }}</RouterLink>
							<span v-else>{{ DOCTYPE_LABELS[sd.doctype] || sd.doctype }} {{ sd.name }}</span>
							<StatusPill :status="sd.status" />
						</li>
					</ul>
				</div>
			</template>
		</section>
	</div>
</template>
