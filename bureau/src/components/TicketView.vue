<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
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
import { setAssignee, ticketActivity } from '@/lib/api'
import { deskUrl, formatDay, missingChecklist, stepHelp } from '@/lib/display'
import { useTicket } from '@/lib/useTicket'

const props = defineProps<{ id: string; step?: number | null; goToActivity?: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const { ticket, error, notFound, actionError, notice, busy, load, perform, refresh, isClosed, followIndex, urgencePending, banner, assigneeOptions, canAssign, assign } = useTicket(
	() => props.id,
	() => emit('changed'),
)

const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const activityApi = computed(() => ticketActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll })

async function showActivity() {
	await nextTick()
	feed.value?.root?.scrollIntoView?.({ block: 'start' })
}
// Depuis l'aperçu : la fiche s'ouvre sur le fil, une fois le ticket chargé.
watch(
	() => [ticket.value?.name, props.goToActivity],
	([name, wanted]) => {
		if (name && wanted) showActivity()
	},
)
const commentLabel = computed(() => {
	const count = ticket.value?.comments.count ?? 0
	return count ? `${count} commentaire${count > 1 ? 's' : ''}` : 'Commenter'
})
async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}

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
// L'action principale de la fiche vit dans l'encart d'étape ; l'en-tête ne garde que des actions secondaires.
const heroActions = computed(() => {
	const key = viewed.value?.key
	return ['Reprendre', ...(key === 'charge' ? ['Démarrer'] : key === 'creance' ? ['Débloquer Créance'] : key === 'fin' ? ['Terminer'] : [])]
})
const menuActions = ['Annuler']
const needsDesk = computed(() => !isClosed.value && ['doc', 'confirm'].includes(viewed.value?.key || ''))
const finishHint = computed(() => (ticket.value ? missingChecklist(ticket.value) : ''))
const window_user = window.user
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
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
							<h2 class="page-title">{{ ticket.request_type }}</h2>
							<TicketStatus :status="ticket.status" />
							<span class="urgence" :class="`urgence-${ticket.niveau_urgence}`">{{ ticket.niveau_urgence }}</span>
						</div>
						<p class="mt-0.5 text-sm text-ink-gray-7">
							{{ ticket.client }} · {{ ticket.name }} ·
							<button type="button" class="font-medium text-accent hover:underline" @click="showActivity">{{ commentLabel }}</button>
						</p>
					</div>
					<div class="flex flex-wrap items-center gap-1.5">
						<button v-if="canAssign && !ticket.mine" type="button" class="btn-secondary" :disabled="busy" @click="perform(() => setAssignee(ticket!, String(window_user)))">Me l'attribuer</button>
						<ActionButtons :ticket="ticket" :busy="busy" :perform="perform" secondary :except="[...heroActions, ...menuActions]" />
						<MoreMenu>
							<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
							<a class="app-menu-item" role="menuitem" :href="deskUrl('Ticket Commercial', ticket.name)" target="_blank" rel="noopener noreferrer">
								<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
								Ouvrir sur le Desk
							</a>
							<ActionButtons :ticket="ticket" :busy="busy" :perform="perform" in-menu :only="menuActions" />
						</MoreMenu>
					</div>
				</div>
				<p v-if="finishHint" class="text-right text-sm text-tone-amber">{{ finishHint }}</p>
				<dl class="ticket-facts">
					<div class="ticket-fact"><dt>Commercial</dt><dd><span class="truncate" :title="ticket.commercial || undefined">{{ ticket.commercial || '—' }}</span></dd></div>
					<div class="ticket-fact"><dt>Site</dt><dd>{{ ticket.site || '—' }}</dd></div>
					<div class="ticket-fact"><dt>Échéance</dt><dd :class="ticket.is_late && 'text-tone-red'">{{ formatDay(ticket.echeance) || 'Sans échéance' }}</dd></div>
					<div class="ticket-fact"><dt>Créé le</dt><dd>{{ formatDay(ticket.creation_date) || '—' }}</dd></div>
					<div class="ticket-fact ticket-fact-assignee">
						<dt><label for="ticket-assignee">Pris en charge par</label></dt>
						<dd>
							<AssigneeField input-id="ticket-assignee" :ticket="ticket" :options="assigneeOptions" :can-assign="canAssign" :busy="busy" @assign="assign" />
						</dd>
					</div>
				</dl>
			</div>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>
			<p v-if="notice" role="status" class="flex-none rounded-control tone-blue px-3.5 py-2.5">{{ notice }}</p>

			<div class="bureau-detail">
				<div class="bureau-center">
					<p v-if="banner" class="rounded-control px-3.5 py-2.5" :class="banner.style">{{ banner.text }}</p>
					<div v-if="viewed" class="step-hero">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<span class="text-xs font-semibold text-selection-ink">Étape {{ viewIndex + 1 }} sur {{ ticket.steps.length }}</span>
							<button v-if="viewIndex !== followIndex" type="button" class="min-h-[var(--ctl)] text-sm font-medium text-accent hover:underline" @click="viewStep = null">Revenir à l'étape en cours</button>
						</div>
						<h3 class="text-xl font-semibold">{{ viewed.label }}</h3>
						<p class="text-selection-ink">{{ stepHelp(viewed.key, ticket) }}</p>
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
					<ActivityFeed ref="feed" :api="activityApi" :version="ticket.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
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
