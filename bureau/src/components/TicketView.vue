<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import AppToast from './AppToast.vue'
import ActionButtons from './ActionButtons.vue'
import AttributionButton from './AttributionButton.vue'
import CreanceCard from './CreanceCard.vue'
import DemandeDialog from './DemandeDialog.vue'
import DocumentsCard from './DocumentsCard.vue'
import PiecesCard from './PiecesCard.vue'
import RapprochementCard from './RapprochementCard.vue'
import StepTimeline from './StepTimeline.vue'
import TicketStatus from './TicketStatus.vue'
import UrgenceCard from './UrgenceCard.vue'
import { htmlToText } from '@shared/text'
import { setArticlesVerified, ticketActivity } from '@/lib/api'
import { deskUrl, formatDay, missingPieces, primaryTicketActions, stepHelp } from '@/lib/display'
import TagEditor from './TagEditor.vue'
import { useTicket } from '@/lib/useTicket'

const props = defineProps<{ id: string; step?: number | null; goToActivity?: boolean }>()
const router = useRouter()
const emit = defineEmits<{ changed: [] }>()

const { ticket, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh, isClosed, followIndex, urgencePending, banner, assigneeOptions, canAssign, assign } = useTicket(
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
// Toutes les actions vivent dans l'en-tête, à droite d'Attribution. Elles suivent l'étape en cours, pas l'étape consultée.
const currentKey = computed(() => ticket.value?.steps[followIndex.value]?.key)
// Une décision d'urgence en attente passe avant les actions de l'étape : une seule action principale à l'écran.
const primaryActions = computed(() => (urgencePending.value ? [] : primaryTicketActions(currentKey.value)))
// Les cartes de décision y placent leurs boutons : leur saisie reste dans la carte.
const decisionsBar = ref<HTMLElement | null>(null)
const hasPrimaryAction = computed(() => primaryActions.value.some((action) => ticket.value?.actions.includes(action)))
const menuActions = ['Annuler']
const creation = computed(() => ticket.value?.demande_creation)
const canCreateDemande = computed(() => creation.value?.state === 'ready')
const isEssai = computed(() => ticket.value?.request_type === 'Essai Blanc')
// Étape faite : le document existe, une autre demande passe par la carte Cycle du dossier.
const onDoc = computed(() => !isClosed.value && currentKey.value === 'doc' && ticket.value?.steps[followIndex.value]?.state !== 'done')
const viewingDoc = computed(() => !isClosed.value && viewed.value?.key === 'doc' && viewed.value.state !== 'done')
// Le devis retenu mène à la commande : la demande reste possible, en second. Sans décision, la commande garde son accès au Desk.
const demandeFirst = computed(() => canCreateDemande.value && !ticket.value?.devis_rapproche)
const deskForCommande = computed(() => onDoc.value && isBC.value && ticket.value?.decision_rapprochement !== 'Nouvelle demande de faisabilité')
const needsDesk = computed(() => onDoc.value && (isEssai.value || deskForCommande.value))
const deskLabel = computed(() => (isEssai.value ? 'Créer le dossier sur le Desk' : 'Créer la commande sur le Desk'))
// Encore à confirmer : la demande s'ouvre sur sa page.
const toConfirm = computed(() => (!isClosed.value && currentKey.value === 'confirm' ? ticket.value?.cycle.demandes.find((demande) => demande.status === 'Brouillon') : undefined))
const demandeBlocked = computed(() => onDoc.value && creation.value?.state === 'no_procede')
const demandeLabel = computed(() => (ticket.value?.cycle.demandes.length ? 'Créer une autre demande' : onDoc.value && demandeFirst.value ? 'Créer la demande' : 'Créer une demande'))
// Une seule action principale à l'écran.
const demandePrimary = computed(() => !urgencePending.value && (onDoc.value ? demandeFirst.value : !hasPrimaryAction.value && !toConfirm.value && !showRappro.value))
const creatingDemande = ref(false)
const createdDemande = ref('')
function onDemandeCreated(name: string) {
	creatingDemande.value = false
	createdDemande.value = name
	refreshAll()
	emit('changed')
}
function openCreatedDemande() {
	const name = createdDemande.value
	createdDemande.value = ''
	router.push({ name: 'Demande', params: { id: name } })
}
const finishHint = computed(() => (ticket.value ? missingPieces(ticket.value) : ''))
const articles = computed(() => ticket.value?.pieces.find((piece) => piece.key === 'articles'))
const canEditDossier = computed(() => Boolean(ticket.value?.can_write) && !isClosed.value)
function onTags(tags: string[]) {
	if (ticket.value) ticket.value.tags = tags
	emit('changed')
}
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
							<button type="button" class="text-link" @click="showActivity">{{ commentLabel }}</button>
						</p>
						<TagEditor class="mt-1.5" doctype="Ticket Commercial" :name="ticket.name" :modified="ticket.modified" :tags="ticket.tags" :can-edit="ticket.can_write" @changed="onTags" />
					</div>
					<div class="record-actions">
						<AttributionButton :ticket="ticket" :options="assigneeOptions" :can-assign="canAssign" :busy="busy" @assign="assign" />
						<div ref="decisionsBar" class="contents"></div>
						<button v-if="canCreateDemande" type="button" :class="demandePrimary ? 'btn-primary' : 'btn-secondary'" @click="creatingDemande = true">{{ demandeLabel }}</button>
						<button v-else-if="demandeBlocked" type="button" class="btn-primary" disabled>Créer la demande</button>
						<a v-if="needsDesk" :class="demandeFirst ? 'btn-secondary' : 'btn-primary'" :href="deskUrl('Ticket Commercial', ticket.name)" target="_blank" rel="noopener noreferrer">
							{{ deskLabel }}
							<LucideArrowUpRight class="h-4 w-4" aria-hidden="true" />
						</a>
						<RouterLink v-if="toConfirm" class="btn-primary" :to="{ name: 'Demande', params: { id: toConfirm.name } }">Ouvrir la demande {{ toConfirm.name }}</RouterLink>
						<button v-if="canEditDossier && articles?.can_verify" type="button" class="btn-secondary" :disabled="busy" @click="perform(() => setArticlesVerified(ticket!, true))">Articles vérifiés</button>
						<ActionButtons :ticket="ticket" :busy="busy" :perform="perform" :primary="primaryActions" :except="menuActions" />
						<MoreMenu>
							<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
							<a class="app-menu-item" role="menuitem" :href="deskUrl('Ticket Commercial', ticket.name)" target="_blank" rel="noopener noreferrer">
								<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
								Ouvrir sur le Desk
							</a>
							<button v-if="canEditDossier && articles?.verified" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="perform(() => setArticlesVerified(ticket!, false))">Retirer la vérification des articles</button>
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
				</dl>
			</div>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>

			<div class="ticket-dossier">
			<div class="bureau-detail">
				<div class="bureau-center">
					<p v-if="banner" class="rounded-control px-3.5 py-2.5" :class="banner.style">{{ banner.text }}</p>
					<div v-if="viewed" class="step-hero">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<span class="text-xs font-semibold text-selection-ink">Étape {{ viewIndex + 1 }} sur {{ ticket.steps.length }}</span>
							<button v-if="viewIndex !== followIndex" type="button" class="min-h-[var(--ctl)] text-sm text-link" @click="viewStep = null">Revenir à l'étape en cours</button>
						</div>
						<h3 class="text-xl font-semibold">{{ viewed.label }}</h3>
						<p class="text-selection-ink">{{ stepHelp(viewed.key, ticket) }}</p>
						<p v-if="viewingDoc && !isEssai && !canCreateDemande && creation?.reason" class="rounded-control tone-amber px-3 py-2 text-sm">{{ creation.reason }}</p>
						<p v-else-if="viewingDoc && canCreateDemande && ticket.devis_rapproche" class="text-sm text-selection-ink">Une demande reste possible si le devis ne couvre pas la commande : elle remplacera la décision de rapprochement.</p>
					</div>

					<UrgenceCard v-if="urgencePending" :ticket="ticket" :busy="busy" :perform="perform" :actions-bar="decisionsBar" />

					<PiecesCard :ticket="ticket" :busy="busy" :perform="perform" wide />

					<div class="card flex flex-col gap-1 p-3.5">
						<h3 class="text-base font-semibold">Demande du commercial</h3>
						<p class="whitespace-pre-line text-ink-gray-8">{{ htmlToText(ticket.description) || 'Aucune description.' }}</p>
					</div>

					<CreanceCard v-if="showCreance" :ticket="ticket" :busy="busy" :perform="perform" :actions-bar="decisionsBar" />
					<RapprochementCard v-if="showRappro" :ticket="ticket" :busy="busy" :perform="perform" :actions-bar="decisionsBar" />
				</div>

				<div class="bureau-side">
					<StepTimeline :steps="ticket.steps" :viewed="viewIndex" :current="ticket.current_step" @pick="pick" />
					<DocumentsCard :ticket="ticket" :busy="busy" :perform="perform" />
				</div>
			</div>
			<!-- Le fil reste visible, quelle que soit l'étape regardée. -->
			<aside class="record-activity" aria-label="Commentaires et activité du ticket">
				<ActivityFeed ref="feed" :api="activityApi" :version="ticket.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
			</aside>
			</div>
		</template>
		<DemandeDialog v-if="creatingDemande && ticket" :ticket="ticket.name" @close="creatingDemande = false" @created="onDemandeCreated" />
		<AppToast :message="createdDemande ? `Demande ${createdDemande} créée.` : ''" :duration="0" @close="createdDemande = ''">
			<button type="button" class="app-toast-action" @click="openCreatedDemande">Ouvrir la fiche</button>
		</AppToast>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</main>
</template>
