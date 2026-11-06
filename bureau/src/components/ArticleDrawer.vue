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
import ArticleColorsResume from './ArticleColorsResume.vue'
import ClientTicketsTable from './ClientTicketsTable.vue'
import TagEditor from './TagEditor.vue'
import { couleursSansDetail, posesLabel } from '@/lib/articles'
import { formatDay } from '@/lib/display'
import { useArticle } from '@/lib/useArticle'
import { useDrawerControls } from '@/lib/useDrawerControls'

const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [tab?: string]; changed: [] }>()

const { article, error, notFound, load, refresh } = useArticle(() => props.id)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

const technique = computed(() => article.value?.resume_technique)
const teintes = computed(() => article.value?.teintes ?? [])
const couleurs = computed(() => couleursSansDetail(article.value?.couleurs))
const ficheVide = computed(() => !technique.value?.support && !technique.value?.mesure && !article.value?.format && !teintes.value.length && !couleurs.value)
const openTickets = computed(() => (article.value?.tickets ?? []).filter((ticket) => ticket.is_open))
const lastOrder = computed(() => article.value?.commandes[0]?.transaction_date)
const prepresse = computed(() => {
	const current = article.value?.prepresse
	if (!current) return []
	const active = current.maquettes.find((row) => row.status === 'Version Activée') ?? current.maquettes[0]
	const flexo = article.value?.procede === 'Flexo'
	const tool = flexo ? current.cliches[0]?.name : current.impositions[0]?.nbr_poses ? posesLabel(current.impositions[0].nbr_poses) : current.impositions[0]?.name
	return [
		{ label: 'Tracé', value: current.traces[0]?.name },
		{ label: 'Maquette', value: active?.name },
		{ label: flexo ? 'Cliché' : 'Imposition', value: tool },
		{ label: 'BAT', value: current.bats[0]?.name },
	]
})
function onTags(tags: string[]) {
	if (article.value) article.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu de l'article">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Article précédent" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Article suivant" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
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
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Cet article n'existe pas ou n'existe plus.</p>
			<p v-else-if="!article" class="py-8 text-center text-ink-gray-6">Chargement de l'article…</p>

			<template v-else>
				<div>
					<h2 class="text-xl font-semibold">{{ article.designation }}</h2>
					<div class="mt-1 flex flex-wrap items-center gap-1.5">
						<StatusPill v-if="article.bat" :status="article.bat" />
						<span v-if="article.compose" class="record-flag">Composé</span>
						<span v-if="article.sous_article" class="record-flag">Sous-article</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [article.name, article.reference && `Réf. client ${article.reference}`, article.procede].filter(Boolean).join(' · ') }}</p>
					<TagEditor class="mt-1.5" doctype="Item" :name="article.name" :modified="article.modified" :tags="article.tags" :can-edit="article.can_edit" @changed="onTags" />
				</div>

				<dl class="bureau-drawer-facts bureau-drawer-facts-3">
					<div><dt>Client</dt><dd><RouterLink v-if="article.client" class="ref-link inline-link" :to="{ name: 'Client', params: { id: article.client } }">{{ article.client_label }}</RouterLink><template v-else>—</template></dd></div>
					<div><dt>Commercial</dt><dd>{{ article.commercial || '—' }}</dd></div>
					<div><dt>Dernière commande</dt><dd class="tabular-nums">{{ formatDay(lastOrder) || 'Aucune' }}</dd></div>
				</dl>

				<p v-if="article.ecart_bat" role="status" class="rounded-control tone-amber px-3 py-2 text-sm"><strong class="font-semibold">Le BAT validé ne couvre pas la maquette active.</strong> {{ article.ecart_bat.bat }} porte sur {{ article.ecart_bat.maquette_bat }}, la version activée est {{ article.ecart_bat.maquette_active }}.</p>

				<section v-if="article.type !== 'Général' || !ficheVide" class="card flex flex-col gap-2">
					<div class="flex items-baseline justify-between gap-2">
						<h3 class="text-base font-semibold">Fiche technique</h3>
						<button v-if="article.type !== 'Général' && (!ficheVide || article.can_edit)" type="button" class="text-sm text-link" @click="emit('open', 'technique')">{{ ficheVide ? 'Compléter' : 'Voir tout' }}</button>
					</div>
					<p v-if="ficheVide" class="text-ink-gray-6">Fiche technique non renseignée.</p>
					<template v-else>
						<dl class="bureau-drawer-facts bureau-drawer-facts-3">
							<div><dt>Support</dt><dd :class="!technique?.support && 'font-normal text-ink-gray-6'">{{ technique?.support || '—' }}</dd></div>
							<div><dt>Format</dt><dd class="tabular-nums" :class="!article.format && 'font-normal text-ink-gray-6'">{{ article.format ? `${article.format} mm` : '—' }}</dd></div>
							<div><dt>{{ technique?.mesure_label }}</dt><dd class="tabular-nums" :class="!technique?.mesure && 'font-normal text-ink-gray-6'">{{ technique?.mesure || '—' }}</dd></div>
						</dl>
						<dl class="bureau-drawer-colors">
							<dt>Couleurs<template v-if="teintes.length"> · {{ teintes.length }}</template></dt>
							<dd v-if="teintes.length"><ArticleColorsResume :teintes="teintes" /></dd>
							<dd v-else class="font-medium" :class="!couleurs && 'font-normal text-ink-gray-6'">{{ couleurs || 'Non renseignées' }}</dd>
						</dl>
					</template>
				</section>

				<section v-if="article.type !== 'Général'" class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Prépresse</h3>
					<dl class="side-kv">
						<div v-for="item in prepresse" :key="item.label"><dt>{{ item.label }}</dt><dd :class="!item.value && 'font-normal text-ink-gray-6'">{{ item.value || 'Aucun' }}</dd></div>
					</dl>
				</section>

				<section class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Tickets ouverts</h3>
					<ClientTicketsTable :tickets="openTickets.slice(0, 5)" compact empty="Aucun ticket ouvert." />
					<button v-if="openTickets.length > 5" type="button" class="self-start text-sm text-link" @click="emit('open', 'affaires')">Voir les {{ openTickets.length }} tickets</button>
				</section>

				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="article.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ article.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="article.comments.last.at" :title="exactTime(article.comments.last.at)">{{ relativeTime(article.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="article.comments.last.parts" />
						<button type="button" class="text-sm text-link" @click="emit('open', 'activite')">{{ article.comments.count > 1 ? `Voir les ${article.comments.count} commentaires` : 'Voir le fil' }}</button>
					</template>
					<p v-else class="text-ink-gray-6">
						Aucun commentaire.
						<button type="button" class="text-link" @click="emit('open', 'activite')">Écrire le premier</button>
					</p>
				</section>
			</template>
		</div>
	</aside>
</template>
