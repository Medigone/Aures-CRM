<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideCalendar from '~icons/lucide/calendar'
import LucideFlaskConical from '~icons/lucide/flask-conical'
import LucidePackage from '~icons/lucide/package'
import LucidePenTool from '~icons/lucide/pen-tool'
import LucidePrinter from '~icons/lucide/printer'
import LucideScissors from '~icons/lucide/scissors'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import EtudeFeuille from './EtudeFeuille.vue'
import RecordHeader from './RecordHeader.vue'
import TagEditor from './TagEditor.vue'
import { impositionActivity } from '@/lib/api'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import { chutesText, impositionFlags, mmText, origineLabel } from '@/lib/impositions'
import { dimensionsText, versionLabel } from '@/lib/traces'
import { useImposition } from '@/lib/useImposition'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ changed: [] }>()

const { imposition, error, notFound, actionError, notice, noticeTone, busy, load, refresh, makeIdeale, backToAuto } = useImposition(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const activityApi = computed(() => impositionActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, imposition })

watch(feed, async (current) => {
	if (!current || props.tab !== 'activite') return
	await nextTick()
	current.root?.scrollIntoView?.({ block: 'start' })
})

const flags = computed(() => (imposition.value ? impositionFlags(imposition.value) : []))
const canSeeTrace = canRead('Trace')
// L'étude ouverte de l'article, sinon un test rapide avec le tracé en service : rien n'est créé sans étude.
const atelierRoute = computed<RouteLocationRaw | null>(() => {
	const target = imposition.value?.atelier
	if (!target) return null
	return 'etude' in target ? { name: 'EtudeAtelier', params: { id: target.etude } } : { name: 'Atelier', query: { trace: target.trace } }
})
const atelierTitle = computed(() => {
	const target = imposition.value?.atelier
	if (!target) return undefined
	return 'etude' in target ? `Dans l'étude ${target.etude}, en cours sur cet article` : "Test rapide avec le tracé en service : il ne crée pas d'imposition"
})
const releve = computed(() => {
	const row = imposition.value
	if (!row) return []
	const grid = row.n_col && row.n_rang ? `${row.n_col} colonnes × ${row.n_rang} rangs` : ''
	return [
		{
			title: 'Poses',
			rows: [
				{ label: 'Poses', value: row.poses ? String(row.poses) : '' },
				{ label: 'Grille', value: grid },
				{ label: 'Disposition', value: row.motif || '' },
				{ label: 'Rotation', value: row.n_col ? `${row.rotation}°` : '' },
			],
		},
		{
			title: 'Feuille',
			rows: [
				{ label: 'Format', value: row.format ? `${row.format} mm` : '' },
				{ label: 'Support', value: [row.support, row.format_support].filter(Boolean).join(' ') },
				{ label: 'Chutes', value: chutesText(row.chutes) },
			],
		},
		{
			title: 'Pas',
			rows: [
				{ label: 'Pas laize', value: mmText(row.pas_laize) },
				{ label: 'Pas déplacement', value: mmText(row.pas_depl) },
				{ label: 'Pont', value: mmText(row.pont) },
				{ label: 'Trait commun', value: row.trait_commun.length ? row.trait_commun.join(', ') : row.n_col ? 'Non' : '' },
			],
		},
	]
		.map((card) => ({ ...card, rows: card.rows.filter((line) => line.value) }))
		.filter((card) => card.rows.length)
})

