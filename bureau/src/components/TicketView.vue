<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import ActionButtons from './ActionButtons.vue'
import AssigneeField from './AssigneeField.vue'
import ChecklistCard from './ChecklistCard.vue'
import CreanceCard from './CreanceCard.vue'
import CycleCard from './CycleCard.vue'
import DocumentsCard from './DocumentsCard.vue'
import RapprochementCard from './RapprochementCard.vue'
import StepTimeline from './StepTimeline.vue'
import TicketStatus from './TicketStatus.vue'
import UrgenceCard from './UrgenceCard.vue'
import { htmlToText } from '@shared/text'
import { setAssignee } from '@/lib/api'
import { deskUrl, formatDay, missingChecklist, stepHelp } from '@/lib/display'
import { useTicket } from '@/lib/useTicket'

const props = defineProps<{ id: string; step?: number | null }>()
const emit = defineEmits<{ changed: [] }>()

const { ticket, error, notFound, actionError, notice, busy, load, perform, refresh, isClosed, followIndex, urgencePending, banner, assigneeOptions, canAssign, assign } = useTicket(
	() => props.id,
	() => emit('changed'),
)
defineExpose({ refresh })

// Étape consultée ; `null` : l'écran suit l'étape en cours. L'aperçu peut demander d'ouvrir une étape précise.
const viewStep = ref<number | null>(props.step ?? null)
watch(
	() => [props.id, props.step],
	() => {
		viewStep.value = props.step ?? null
	},
)

const viewIndex = computed(() => {
	const steps = ticket.value?.steps.length ?? 0
	return viewStep.value !== null && viewStep.value >= 0 && viewStep.value < steps ? viewStep.value : followIndex.value
})
const viewed = computed(() => ticket.value?.steps[viewIndex.value])
function pick(index: number) {
	viewStep.value = index === followIndex.value ? null : index
}

