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
import AttributionButton from './AttributionButton.vue'
import EtudeActions from './EtudeActions.vue'
import EtudePiecesResume from './EtudePiecesResume.vue'
import TagEditor from './TagEditor.vue'
import { formatDay } from '@/lib/display'
import { actionLabel, blockedText, etudeHeaderActions, formatQuantity, isPrimaryEtudeAction } from '@/lib/etudes'
import { useDrawerControls } from '@/lib/useDrawerControls'
import { useEtude } from '@/lib/useEtude'

const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [tab?: string]; changed: [] }>()

const { etude, assigneeOptions, assign, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh } = useEtude(
	() => props.id,
	() => emit('changed'),
)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

const actions = ref<InstanceType<typeof EtudeActions> | null>(null)
const headerActions = computed(() => (etude.value ? etudeHeaderActions(etude.value) : []))
function onTags(tags: string[]) {
	if (etude.value) etude.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu de l'étude">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Étude précédente" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Étude suivante" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
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
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Cette étude n'existe pas, ou elle n'est pas du ressort de votre équipe.</p>
			<p v-else-if="!etude" class="py-8 text-center text-ink-gray-6">Chargement de l'étude…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold tabular-nums">{{ etude.name }}</h2>
						<StatusPill :status="etude.status" />
						<span class="urgence" :class="`urgence-${etude.urgence}`">{{ etude.urgence }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [etude.procede, `${formatQuantity(etude.quantite)} ex.`, etude.retirage && 'Retirage'].filter(Boolean).join(' · ') }}</p>
					<TagEditor class="mt-1.5" :doctype="etude.doctype" :name="etude.name" :modified="etude.modified" :tags="etude.tags" :can-edit="etude.can_write" @changed="onTags" />
				</div>

				<div v-if="headerActions.length || etude.can_assign" class="record-actions record-actions-start">
					<AttributionButton v-if="etude.can_assign" :ticket="etude" :options="assigneeOptions" can-assign :busy="busy" @assign="assign" />
					<button v-for="item in headerActions" :key="item.action" type="button" :class="isPrimaryEtudeAction(item.action) ? 'btn-primary' : 'btn-secondary'" :disabled="busy || item.missing.length > 0" :title="item.missing.length ? blockedText(etude) : undefined" @click="actions?.run(item.action)">{{ actionLabel(item.action) }}</button>
				</div>

				<dl class="bureau-drawer-facts">
					<div><dt>Article</dt><dd class="truncate" :title="etude.designation"><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: etude.article } }">{{ etude.designation }}</RouterLink></dd></div>
					<div><dt>Client</dt><dd class="truncate" :title="etude.client_label"><RouterLink class="ref-link" :to="{ name: 'Client', params: { id: etude.client } }">{{ etude.client_label }}</RouterLink></dd></div>
					<div><dt>Échéance</dt><dd class="tabular-nums" :class="etude.retard && 'etude-late'">{{ formatDay(etude.echeance) || '—' }}</dd></div>
					<div><dt>Livraison souhaitée</dt><dd class="tabular-nums">{{ formatDay(etude.livraison) || '—' }}</dd></div>
					<div v-if="etude.demande"><dt>Demande</dt><dd class="truncate tabular-nums"><RouterLink class="ref-link" :to="{ name: 'Demande', params: { id: etude.demande } }">{{ etude.demande }}</RouterLink></dd></div>
					<div><dt>Attribution</dt><dd class="truncate" :title="etude.assigne_a_nom || undefined">{{ etude.assigne_a_nom || 'Non attribuée' }}</dd></div>
				</dl>

				<p v-if="actionError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ actionError }}</p>

				<EtudePiecesResume :etude="etude" />

				<section v-if="etude.observations" class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Observations</h3>
					<p class="whitespace-pre-line text-sm">{{ etude.observations }}</p>
				</section>

				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="etude.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ etude.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="etude.comments.last.at" :title="exactTime(etude.comments.last.at)">{{ relativeTime(etude.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="etude.comments.last.parts" />
						<button type="button" class="text-sm text-link" @click="emit('open', 'activite')">{{ etude.comments.count > 1 ? `Voir les ${etude.comments.count} commentaires` : 'Voir le fil' }}</button>
					</template>
					<p v-else class="text-ink-gray-6">
						Aucun commentaire.
						<button type="button" class="text-link" @click="emit('open', 'activite')">Écrire le premier</button>
					</p>
				</section>
			</template>
		</div>
		<EtudeActions v-if="etude" ref="actions" :etude="etude" :busy="busy" :perform="perform" @done="notice = $event" />
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</aside>
</template>