async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}
function onTags(tags: string[]) {
	if (imposition.value) imposition.value.tags = tags
	emit('changed')
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Cette imposition n'existe pas, ou elle n'est pas du ressort de votre équipe.</div>
		<div v-else-if="!imposition" class="card p-8 text-center text-ink-gray-6">Chargement de l'imposition…</div>

		<template v-else>
			<RecordHeader>
				<template #title><span class="tabular-nums">{{ imposition.name }}</span></template>
				<template #flags>
					<span v-for="flag in flags" :key="flag.label" class="list-tag" :class="flag.tone" :title="flag.title">{{ flag.label }}</span>
					<span class="list-tag" :class="imposition.origine === 'Moteur v1' ? 'tone-blue' : 'tone-gray'">{{ origineLabel(imposition.origine) }}</span>
				</template>
				<template #sub>
					<RouterLink class="ref-link" :to="{ name: 'Article', params: { id: imposition.article } }">{{ imposition.designation }}</RouterLink>
					<RouterLink class="ref-link" :to="{ name: 'Client', params: { id: imposition.client } }">{{ imposition.client_label }}</RouterLink>
					<span v-if="imposition.poses" class="tabular-nums">{{ imposition.poses }} pose{{ imposition.poses > 1 ? 's' : '' }}</span>
					<span v-if="imposition.chutes !== null" class="tabular-nums">{{ chutesText(imposition.chutes) }} de chutes</span>
					<div v-if="imposition.tags.length || imposition.can_write"><TagEditor doctype="Imposition" :name="imposition.name" :modified="imposition.modified" :tags="imposition.tags" :can-edit="imposition.can_write" @changed="onTags" /></div>
				</template>
				<template #actions>
					<a v-if="imposition.fichier" class="btn-secondary" :href="imposition.fichier.url" target="_blank" rel="noopener noreferrer">Ouvrir le fichier</a>
					<RouterLink v-if="atelierRoute" class="btn-primary" :to="atelierRoute" :title="atelierTitle">Refaire à l'atelier</RouterLink>
					<MoreMenu>
						<template v-if="imposition.can_choose || imposition.can_auto">
							<button v-if="imposition.can_choose" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="makeIdeale">Rendre idéale</button>
							<button v-if="imposition.can_auto" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="backToAuto">Revenir au calcul automatique</button>
							<div class="app-menu-sep"></div>
						</template>
						<RouterLink v-if="imposition.calcul" class="app-menu-item" role="menuitem" :to="{ name: 'AtelierTest', params: { calcul: imposition.calcul } }">Voir le calcul {{ imposition.calcul }}</RouterLink>
						<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
						<a class="app-menu-item" role="menuitem" :href="deskUrl('Imposition', imposition.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
					</MoreMenu>
				</template>
			</RecordHeader>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>
			<p v-if="imposition.obsolete" class="flex-none rounded-control tone-amber px-3.5 py-2.5">Calculée sur une version du tracé qui n'est plus en service : elle est à refaire à l'atelier, et ne peut plus être l'idéale.</p>

			<div class="ticket-dossier">
				<div class="bureau-detail demande-detail">
					<aside class="card record-rail" aria-label="Informations de l'imposition">
						<dl class="record-facts">
							<div><dt><LucidePackage aria-hidden="true" />Article</dt><dd><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: imposition.article } }">{{ imposition.designation }}</RouterLink></dd></div>
							<div><dt><LucidePenTool aria-hidden="true" />Tracé</dt>
								<dd v-if="imposition.trace">
									<RouterLink v-if="canSeeTrace" class="ref-link tabular-nums" :to="{ name: 'Trace', params: { id: imposition.trace.name } }">{{ imposition.trace.name }}</RouterLink>
									<span v-else class="tabular-nums">{{ imposition.trace.name }}</span>
									<span class="block text-xs font-normal text-ink-gray-6 tabular-nums">{{ [versionLabel(imposition.trace.ver), imposition.trace.statut, imposition.trace.dimensions && `${dimensionsText(imposition.trace.dimensions)} mm`].filter(Boolean).join(' · ') }}</span>
								</dd>
								<dd v-else class="record-fact-none">Aucun</dd>
							</div>
							<div><dt><LucideBuilding2 aria-hidden="true" />Client</dt><dd><RouterLink class="ref-link" :to="{ name: 'Client', params: { id: imposition.client } }">{{ imposition.client_label }}</RouterLink></dd></div>
							<div><dt><LucidePrinter aria-hidden="true" />Machine d'impression</dt><dd :class="!imposition.machine && 'record-fact-none'">{{ imposition.machine || 'Non renseignée' }}</dd></div>
							<div><dt><LucideScissors aria-hidden="true" />Machine de découpe</dt><dd :class="!imposition.machine_decoupe && 'record-fact-none'">{{ imposition.machine_decoupe || 'Non renseignée' }}</dd></div>
							<div v-if="imposition.forme"><dt><LucideScissors aria-hidden="true" />Forme de découpe</dt><dd><a class="ref-link tabular-nums" :href="deskUrl('Forme Decoupe', imposition.forme)" target="_blank" rel="noopener noreferrer">{{ imposition.forme }}</a></dd></div>
							<div><dt><LucideFlaskConical aria-hidden="true" />Origine</dt><dd>{{ imposition.origine === 'Moteur v1' ? "Atelier d'imposition" : 'Saisie à la main' }}</dd></div>
							<div><dt><LucideCalendar aria-hidden="true" />Créée le</dt><dd class="tabular-nums">{{ formatDay(imposition.creation) || '—' }}</dd></div>
						</dl>
					</aside>

					<div class="bureau-center">
						<section class="card ref-card">
							<div class="ref-card-head"><h3>Feuille</h3><span v-if="imposition.format" class="text-sm tabular-nums text-ink-gray-6">{{ imposition.format }} mm</span></div>
							<div v-if="imposition.dessin" class="imposition-sheet"><EtudeFeuille :dessin="imposition.dessin" /></div>
							<p v-else-if="imposition.origine === 'Moteur v1'" class="m-0 text-ink-gray-6">Le dessin de la feuille n'est pas disponible : son calcul n'a pas gardé la silhouette du tracé.<template v-if="imposition.fichier"> Le fichier joint fait foi.</template></p>
							<p v-else class="m-0 text-ink-gray-6">Imposition saisie à la main, sans colonnes ni rangs : la feuille ne se dessine pas.<template v-if="imposition.fichier"> Le fichier joint fait foi.</template></p>
						</section>

						<div v-if="releve.length" class="card fiche-releve">
							<section v-for="card in releve" :key="card.title" class="fiche-rubrique">
								<h3>{{ card.title }}</h3>
								<dl class="fiche-champs">
									<div v-for="line in card.rows" :key="line.label"><dt>{{ line.label }}</dt><dd class="tabular-nums">{{ line.value }}</dd></div>
								</dl>
							</section>
						</div>

						<section v-if="imposition.groupage" class="card ref-card">
							<div class="ref-card-head"><h3>Articles de la feuille groupée</h3><span class="text-sm tabular-nums text-ink-gray-6">{{ imposition.groupage }}</span></div>
							<ul class="m-0 flex list-none flex-col gap-1 p-0">
								<li v-for="(row, index) in imposition.articles_groupes" :key="`${row.article}-${index}`" class="flex items-center justify-between gap-2">
									<RouterLink class="ref-link" :to="{ name: 'Article', params: { id: row.article } }">{{ row.article }}</RouterLink>
									<span class="tabular-nums text-ink-gray-6">{{ row.poses }} pose{{ row.poses > 1 ? 's' : '' }}</span>
								</li>
							</ul>
						</section>

						<section class="card ref-card">
							<div class="ref-card-head"><h3>Autres impositions de l'article</h3><span class="text-sm tabular-nums text-ink-gray-6">{{ imposition.autres.length }}</span></div>
							<div v-if="imposition.autres.length" class="ref-scroll">
								<table class="ref-table">
									<thead><tr><th>Imposition</th><th>Tracé</th><th class="end">Poses</th><th>Format</th><th class="end">Chutes</th><th>État</th></tr></thead>
									<tbody>
										<tr v-for="row in imposition.autres" :key="row.name">
											<td><RouterLink class="ref-link tabular-nums" :to="{ name: 'Imposition', params: { id: row.name } }">{{ row.name }}</RouterLink></td>
											<td class="tabular-nums">{{ row.trace || '—' }}</td>
											<td class="end tabular-nums">{{ row.poses || '—' }}</td>
											<td class="tabular-nums">{{ row.format || '—' }}</td>
											<td class="end tabular-nums">{{ chutesText(row.chutes) || '—' }}</td>
											<td><span class="flex flex-wrap gap-1"><span v-for="flag in impositionFlags({ ...row, ideale_manuelle: false })" :key="flag.label" class="list-tag" :class="flag.tone">{{ flag.label }}</span></span></td>
										</tr>
									</tbody>
								</table>
							</div>
							<p v-else class="m-0 text-ink-gray-6">C'est la seule imposition de l'article.</p>
						</section>

						<aside class="record-activity" aria-label="Commentaires et activité de l'imposition">
							<ActivityFeed ref="feed" :api="activityApi" :version="imposition.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
						</aside>
					</div>

					<div class="bureau-side">
						<section class="card ref-card">
							<div class="ref-card-head"><h3>Études</h3><span class="text-sm tabular-nums text-ink-gray-6">{{ imposition.etudes.length }}</span></div>
							<ul v-if="imposition.etudes.length" class="m-0 flex list-none flex-col gap-1.5 p-0">
								<li v-for="row in imposition.etudes" :key="row.name" class="flex flex-wrap items-center justify-between gap-1.5">
									<RouterLink class="ref-link tabular-nums" :to="{ name: 'Etude', params: { id: row.name } }">{{ row.name }}</RouterLink>
									<StatusPill :status="row.status" />
								</li>
							</ul>
							<p v-else class="m-0 text-sm text-ink-gray-6">Aucune étude n'a retenu cette imposition.</p>
						</section>
						<p v-if="imposition.atelier && 'etude' in imposition.atelier" class="text-xs text-ink-gray-6">« Refaire à l'atelier » ouvre l'étude {{ imposition.atelier.etude }}, en cours sur cet article.</p>
						<p v-else-if="imposition.atelier" class="text-xs text-ink-gray-6">Aucune étude en cours sur cet article : « Refaire à l'atelier » ouvre un test rapide, qui ne crée pas d'imposition.</p>
						<p v-else-if="imposition.can_write" class="text-xs text-ink-gray-6">Pour la refaire, il faut une étude en cours sur l'article, ou un tracé en PDF pour un test rapide.</p>
					</div>
				</div>
			</div>
		</template>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</main>
</template>
