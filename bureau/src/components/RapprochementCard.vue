<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import { formatMoney } from '@shared/text'
import { decideRapprochement, getCandidates } from '@/lib/api'
import { deskUrl, formatDay } from '@/lib/display'
import type { CandidateDemande, Perform, TicketDetail } from '@/types'

const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform }>()

const RETAINED = 'Devis retenu pour commande'
const ALTERNATIVES = ['Nouvelle demande de faisabilité', 'Aucun candidat pertinent']

const candidates = ref<CandidateDemande[] | null>(null)
const error = ref('')
const comment = ref('')
const editable = computed(() => props.ticket.can_write && props.ticket.status === 'En Cours')
const commentChanged = computed(() => comment.value.trim() !== (props.ticket.commentaire_rapprochement || '').trim())

async function load() {
	candidates.value = null
	error.value = ''
	const name = props.ticket.name
	try {
		const response = await getCandidates(name)
		if (props.ticket.name === name) candidates.value = response.candidates
	} catch (e) {
		if (props.ticket.name === name) error.value = (e as Error).message
	}
}
watch(() => props.ticket.name, load, { immediate: true })
watch(
	() => [props.ticket.name, props.ticket.commentaire_rapprochement],
	() => {
		comment.value = props.ticket.commentaire_rapprochement || ''
	},
	{ immediate: true },
)

const isRetained = (devis: string) => props.ticket.decision_rapprochement === RETAINED && props.ticket.devis_rapproche === devis

function decide(decision: string, devis: string | null = null) {
	return props.perform(() => decideRapprochement(props.ticket, decision, devis, comment.value))
}
const toggleDevis = (devis: string) => decide(isRetained(devis) ? '' : RETAINED, isRetained(devis) ? null : devis)
const toggleAlternative = (decision: string) => decide(props.ticket.decision_rapprochement === decision ? '' : decision)
const saveComment = () => decide(props.ticket.decision_rapprochement || '', props.ticket.devis_rapproche)

const quantity = (value: number) => new Intl.NumberFormat('fr-FR').format(value)
</script>

<template>
	<div class="card flex flex-col gap-2 p-3.5">
		<div class="flex flex-wrap items-baseline justify-between gap-2">
			<h3 class="text-base font-semibold">Rapprochement avec un devis</h3>
			<span class="text-xs text-ink-gray-6">Demandes des 6 derniers mois</span>
		</div>
		<p class="text-sm">
			<span class="text-ink-gray-6">Décision : </span>
			<span class="font-medium">{{ ticket.decision_rapprochement || 'Pas encore décidée' }}</span>
		</p>
		<p v-if="error" role="alert" class="text-sm text-tone-red">{{ error }}</p>
		<p v-else-if="!candidates" class="text-ink-gray-6">Chargement des candidats…</p>
		<p v-else-if="!candidates.length" class="text-ink-gray-6">Aucune demande de faisabilité récente pour ce client.</p>
		<div v-for="demande in candidates || []" :key="demande.name" class="flex flex-col gap-1.5 rounded-control border border-outline-gray-2 p-2.5">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<a :href="deskUrl('Demande Faisabilite', demande.name)" target="_blank" rel="noopener noreferrer" class="font-semibold text-accent hover:underline">{{ demande.name }}</a>
				<StatusPill :status="demande.demande_status" />
			</div>
			<p class="text-xs text-ink-gray-6">{{ demande.demande_type }} · {{ formatDay(demande.date_creation) }}</p>
			<p v-if="!demande.quotations.length" class="text-sm text-ink-gray-6">Aucun devis commandable.</p>
			<div v-for="devis in demande.quotations" :key="devis.name" class="flex flex-col gap-1 rounded-lg p-2" :class="isRetained(devis.name) ? 'border-2 border-primary' : 'bg-surface-gray-1'">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<a :href="deskUrl('Quotation', devis.name)" target="_blank" rel="noopener noreferrer" class="font-medium hover:underline">{{ devis.name }}</a>
					<StatusPill :status="devis.command_analysis?.custom_status || devis.status" />
				</div>
				<p class="text-xs text-ink-gray-6">{{ formatDay(devis.transaction_date) }} · {{ formatMoney(devis.grand_total, devis.currency) }}</p>
				<div v-for="item in devis.items" :key="item.item_code" class="flex justify-between gap-3 text-sm">
					<span class="min-w-0 break-words">{{ item.item_name }}</span>
					<span class="shrink-0 tabular-nums">{{ quantity(item.qty) }}</span>
				</div>
				<button type="button" class="btn-secondary mt-1 self-start" :disabled="busy || !editable" @click="toggleDevis(devis.name)">
					{{ isRetained(devis.name) ? 'Devis retenu : retirer' : 'Retenir ce devis' }}
				</button>
			</div>
		</div>
		<div class="flex flex-wrap gap-2">
			<button
				v-for="decision in ALTERNATIVES"
				:key="decision"
				type="button"
				:class="ticket.decision_rapprochement === decision ? 'chip-on' : 'chip-off'"
				class="disabled:cursor-not-allowed disabled:opacity-50"
				:aria-pressed="ticket.decision_rapprochement === decision"
				:disabled="busy || !editable"
				@click="toggleAlternative(decision)"
			>
				{{ decision }}
			</button>
		</div>
		<label class="block">
			<span class="field-label">Commentaire</span>
			<textarea v-model="comment" class="field-input" rows="2" :disabled="busy || !editable"></textarea>
		</label>
		<button v-if="commentChanged && editable" type="button" class="btn-secondary self-start" :disabled="busy" @click="saveComment">Enregistrer le commentaire</button>
	</div>
</template>
