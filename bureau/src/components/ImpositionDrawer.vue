<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucideX from '~icons/lucide/x'
import { exactTime, relativeTime } from '@shared/activity'
import CommentText from '@shared/components/CommentText.vue'
import AppToast from './AppToast.vue'
import EtudeFeuille from './EtudeFeuille.vue'
import TagEditor from './TagEditor.vue'
import { canRead } from '@/lib/droits'
import { chutesText, idealeText, impositionFlags, origineLabel } from '@/lib/impositions'
import { versionLabel } from '@/lib/traces'
import { useDrawerControls } from '@/lib/useDrawerControls'
import { useImposition } from '@/lib/useImposition'

const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [tab?: string]; changed: [] }>()

const { imposition, error, notFound, actionError, notice, noticeTone, busy, load, refresh, makeIdeale } = useImposition(
	() => props.id,
	() => emit('changed'),
)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

const canSeeTrace = canRead('Trace')
const flags = computed(() => (imposition.value ? impositionFlags(imposition.value) : []))
const atelierRoute = computed<RouteLocationRaw | null>(() => {
	const target = imposition.value?.atelier
	if (!target) return null
	return 'etude' in target ? { name: 'EtudeAtelier', params: { id: target.etude } } : { name: 'Atelier', query: { trace: target.trace } }
})
function onTags(tags: string[]) {
	if (imposition.value) imposition.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu de l'imposition">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Imposition précédente" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Imposition suivante" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
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
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Cette imposition n'existe pas, ou elle n'est pas du ressort de votre équipe.</p>
			<p v-else-if="!imposition" class="py-8 text-center text-ink-gray-6">Chargement de l'imposition…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold tabular-nums">{{ imposition.name }}</h2>
						<span v-for="flag in flags" :key="flag.label" class="list-tag" :class="flag.tone" :title="flag.title">{{ flag.label }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [origineLabel(imposition.origine), imposition.poses && `${imposition.poses} poses`, imposition.chutes !== null && `${chutesText(imposition.chutes)} de chutes`].filter(Boolean).join(' · ') }}</p>
					<TagEditor class="mt-1.5" doctype="Imposition" :name="imposition.name" :modified="imposition.modified" :tags="imposition.tags" :can-edit="imposition.can_write" @changed="onTags" />
				</div>

				<div v-if="atelierRoute || imposition.can_choose" class="record-actions record-actions-start">
					<RouterLink v-if="atelierRoute" class="btn-secondary" :to="atelierRoute">Refaire à l'atelier</RouterLink>
					<button v-if="imposition.can_choose" type="button" class="btn-secondary" :disabled="busy" @click="makeIdeale">Rendre idéale</button>
				</div>
				<p v-if="actionError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ actionError }}</p>
				<p v-if="imposition.obsolete" class="rounded-control tone-amber px-3 py-2 text-sm">Calculée sur une version remplacée du tracé : à refaire.</p>
				<p v-else-if="imposition.ideale" class="text-sm text-ink-gray-6">{{ idealeText(imposition) }}</p>

				<dl class="bureau-drawer-facts">
					<div><dt>Article</dt><dd class="truncate" :title="imposition.designation"><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: imposition.article } }">{{ imposition.designation }}</RouterLink></dd></div>
					<div><dt>Client</dt><dd class="truncate" :title="imposition.client_label">{{ imposition.client_label }}</dd></div>
					<div v-if="imposition.trace"><dt>Tracé</dt><dd class="truncate tabular-nums"><RouterLink v-if="canSeeTrace" class="ref-link" :to="{ name: 'Trace', params: { id: imposition.trace.name } }">{{ imposition.trace.name }}</RouterLink><template v-else>{{ imposition.trace.name }}</template> · {{ versionLabel(imposition.trace.ver) }}</dd></div>
					<div><dt>Format</dt><dd class="tabular-nums">{{ imposition.format ? `${imposition.format} mm` : '—' }}</dd></div>
					<div><dt>Machine</dt><dd class="truncate" :class="!imposition.machine && 'text-ink-gray-6'">{{ imposition.machine || 'Non renseignée' }}</dd></div>
					<div v-if="imposition.n_col"><dt>Grille</dt><dd class="tabular-nums">{{ imposition.n_col }} × {{ imposition.n_rang }}</dd></div>
				</dl>

				<div v-if="imposition.dessin" class="imposition-sheet"><EtudeFeuille :dessin="imposition.dessin" /></div>

				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="imposition.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ imposition.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="imposition.comments.last.at" :title="exactTime(imposition.comments.last.at)">{{ relativeTime(imposition.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="imposition.comments.last.parts" />
						<button type="button" class="text-sm text-link" @click="emit('open', 'activite')">{{ imposition.comments.count > 1 ? `Voir les ${imposition.comments.count} commentaires` : 'Voir le fil' }}</button>
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
