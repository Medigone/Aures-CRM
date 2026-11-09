<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideCheck from '~icons/lucide/check'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronRight from '~icons/lucide/chevron-right'
import LucideChevronUp from '~icons/lucide/chevron-up'
import StatusPill from '@shared/components/StatusPill.vue'
import { fileExtension, fileUrl } from '@shared/text'
import MaquetteDialog from './MaquetteDialog.vue'
import NewVersionDialog from './NewVersionDialog.vue'
import PiecePreview from './PiecePreview.vue'
import { createArticleBat } from '@/lib/api'
import { isImageFile, posesLabel, prepresseState, type ArticleDetail } from '@/lib/articles'
import { deskUrl, formatDay } from '@/lib/display'
import { origineLabel } from '@/lib/impositions'
import { dimensionsText, versionLabel } from '@/lib/traces'

/** Où en est l'article et quoi faire ensuite. L'historique reste replié. */
/** `actionsBar` : la barre d'actions de la fiche, où va l'action de la prochaine étape. */
const props = defineProps<{ article: ArticleDetail; busy: boolean; perform: (action: () => Promise<ArticleDetail>) => Promise<boolean>; actionsBar: HTMLElement | null }>()
const emit = defineEmits<{ notice: [message: string]; problem: [message: string] }>()

const state = computed(() => prepresseState(props.article))
const droits = computed(() => props.article.droits_prepresse)
const showVersions = ref(false)
const showBats = ref(false)
const showImpositions = ref(false)
const showEtudes = ref(false)
const viewing = ref<string | null>(null)
const creating = ref(false)

