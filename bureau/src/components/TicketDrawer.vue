<script setup lang="ts">
import { ref } from 'vue'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucideX from '~icons/lucide/x'
import AppToast from './AppToast.vue'
import ActionButtons from './ActionButtons.vue'
import AssigneeField from './AssigneeField.vue'
import CycleCard from './CycleCard.vue'
import DocumentsCard from './DocumentsCard.vue'
import StepTimeline from './StepTimeline.vue'
import TicketStatus from './TicketStatus.vue'
import { relativeTime, exactTime } from '@shared/activity'
import CommentText from '@shared/components/CommentText.vue'
import { htmlToText } from '@shared/text'
import { formatDay, stepHelp } from '@/lib/display'
import TagEditor from './TagEditor.vue'
import { useDrawerControls } from '@/lib/useDrawerControls'
import { useTicket } from '@/lib/useTicket'

const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [step?: number, activity?: boolean]; changed: [] }>()

const { ticket, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh, followIndex, urgencePending, banner, assigneeOptions, canAssign, assign } = useTicket(
	() => props.id,
	() => emit('changed'),
)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })
function onTags(tags: string[]) {
	if (ticket.value) ticket.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu du ticket">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Ticket précédent" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Ticket suivant" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
			<span class="text-xs text-ink-gray-6">{{ position }}</span>
			<span class="flex-auto"></span>
			<button type="button" class="btn-primary" @click="emit('open')">
				Ouvrir la fiche
				<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
			</button>
			<button type="button" class="icon-btn" aria-label="Fermer l'aperçu" @click="emit('close')"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
		</div>

		<div class="bureau-drawer-body">
			<p v-if="error" role="alert" class="text-tone-red">
				{{ error }}
				<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
			</p>
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Ce ticket n'existe pas ou n'existe plus.</p>
			<p v-else-if="!ticket" class="py-8 text-center text-ink-gray-6">Chargement du ticket…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold">{{ ticket.request_type }}</h2>
						<TicketStatus :status="ticket.status" />
						<span class="urgence" :class="`urgence-${ticket.niveau_urgence}`">{{ ticket.niveau_urgence }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ ticket.client }} · {{ ticket.name }}</p>
					<TagEditor class="mt-1.5" doctype="Ticket Commercial" :name="ticket.name" :modified="ticket.modified" :tags="ticket.tags" :can-edit="ticket.can_write" @changed="onTags" />
				</div>

				<p v-if="actionError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ actionError }}</p>
				<p v-if="urgencePending" class="tone-amber rounded-control px-3 py-2 text-sm">Urgence {{ ticket.niveau_urgence_demande }} à décider : ouvrez la fiche pour répondre.</p>
				<p v-if="banner" class="rounded-control px-3 py-2 text-sm" :class="banner.style">{{ banner.text }}</p>

				<div class="step-hero">
					<span class="text-xs font-semibold text-selection-ink">Étape {{ followIndex + 1 }} sur {{ ticket.steps.length }}</span>
					<h3 class="text-base font-semibold">{{ ticket.steps[followIndex].label }}</h3>
					<p class="text-sm text-selection-ink">{{ stepHelp(ticket.steps[followIndex].key, ticket) }}</p>
					<div class="flex flex-wrap gap-1.5 empty:hidden">
						<ActionButtons :ticket="ticket" :busy="busy" :perform="perform" :only="['Démarrer', 'Reprendre']" />
					</div>
				</div>

				<dl class="bureau-drawer-facts">
					<div><dt>Commercial</dt><dd class="truncate" :title="ticket.commercial || undefined">{{ ticket.commercial || '—' }}</dd></div>
					<div><dt>Site</dt><dd class="truncate">{{ ticket.site || '—' }}</dd></div>
					<div><dt>Échéance</dt><dd :class="ticket.is_late && 'text-tone-red'">{{ formatDay(ticket.echeance) || 'Sans échéance' }}</dd></div>
					<div><dt>Créé le</dt><dd>{{ formatDay(ticket.creation_date) || '—' }}</dd></div>
					<div v-if="ticket.request_type === 'Bon de commande'"><dt>Créance</dt><dd>{{ ticket.statut_creance || 'Non vérifiée' }}</dd></div>
					<div>
						<dt><label for="apercu-assignee">Pris en charge par</label></dt>
						<dd><AssigneeField input-id="apercu-assignee" :ticket="ticket" :options="assigneeOptions" :can-assign="canAssign" :busy="busy" @assign="assign" /></dd>
					</div>
				</dl>

				<section class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Demande du commercial</h3>
					<p class="whitespace-pre-line text-ink-gray-8">{{ htmlToText(ticket.description) || 'Aucune description.' }}</p>
				</section>
				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="ticket.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ ticket.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="ticket.comments.last.at" :title="exactTime(ticket.comments.last.at)">{{ relativeTime(ticket.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="ticket.comments.last.parts" />
						<button type="button" class="text-sm text-link" @click="emit('open', undefined, true)">{{ ticket.comments.count > 1 ? `Voir les ${ticket.comments.count} commentaires` : 'Voir le fil' }}</button>
					</template>
					<p v-else class="text-ink-gray-6">
						Aucun commentaire.
						<button type="button" class="text-link" @click="emit('open', undefined, true)">Écrire le premier</button>
					</p>
				</section>
				<StepTimeline :steps="ticket.steps" :viewed="-1" :current="ticket.current_step" @pick="emit('open', $event)" />
				<DocumentsCard :ticket="ticket" :busy="busy" :perform="perform" />
				<CycleCard :ticket="ticket" />
			</template>
		</div>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</aside>
</template>
