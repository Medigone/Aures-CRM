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
import TagEditor from './TagEditor.vue'
import { isImageFile } from '@/lib/articles'
import { formatDay } from '@/lib/display'
import { dimensionsText, fileKindLabel, isObsolete, versionLabel } from '@/lib/traces'
import { useDrawerControls } from '@/lib/useDrawerControls'
import { useTrace } from '@/lib/useTrace'

const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [tab?: string]; changed: [] }>()

const { trace, error, notFound, notice, noticeTone, load, refresh } = useTrace(
	() => props.id,
	() => emit('changed'),
)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

const imageUrl = computed(() => (trace.value?.fichier && isImageFile(trace.value.fichier.url) ? trace.value.fichier.url : null))
const live = computed(() => (trace.value?.impositions ?? []).filter((row) => !row.obsolete))
function onTags(tags: string[]) {
	if (trace.value) trace.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu du tracé">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Tracé précédent" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Tracé suivant" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
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
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Ce tracé n'existe pas, ou il n'est pas du ressort de votre équipe.</p>
			<p v-else-if="!trace" class="py-8 text-center text-ink-gray-6">Chargement du tracé…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold tabular-nums">{{ trace.name }}</h2>
						<StatusPill :status="trace.statut" />
						<span class="list-tag tone-gray tabular-nums">{{ versionLabel(trace.ver) }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [trace.procede, trace.dimensions && `${dimensionsText(trace.dimensions)} mm`].filter(Boolean).join(' · ') }}</p>
					<TagEditor class="mt-1.5" doctype="Trace" :name="trace.name" :modified="trace.modified" :tags="trace.tags" :can-edit="trace.can_write" @changed="onTags" />
				</div>

				<p v-if="isObsolete(trace)" class="rounded-control tone-amber px-3 py-2 text-sm">
					Version remplacée<template v-if="trace.remplacee_par"> par <RouterLink class="ref-link" :to="{ name: 'Trace', params: { id: trace.remplacee_par } }">{{ trace.remplacee_par }}</RouterLink></template>.
				</p>

				<dl class="bureau-drawer-facts">
					<div><dt>Article</dt><dd class="truncate" :title="trace.designation"><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: trace.article } }">{{ trace.designation }}</RouterLink></dd></div>
					<div><dt>Client</dt><dd class="truncate" :title="trace.client_label"><RouterLink class="ref-link" :to="{ name: 'Client', params: { id: trace.client } }">{{ trace.client_label }}</RouterLink></dd></div>
					<div v-if="trace.procede !== 'Flexo'"><dt>Points de colle</dt><dd class="tabular-nums">{{ trace.points_colle }}</dd></div>
					<div><dt>Fichier</dt><dd><a v-if="trace.fichier" class="ref-link" :href="trace.fichier.url" target="_blank" rel="noopener noreferrer" :title="trace.fichier.name">{{ fileKindLabel(trace.fichier.kind) }}, ouvrir</a><span v-else class="text-ink-gray-6">Aucun</span></dd></div>
					<div v-if="trace.impositions"><dt>Impositions valables</dt><dd class="tabular-nums">{{ live.length || 'Aucune' }}</dd></div>
					<div><dt>Mise en service le</dt><dd class="tabular-nums">{{ formatDay(trace.date_activation || trace.creation) }}</dd></div>
				</dl>

				<img v-if="imageUrl" class="trace-preview" :src="imageUrl" :alt="`Tracé ${trace.name}`" loading="lazy" />
				<p v-else-if="trace.fichier?.kind === 'pdf'" class="text-sm text-ink-gray-6">PDF lisible par l'atelier d'imposition.</p>

				<section v-if="trace.versions.length > 1" class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Versions</h3>
					<p v-for="row in trace.versions" :key="row.name" class="m-0 text-sm">
						<strong class="font-semibold tabular-nums">{{ versionLabel(row.ver) }}</strong>
						<span class="text-ink-gray-6"> · {{ row.statut }} · {{ formatDay(row.date_activation) }}</span>
					</p>
				</section>

				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="trace.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ trace.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="trace.comments.last.at" :title="exactTime(trace.comments.last.at)">{{ relativeTime(trace.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="trace.comments.last.parts" />
						<button type="button" class="text-sm text-link" @click="emit('open', 'activite')">{{ trace.comments.count > 1 ? `Voir les ${trace.comments.count} commentaires` : 'Voir le fil' }}</button>
					</template>
					<p v-else class="text-ink-gray-6">
						Aucun commentaire.
						<button type="button" class="text-link" @click="emit('open', 'activite')">Écrire le premier</button>
					</p>
				</section>
			</template>
		</div>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</aside>
</template>