function impositionOrigin(row: { origine_calcul?: string | null }) {
	return origineLabel(row.origine_calcul || 'Manuel')
}
function chutes(value: number | null) {
	return value ? `${String(value).replace('.', ',')} %` : ''
}
function scrollToStep(key: string) {
	document.getElementById(`prepresse-${key}`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
}
function runNext() {
	const next = state.value.next
	if (!next) return
	if (next.action === 'maquette' && next.maquette) viewing.value = next.maquette
	if (next.action === 'bat' && next.etude) {
		const etude = next.etude
		const replaced = state.value.etudes.find((row) => row.name === etude)?.bat
		if (replaced && !window.confirm(`Créer un nouveau BAT ? ${replaced} deviendra obsolète.`)) return
		props.perform(() => createArticleBat(props.article, etude))
	}
}
function canRunNext() {
	const next = state.value.next
	if (next?.action === 'bat') return droits.value.bat
	if (next?.action === 'maquette') return droits.value.maquette
	return false
}
function onCreated(article: ArticleDetail, name: string, failed: boolean) {
	if (failed) emit('problem', `Version ${name} créée, mais son fichier n'a pas été envoyé : joignez-le sur le Desk.`)
	else emit('notice', `Version ${name} créée. Elle reste à référencer, puis à activer.`)
	viewing.value = name
	void article
}
</script>

<template>
	<div class="bureau-center">
		<section class="card" aria-label="Avancement de la prépresse">
			<div class="pp-chain">
				<button v-for="step in state.steps" :key="step.key" type="button" class="pp-step" :data-next="step.lineTodo" @click="scrollToStep(step.key)">
					<span class="pp-mark" :data-todo="!step.done" aria-hidden="true"><LucideCheck v-if="step.done" class="h-3.5 w-3.5" /></span>
					<b>{{ step.label }}</b>
					<span class="pp-step-sub" :class="!step.done && 'text-tone-amber font-medium'">{{ step.sub }}</span>
				</button>
			</div>
			<p v-if="state.next" class="pp-next"><span>Prochaine étape</span> <b>{{ state.next.title }}.</b> {{ state.next.text }}</p>
		</section>
		<Teleport v-if="actionsBar && state.next" :to="actionsBar">
			<button v-if="state.next.action && canRunNext()" type="button" class="btn-secondary" :disabled="busy" @click="runNext">{{ state.next.actionLabel }}</button>
			<a v-if="state.next.desk" class="btn-secondary" :href="state.next.desk" target="_blank" rel="noopener noreferrer">{{ state.next.deskLabel }}<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" /></a>
		</Teleport>

		<!-- Maquette en service. -->
		<section id="prepresse-maquette" class="card ref-card" aria-label="Maquette en service">
			<h3>Maquette en service</h3>
			<div v-if="state.active" class="pp-version">
				<button type="button" class="pp-thumb" :aria-label="`Voir la maquette ${state.active.name}`" @click="viewing = state.active!.name">
					<img v-if="state.active.fichier_maquette && isImageFile(state.active.fichier_maquette)" :src="fileUrl(state.active.fichier_maquette) || undefined" alt="" loading="lazy" />
					<span v-else class="upload-ext">{{ state.active.fichier_maquette ? fileExtension(state.active.fichier_maquette) : '—' }}</span>
				</button>
				<div class="flex min-w-0 flex-col gap-2.5">
					<div class="flex flex-wrap items-center gap-x-2 gap-y-1.5"><span class="pp-name">{{ state.active.name }}</span><StatusPill :status="state.active.status" /></div>
					<dl class="pp-facts">
						<div v-if="state.active.desc_changements"><dt>Changements</dt><dd>{{ state.active.desc_changements }}</dd></div>
						<div><dt>Créée le</dt><dd class="tabular-nums">{{ formatDay(state.active.date_creation) || '—' }}</dd></div>
						<div><dt>Couleurs</dt><dd :class="!state.active.resume_couleurs && 'font-normal text-ink-gray-6'">{{ state.active.resume_couleurs || 'Non renseignées' }}</dd></div>
						<div v-if="state.active.nom_reference_par"><dt>Référencée par</dt><dd>{{ state.active.nom_reference_par }}</dd></div>
						<div><dt>BAT lié</dt><dd :class="!state.activeBat && 'font-normal text-ink-gray-6'">{{ state.activeBat?.status || 'Aucun' }}</dd></div>
					</dl>
					<div class="flex flex-wrap items-center gap-1.5">
						<button type="button" class="btn-secondary" @click="viewing = state.active!.name">Voir</button>
						<button v-if="droits.nouvelle_version && droits.maquette" type="button" class="btn-secondary" :disabled="busy" @click="creating = true">Nouvelle version</button>
						<a class="ref-link ml-1" :href="deskUrl('Maquette', state.active.name)" target="_blank" rel="noopener noreferrer">Sur le Desk</a>
					</div>
				</div>
			</div>
			<p v-else class="text-ink-gray-6">Aucune maquette activée pour cet article.</p>
			<template v-if="state.older.length">
				<button type="button" class="pp-toggle" :aria-expanded="showVersions" @click="showVersions = !showVersions">
					{{ state.older.length > 1 ? `${state.older.length} versions` : '1 version' }} {{ state.active ? (state.older.length > 1 ? 'précédentes' : 'précédente') : '' }}
					<LucideChevronUp v-if="showVersions" class="h-3.5 w-3.5" aria-hidden="true" /><LucideChevronDown v-else class="h-3.5 w-3.5" aria-hidden="true" />
				</button>
				<ul v-if="showVersions" class="pp-rows">
					<li v-for="row in state.older" :key="row.name">
						<button type="button" class="pp-row" @click="viewing = row.name">
							<span class="pp-row-thumb" aria-hidden="true">
								<img v-if="row.fichier_maquette && isImageFile(row.fichier_maquette)" :src="fileUrl(row.fichier_maquette) || undefined" alt="" loading="lazy" />
								<template v-else>{{ row.fichier_maquette ? fileExtension(row.fichier_maquette) : '—' }}</template>
							</span>
							<span class="min-w-0">
								<span class="pp-row-title">Version {{ row.ver ?? '?' }}<template v-if="row.desc_changements"> · {{ row.desc_changements }}</template></span>
								<span class="pp-row-sub">{{ [row.name, formatDay(row.date_creation), row.resume_couleurs, !row.fichier_maquette && 'sans fichier'].filter(Boolean).join(' · ') }}</span>
							</span>
							<StatusPill :status="row.status" />
							<LucideChevronRight class="h-3.5 w-3.5 text-ink-gray-6" aria-hidden="true" />
						</button>
					</li>
				</ul>
			</template>
		</section>

		<!-- BAT en vigueur. Absent, c'est la prochaine étape qui le dit. -->
		<section v-if="article.prepresse.bats.length" id="prepresse-bat" class="card ref-card" aria-label="BAT">
			<h3>{{ state.currentBat ? 'BAT en vigueur' : 'BAT' }}</h3>
			<div v-if="state.currentBat" class="pp-line">
				<span class="min-w-0">
					<a class="ref-link inline-link tabular-nums" :href="deskUrl('BAT', state.currentBat.name)" target="_blank" rel="noopener noreferrer">{{ state.currentBat.name }}</a>
					<span class="pp-row-sub">{{ [formatDay(state.currentBat.date), state.currentBat.valide_par_nom && `validé par ${state.currentBat.valide_par_nom}`].filter(Boolean).join(' · ') }}</span>
					<span v-if="state.batCovers" class="pp-covered"><LucideCheck class="h-3.5 w-3.5" aria-hidden="true" />Couvre la maquette en service<template v-if="state.active?.ver"> (version {{ state.active.ver }})</template></span>
					<span v-else-if="state.currentBat.maquette" class="pp-covered text-tone-amber">Porte sur {{ state.currentBat.maquette }}, pas sur la maquette en service</span>
				</span>
				<span class="flex flex-none items-center gap-2">
					<a v-if="state.currentBat.fichier_valide" class="ref-link" :href="fileUrl(state.currentBat.fichier_valide) || undefined" target="_blank" rel="noopener noreferrer">Ouvrir<LucideArrowUpRight class="h-3 w-3" aria-hidden="true" /></a>
					<StatusPill :status="state.currentBat.status" />
				</span>
			</div>
			<template v-if="state.oldBats.length">
				<button type="button" class="pp-toggle" :aria-expanded="showBats" @click="showBats = !showBats">
					{{ state.oldBats.length > 1 ? `${state.oldBats.length} BAT obsolètes` : '1 BAT obsolète' }}
					<LucideChevronUp v-if="showBats" class="h-3.5 w-3.5" aria-hidden="true" /><LucideChevronDown v-else class="h-3.5 w-3.5" aria-hidden="true" />
				</button>
				<div v-if="showBats" class="ref-scroll"><table class="ref-table">
					<thead><tr><th>Numéro</th><th>Date</th><th>Maquette</th><th>Fichier</th></tr></thead>
					<tbody><tr v-for="row in state.oldBats" :key="row.name"><td><a class="ref-link" :href="deskUrl('BAT', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.date) || '—' }}</td><td>{{ row.maquette || '—' }}</td><td><a v-if="row.fichier_valide" class="ref-link" :href="fileUrl(row.fichier_valide) || undefined" target="_blank" rel="noopener noreferrer">Ouvrir</a><span v-else class="text-ink-gray-6">Aucun</span></td></tr></tbody>
				</table></div>
			</template>
		</section>

		<div class="client-cards">
			<section id="prepresse-trace" class="card ref-card" aria-label="Tracé">
				<div class="ref-card-head piece-head">
					<h3>Tracé</h3>
					<template v-if="state.trace">
						<span v-if="state.trace.ver" class="list-tag tone-gray tabular-nums">{{ versionLabel(state.trace.ver) }}</span>
						<StatusPill v-if="state.trace.statut" :status="state.trace.statut" />
						<RouterLink class="ref-link" :to="{ name: 'Trace', params: { id: state.trace.name } }">{{ state.trace.name }}</RouterLink>
					</template>
				</div>
				<template v-if="state.trace">
					<PiecePreview kind="trace" :name="state.trace.name" :file="state.trace.fichier_trace" />
					<dl class="kv">
						<div><dt>Dimensions</dt><dd class="tabular-nums">{{ state.trace.dimensions ? `${dimensionsText(state.trace.dimensions)} mm` : '—' }}</dd></div>
						<div v-if="state.trace.procede !== 'Flexo'"><dt>Points de colle</dt><dd class="tabular-nums">{{ state.trace.points_colle ?? '—' }}</dd></div>
						<div v-if="!state.flexo"><dt>Impositions valables</dt><dd class="tabular-nums">{{ article.prepresse.impositions.length || 'Aucune' }}</dd></div>
					</dl>
				</template>
				<p v-else class="text-ink-gray-6">Aucun tracé pour cet article. Il se crée depuis l'étude.</p>
			</section>

			<section v-if="state.flexo" id="prepresse-outil" class="card ref-card" aria-label="Cliché">
				<div class="ref-card-head"><h3>Cliché</h3><a v-if="article.prepresse.cliches[0]" class="ref-link" :href="deskUrl('Cliche', article.prepresse.cliches[0].name)" target="_blank" rel="noopener noreferrer">{{ article.prepresse.cliches[0].name }}</a></div>
				<dl v-if="article.prepresse.cliches[0]" class="kv">
					<div><dt>Version</dt><dd class="tabular-nums">{{ article.prepresse.cliches[0].version || '—' }}</dd></div>
					<div><dt>Statut</dt><dd><StatusPill :status="article.prepresse.cliches[0].status" /></dd></div>
				</dl>
				<p v-else class="text-ink-gray-6">Aucun cliché pour cet article.</p>
			</section>
			<section v-else id="prepresse-outil" class="card ref-card" aria-label="Imposition">
				<div class="ref-card-head piece-head">
					<h3>{{ state.otherImpositions.length ? 'Imposition idéale' : 'Imposition' }}</h3>
					<template v-if="state.imposition">
						<span class="list-tag tone-gray">{{ impositionOrigin(state.imposition) }}</span>
						<RouterLink class="ref-link" :to="{ name: 'Imposition', params: { id: state.imposition.name } }">{{ state.imposition.name }}</RouterLink>
					</template>
				</div>
				<template v-if="state.imposition">
					<PiecePreview kind="imposition" :name="state.imposition.name" :file="state.imposition.fichier_imp" :dessin="state.imposition.dessin" />
					<p v-if="!state.imposition.dessin && state.imposition.fichier_imp && isImageFile(state.imposition.fichier_imp)" class="piece-caption">Pas de dessin de la feuille : le fichier joint fait foi.</p>
					<dl class="kv">
						<div><dt>Poses et chutes</dt><dd class="tabular-nums">{{ [state.imposition.nbr_poses && posesLabel(state.imposition.nbr_poses), chutes(state.imposition.taux_chutes)].filter(Boolean).join(' · ') || '—' }}</dd></div>
						<div><dt>Machine</dt><dd :class="!state.imposition.machine_impression && 'font-normal text-ink-gray-6'">{{ state.imposition.machine_impression || 'Non renseignée' }}</dd></div>
						<div v-if="state.otherImpositions.length"><dt>Idéale</dt><dd>{{ state.imposition.ideale_manuelle ? 'Choisie à la main' : 'Par le calcul' }}</dd></div>
					</dl>
				</template>
				<p v-else class="text-ink-gray-6">Aucune imposition pour cet article.</p>
				<template v-if="state.otherImpositions.length">
					<button type="button" class="pp-toggle" :aria-expanded="showImpositions" @click="showImpositions = !showImpositions">
						{{ state.otherImpositions.length > 1 ? `${state.otherImpositions.length} autres impositions` : '1 autre imposition' }}
						<LucideChevronUp v-if="showImpositions" class="h-3.5 w-3.5" aria-hidden="true" /><LucideChevronDown v-else class="h-3.5 w-3.5" aria-hidden="true" />
					</button>
					<div v-if="showImpositions" class="ref-scroll"><table class="ref-table">
						<thead><tr><th>Numéro</th><th class="end">Poses</th><th class="end">Chutes</th><th>Origine</th></tr></thead>
						<tbody><tr v-for="row in state.otherImpositions" :key="row.name"><td><RouterLink class="ref-link" :to="{ name: 'Imposition', params: { id: row.name } }">{{ row.name }}</RouterLink></td><td class="end tabular-nums">{{ row.nbr_poses || '—' }}</td><td class="end tabular-nums">{{ chutes(row.taux_chutes) || '—' }}</td><td>{{ impositionOrigin(row) }}</td></tr></tbody>
					</table></div>
				</template>
			</section>
		</div>

		<section v-if="article.prepresse.plans_flexo.length" class="card ref-card" aria-label="Plans Flexo">
			<h3>Plans Flexo</h3>
			<div class="ref-scroll"><table class="ref-table">
				<thead><tr><th>Numéro</th><th>Date</th><th>Dimensions</th><th>Laize</th><th>Fichier</th></tr></thead>
				<tbody><tr v-for="row in article.prepresse.plans_flexo" :key="row.name"><td><a class="ref-link" :href="deskUrl('Plan Flexo', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.date) || '—' }}</td><td class="tabular-nums">{{ row.dimensions || '—' }}</td><td class="tabular-nums">{{ row.laize || '—' }}</td><td><a v-if="row.fichier" class="ref-link" :href="fileUrl(row.fichier) || undefined" target="_blank" rel="noopener noreferrer">Ouvrir</a><span v-else class="text-ink-gray-6">Aucun</span></td></tr></tbody>
			</table></div>
		</section>

		<section class="card ref-card" aria-label="Études techniques">
			<h3>{{ state.etudes.length > 1 ? 'Études techniques' : 'Étude technique' }}</h3>
			<p v-if="!state.etudes.length" class="text-ink-gray-6">Aucune étude technique pour cet article.</p>
			<div v-else class="ref-scroll"><table class="ref-table">
				<thead><tr><th>Numéro</th><th>Statut</th><th>Date</th><th>Machine</th><th class="end">Passages</th></tr></thead>
				<tbody><tr v-for="row in showEtudes ? state.etudes : state.etudes.slice(0, 3)" :key="row.name"><td><a class="ref-link" :href="deskUrl('Etude Technique', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td><StatusPill :status="row.status" /></td><td class="tabular-nums">{{ formatDay(row.date) || '—' }}</td><td>{{ row.machine || '—' }}</td><td class="end tabular-nums">{{ row.nb_passages || '—' }}</td></tr></tbody>
			</table></div>
			<button v-if="state.etudes.length > 3" type="button" class="pp-toggle" :aria-expanded="showEtudes" @click="showEtudes = !showEtudes">
				{{ showEtudes ? 'Réduire' : `Voir les ${state.etudes.length} études` }}
				<LucideChevronUp v-if="showEtudes" class="h-3.5 w-3.5" aria-hidden="true" /><LucideChevronDown v-else class="h-3.5 w-3.5" aria-hidden="true" />
			</button>
		</section>

		<MaquetteDialog v-if="viewing" :article="article" :start="viewing" :busy="busy" :perform="perform" @close="viewing = null" />
		<NewVersionDialog v-if="creating && state.active" :article="article" :maquette="state.active" :perform="perform" @close="creating = false" @created="onCreated" />
	</div>
</template>
