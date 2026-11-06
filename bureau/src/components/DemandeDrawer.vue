<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucideX from '~icons/lucide/x'
import { exactTime, relativeTime } from '@shared/activity'
import CommentText from '@shared/components/CommentText.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import DemandeActions from './DemandeActions.vue'
import DemandeLinesTable from './DemandeLinesTable.vue'
import TagEditor from './TagEditor.vue'
import { demandeNext, typeLabel, DEMANDE_ACTION_LABELS, demandeHeaderActions, isPrimaryDemandeAction } from '@/lib/demandes'
import { formatDay } from '@/lib/display'
import { useDemande } from '@/lib/useDemande'
import { useDrawerControls } from '@/lib/useDrawerControls'

const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [tab?: string]; changed: [] }>()

const { demande, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh } = useDemande(
	() => props.id,
	() => emit('changed'),
)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

const actions = ref<InstanceType<typeof DemandeActions> | null>(null)
const next = computed(() => (demande.value ? demandeNext(demande.value) : null))
const headerActions = computed(() => (demande.value ? demandeHeaderActions(demande.value) : []))
function onTags(tags: string[]) {
	if (demande.value) demande.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu de la demande">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Demande précédente" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Demande suivante" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
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
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Cette demande n'existe pas ou n'existe plus.</p>
			<p v-else-if="!demande" class="py-8 text-center text-ink-gray-6">Chargement de la demande…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold tabular-nums">{{ demande.name }}</h2>
						<StatusPill :status="demande.status" />
						<span class="urgence" :class="`urgence-${demande.urgence}`">{{ demande.urgence }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [typeLabel(demande.type), demande.procede, demande.ticket && `Ticket ${demande.ticket}`].filter(Boolean).join(' · ') }}</p>
					<TagEditor class="mt-1.5" doctype="Demande Faisabilite" :name="demande.name" :modified="demande.modified" :tags="demande.tags" :can-edit="demande.can_write" @changed="onTags" />
				</div>

				<div v-if="headerActions.length" class="record-actions record-actions-start">
					<button v-for="action in headerActions" :key="action" type="button" :class="isPrimaryDemandeAction(action) ? 'btn-primary' : 'btn-secondary'" :disabled="busy" @click="actions?.run(action)">{{ DEMANDE_ACTION_LABELS[action] }}</button>
				</div>

				<dl class="bureau-drawer-facts">
					<div><dt>Client</dt><dd class="truncate" :title="demande.client_label"><RouterLink class="ref-link" :to="{ name: 'Client', params: { id: demande.client } }">{{ demande.client_label }}</RouterLink></dd></div>
					<div><dt>Commercial</dt><dd class="truncate" :title="demande.commercial || undefined">{{ demande.commercial || 'Non attribué' }}</dd></div>
					<div><dt>Livraison souhaitée</dt><dd class="tabular-nums">{{ formatDay(demande.livraison) || '—' }}</dd></div>
					<div><dt>Créée le</dt><dd class="tabular-nums">{{ formatDay(demande.creation) || '—' }}</dd></div>
				</dl>

				<p v-if="actionError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ actionError }}</p>

				<section v-if="next" class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Prochaine action</h3>
					<p>{{ next.title }}. {{ next.text }}</p>
				</section>

				<section class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Articles et études</h3>
					<DemandeLinesTable :demande="demande" kind="articles" with-study />
				</section>

				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="demande.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ demande.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="demande.comments.last.at" :title="exactTime(demande.comments.last.at)">{{ relativeTime(demande.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="demande.comments.last.parts" />
						<button type="button" class="text-sm text-link" @click="emit('open')">{{ demande.comments.count > 1 ? `Voir les ${demande.comments.count} commentaires` : 'Voir le fil' }}</button>
					</template>
					<p v-else class="text-ink-gray-6">
						Aucun commentaire.
						<button type="button" class="text-link" @click="emit('open')">Écrire le premier</button>
					</p>
				</section>

				<DemandeActions ref="actions" :demande="demande" :busy="busy" :perform="perform" @error="actionError = $event" />
			</template>
		</div>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</aside>
</template>