const isBC = computed(() => ticket.value?.request_type === 'Bon de commande')
const showCreance = computed(() => isBC.value && viewed.value?.key === 'creance')
const showRappro = computed(() => isBC.value && viewed.value?.key === 'rappro')
const showChecks = computed(() => Boolean(ticket.value?.checklist.length) && ['check', 'fin'].includes(viewed.value?.key || ''))
const heroActions = computed(() => {
	if (viewed.value?.key === 'charge') return ['Démarrer']
	if (viewed.value?.key === 'creance') return ['Débloquer Créance']
	if (viewed.value?.key === 'fin') return ['Terminer']
	return []
})
const needsDesk = computed(() => !isClosed.value && ['doc', 'confirm'].includes(viewed.value?.key || ''))
const finishHint = computed(() => (ticket.value ? missingChecklist(ticket.value) : ''))
const window_user = window.user
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-ink-red-3">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Ce ticket n'existe pas ou n'existe plus.</div>
		<div v-else-if="!ticket" class="card p-8 text-center text-ink-gray-6">Chargement du ticket…</div>

		<template v-else>
			<div class="card flex flex-none flex-col gap-2 p-3.5">
				<div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
					<div class="min-w-0">
						<div class="flex flex-wrap items-center gap-1.5">
							<h2 class="text-xl font-semibold">{{ ticket.request_type }}</h2>
							<TicketStatus :status="ticket.status" />
							<span class="urgence" :class="`urgence-${ticket.niveau_urgence}`">{{ ticket.niveau_urgence }}</span>
						</div>
						<p class="mt-0.5 text-sm text-ink-gray-7">{{ ticket.client }} · {{ ticket.name }}</p>
					</div>
					<div class="flex flex-wrap items-center gap-1.5">
						<a class="inline-flex min-h-[var(--ctl)] items-center gap-1.5 px-2 text-sm font-medium text-accent hover:underline" :href="deskUrl('Ticket Commercial', ticket.name)" target="_blank" rel="noopener noreferrer">
							Ouvrir sur le Desk
							<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
						</a>
						<button v-if="canAssign && !ticket.mine" type="button" class="btn-secondary" :disabled="busy" @click="perform(() => setAssignee(ticket!, String(window_user)))">Me l'attribuer</button>
						<ActionButtons :ticket="ticket" :busy="busy" :perform="perform" />
					</div>
				</div>
				<p v-if="finishHint" class="text-right text-sm" style="color: #8a4b06">{{ finishHint }}</p>
				<dl class="ticket-facts">
					<div class="ticket-fact"><dt>Commercial</dt><dd><span class="truncate" :title="ticket.commercial || undefined">{{ ticket.commercial || '—' }}</span></dd></div>
					<div class="ticket-fact"><dt>Site</dt><dd>{{ ticket.site || '—' }}</dd></div>
					<div class="ticket-fact"><dt>Échéance</dt><dd :class="ticket.is_late && 'text-ink-red-3'">{{ formatDay(ticket.echeance) || 'Sans échéance' }}</dd></div>
					<div class="ticket-fact"><dt>Créé le</dt><dd>{{ formatDay(ticket.creation_date) || '—' }}</dd></div>
					<div class="ticket-fact ticket-fact-assignee">
						<dt><label for="ticket-assignee">Pris en charge par</label></dt>
						<dd>
							<AssigneeField input-id="ticket-assignee" :ticket="ticket" :options="assigneeOptions" :can-assign="canAssign" :busy="busy" @assign="assign" />
						</dd>
					</div>
				</dl>
			</div>

			<p v-if="actionError" role="alert" class="flex-none rounded-xl bg-surface-red-2 px-3.5 py-2.5 text-ink-red-3">{{ actionError }}</p>
			<p v-if="notice" role="status" class="flex-none rounded-xl bg-surface-blue-2 px-3.5 py-2.5 text-ink-blue-3">{{ notice }}</p>

			<div class="bureau-detail">
				<div class="bureau-center">
					<p v-if="banner" class="rounded-xl px-3.5 py-2.5" :class="banner.style">{{ banner.text }}</p>
					<div v-if="viewed" class="step-hero">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<span class="text-xs font-semibold" style="color: #3d4a66">Étape {{ viewIndex + 1 }} sur {{ ticket.steps.length }}</span>
							<button v-if="viewIndex !== followIndex" type="button" class="min-h-[var(--ctl)] text-sm font-medium text-accent hover:underline" @click="viewStep = null">Revenir à l'étape en cours</button>
						</div>
						<h3 class="text-xl font-semibold">{{ viewed.label }}</h3>
						<p style="color: #3d4a66">{{ stepHelp(viewed.key, ticket) }}</p>
						<div v-if="heroActions.length" class="flex flex-wrap gap-2 empty:hidden">
							<ActionButtons :ticket="ticket" :busy="busy" :perform="perform" :only="heroActions" />
						</div>
						<a v-if="needsDesk" class="btn-secondary self-start" :href="deskUrl('Ticket Commercial', ticket.name)" target="_blank" rel="noopener noreferrer">
							Créer sur le Desk
							<LucideArrowUpRight class="h-4 w-4" aria-hidden="true" />
						</a>
					</div>

					<UrgenceCard v-if="urgencePending" :ticket="ticket" :busy="busy" :perform="perform" />

					<div class="card flex flex-col gap-1 p-3.5">
						<h3 class="text-base font-semibold">Demande du commercial</h3>
						<p class="whitespace-pre-line text-ink-gray-8">{{ htmlToText(ticket.description) || 'Aucune description.' }}</p>
					</div>

					<CreanceCard v-if="showCreance" :ticket="ticket" :busy="busy" :perform="perform" />
					<RapprochementCard v-if="showRappro" :ticket="ticket" :busy="busy" :perform="perform" />
					<ChecklistCard v-if="showChecks" :ticket="ticket" :busy="busy" :perform="perform" />
				</div>

				<div class="bureau-side">
					<StepTimeline :steps="ticket.steps" :viewed="viewIndex" :current="ticket.current_step" @pick="pick" />
					<DocumentsCard :ticket="ticket" :busy="busy" :perform="perform" />
					<CycleCard :ticket="ticket" />
				</div>
			</div>
		</template>
	</main>
</template>
