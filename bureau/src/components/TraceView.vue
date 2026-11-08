<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideCalendar from '~icons/lucide/calendar'
import LucideCalendarCheck from '~icons/lucide/calendar-check'
import LucideDroplet from '~icons/lucide/droplet'
import LucideGitBranch from '~icons/lucide/git-branch'
import LucidePackage from '~icons/lucide/package'
import LucideRuler from '~icons/lucide/ruler'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import type { UploadedFile } from '@shared/api'
import AppToast from './AppToast.vue'
import RecordHeader from './RecordHeader.vue'
import TagEditor from './TagEditor.vue'
import TracePreview from './TracePreview.vue'
import TraceVersionDialog from './TraceVersionDialog.vue'
import { setTraceFile, traceActivity } from '@/lib/api'
import { setPendingNotice, takePendingNotice } from '@/lib/atelier'
import { isImageFile, procedeTone } from '@/lib/articles'
import { deskUrl, formatDay } from '@/lib/display'
import { canCreate, canRead } from '@/lib/droits'
import { chutesText } from '@/lib/impositions'
import { dimensionsText, fileKindLabel, isObsolete, versionLabel, type TraceDetail } from '@/lib/traces'
import { useTrace } from '@/lib/useTrace'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ changed: []; moved: [name: string, message: string] }>()

const { trace, error, notFound, actionError, notice, noticeTone, load, refresh } = useTrace(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const activityApi = computed(() => traceActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, trace })
// Après une nouvelle version, la fiche s'ouvre sur elle avec ce qui vient d'être fait.
watch(
	() => props.id,
	() => {
		const message = takePendingNotice()
		if (message) notice.value = message
	},
)

watch(feed, async (current) => {
	if (!current || props.tab !== 'activite') return
	await nextTick()
	current.root?.scrollIntoView?.({ block: 'start' })
})

const obsolete = computed(() => (trace.value ? isObsolete(trace.value) : false))
// L'atelier ne lit que le PDF ; un test rapide ne crée rien.
const canTest = computed(() => trace.value?.fichier?.kind === 'pdf' && !obsolete.value && canRead('Calcul Imposition') && canCreate('Calcul Imposition'))
const imageUrl = computed(() => (trace.value?.fichier && isImageFile(trace.value.fichier.url) ? trace.value.fichier.url : null))

const versionOpen = ref(false)
function onVersion(next: TraceDetail, message: string) {
	versionOpen.value = false
	emit('changed')
	// La fiche passe sur la version en service ; le message la suit.
	setPendingNotice(message)
	emit('moved', next.name, message)
}

// Remplacer le fichier n'est possible que tant qu'aucune imposition ne s'appuie dessus.
const fileOpen = ref(false)
const fileBusy = ref(false)
const fileError = ref('')
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
let uploadedUrl = ''
function onUploaded(file: UploadedFile) {
	uploadedUrl = file.file_url
}
async function onSettled(_sent: number, failed: number) {
	if (!trace.value) return
	if (failed || !uploadedUrl) {
		fileError.value = "Le fichier n'est pas joint. Réessayez l'envoi."
		fileBusy.value = false
		return
	}
	try {
		trace.value = await setTraceFile(trace.value, uploadedUrl)
		notice.value = 'Fichier du tracé remplacé.'
		fileOpen.value = false
		emit('changed')
	} catch (e) {
		fileError.value = (e as Error).message
		refreshAll()
	} finally {
		fileBusy.value = false
	}
}
function sendFile() {
	if (!trace.value || fileBusy.value) return
	if (!uploader.value?.items.length) {
		fileError.value = 'Choisissez le fichier du tracé.'
		return
	}
	fileError.value = ''
	fileBusy.value = true
	uploadedUrl = ''
	uploader.value.start({ doctype: 'Trace', docname: trace.value.name })
}

async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}
function onTags(tags: string[]) {
	if (trace.value) trace.value.tags = tags
	emit('changed')
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Ce tracé n'existe pas, ou il n'est pas du ressort de votre équipe.</div>
		<div v-else-if="!trace" class="card p-8 text-center text-ink-gray-6">Chargement du tracé…</div>

		<template v-else>
			<RecordHeader>
				<template #title><span class="tabular-nums">{{ trace.name }}</span></template>
				<template #flags>
					<StatusPill :status="trace.statut" />
					<span class="list-tag tone-gray tabular-nums">{{ versionLabel(trace.ver) }}</span>
					<span v-if="trace.fichier" class="list-tag" :class="trace.fichier.kind === 'pdf' ? 'tone-green' : 'tone-amber'">{{ fileKindLabel(trace.fichier.kind) }}</span>
				</template>
				<template #sub>
					<RouterLink class="ref-link" :to="{ name: 'Article', params: { id: trace.article } }">{{ trace.designation }}</RouterLink>
					<RouterLink class="ref-link" :to="{ name: 'Client', params: { id: trace.client } }">{{ trace.client_label }}</RouterLink>
					<span v-if="trace.dimensions" class="tabular-nums">{{ dimensionsText(trace.dimensions) }} mm</span>
					<div v-if="trace.tags.length || trace.can_write"><TagEditor doctype="Trace" :name="trace.name" :modified="trace.modified" :tags="trace.tags" :can-edit="trace.can_write" @changed="onTags" /></div>
				</template>
				<template #actions>
					<a v-if="trace.fichier" class="btn-secondary" :href="trace.fichier.url" target="_blank" rel="noopener noreferrer">Ouvrir le fichier</a>
					<RouterLink v-if="canTest" class="btn-secondary" :to="{ name: 'Atelier', query: { trace: trace.name } }">Tester à l'atelier</RouterLink>
					<button v-if="trace.can_version" type="button" class="btn-primary" @click="versionOpen = true">Nouvelle version</button>
					<RouterLink v-else-if="obsolete && trace.remplacee_par" class="btn-primary" :to="{ name: 'Trace', params: { id: trace.remplacee_par } }">Voir la version en service</RouterLink>
					<MoreMenu>
						<template v-if="trace.can_replace_file">
							<button type="button" class="app-menu-item" role="menuitem" @click="fileOpen = true">Remplacer le fichier</button>
							<div class="app-menu-sep"></div>
						</template>
						<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
						<a class="app-menu-item" role="menuitem" :href="deskUrl('Trace', trace.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
					</MoreMenu>
				</template>
			</RecordHeader>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>
			<p v-if="obsolete" class="flex-none rounded-control tone-amber px-3.5 py-2.5">
				Version remplacée<template v-if="trace.remplacee_par"> par <RouterLink class="ref-link" :to="{ name: 'Trace', params: { id: trace.remplacee_par } }">{{ trace.remplacee_par }}</RouterLink></template>. Ses impositions sont obsolètes : elles se refont sur la version en service.
			</p>

			<div class="ticket-dossier">
				<div class="bureau-detail demande-detail">
					<aside class="card record-rail" aria-label="Informations du tracé">
						<dl class="record-facts">
							<div><dt><LucidePackage aria-hidden="true" />Article</dt><dd><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: trace.article } }">{{ trace.designation }}</RouterLink></dd></div>
							<div><dt><LucideBuilding2 aria-hidden="true" />Client</dt><dd><RouterLink class="ref-link" :to="{ name: 'Client', params: { id: trace.client } }">{{ trace.client_label }}</RouterLink></dd></div>
							<div><dt><LucideRuler aria-hidden="true" />Dimensions</dt><dd class="tabular-nums" :class="!trace.dimensions && 'record-fact-none'">{{ trace.dimensions ? `${dimensionsText(trace.dimensions)} mm` : 'Non renseignées' }}</dd></div>
							<div v-if="trace.procede !== 'Flexo'"><dt><LucideDroplet aria-hidden="true" />Points de colle</dt><dd class="tabular-nums">{{ trace.points_colle }}</dd></div>
							<div><dt><LucideGitBranch aria-hidden="true" />Procédé</dt><dd><span v-if="trace.procede" class="list-tag" :class="procedeTone(trace.procede)">{{ trace.procede }}</span><template v-else>—</template></dd></div>
							<div><dt><LucideCalendarCheck aria-hidden="true" />Mise en service le</dt><dd class="tabular-nums">{{ formatDay(trace.date_activation || trace.creation) || '—' }}</dd></div>
							<div><dt><LucideCalendar aria-hidden="true" />Créé le</dt><dd class="tabular-nums">{{ formatDay(trace.creation) || '—' }}</dd></div>
						</dl>
					</aside>

					<div class="bureau-center">
						<section class="card ref-card">
							<div class="ref-card-head">
								<h3>Fichier du tracé</h3>
								<a v-if="trace.fichier" class="ref-link truncate" :href="trace.fichier.url" target="_blank" rel="noopener noreferrer" :title="trace.fichier.name">{{ trace.fichier.name }}</a>
							</div>
							<img v-if="imageUrl" class="trace-preview" :src="imageUrl" :alt="`Tracé ${trace.name}`" loading="lazy" />
							<p v-if="!trace.fichier" class="m-0 text-ink-gray-6">Aucun fichier.<template v-if="trace.can_replace_file"> Déposez-le depuis le menu ⋯.</template></p>
							<p v-else-if="trace.fichier.kind === 'image'" class="m-0 text-sm text-ink-gray-6">Une image : l'atelier ne peut pas la lire. Pour calculer une imposition, il faut le tracé en PDF.</p>
							<template v-else>
								<TracePreview :name="trace.name" :url="trace.fichier.url" :label="trace.fichier.name" />
								<p class="m-0 text-sm text-ink-gray-6">PDF lisible par l'atelier d'imposition. Un clic sur l'aperçu l'ouvre en entier.</p>
							</template>
						</section>

						<section v-if="trace.impositions" class="card ref-card">
							<div class="ref-card-head"><h3>Impositions de ce tracé</h3><span class="text-sm tabular-nums text-ink-gray-6">{{ trace.impositions.length }}</span></div>
							<div v-if="trace.impositions.length" class="ref-scroll">
								<table class="ref-table">
									<thead><tr><th>Imposition</th><th class="end">Poses</th><th>Format</th><th class="end">Chutes</th><th>Machine</th><th>État</th></tr></thead>
									<tbody>
										<tr v-for="row in trace.impositions" :key="row.name">
											<td><RouterLink class="ref-link tabular-nums" :to="{ name: 'Imposition', params: { id: row.name } }">{{ row.name }}</RouterLink></td>
											<td class="end tabular-nums">{{ row.poses || '—' }}</td>
											<td class="tabular-nums">{{ row.format || '—' }}</td>
											<td class="end tabular-nums">{{ chutesText(row.chutes) || '—' }}</td>
											<td :class="!row.machine && 'text-ink-gray-6'">{{ row.machine || 'Non renseignée' }}</td>
											<td>
												<span class="flex flex-wrap gap-1">
													<span v-if="row.obsolete" class="list-tag tone-gray">Obsolète</span>
													<span v-if="row.ideale" class="list-tag tone-green">Idéale</span>
													<span v-if="row.groupage" class="list-tag tone-violet">Groupée</span>
												</span>
											</td>
										</tr>
									</tbody>
								</table>
							</div>
							<p v-else class="m-0 text-ink-gray-6">Aucune imposition : elle se calcule à l'atelier, depuis l'étude de l'article.</p>
						</section>

						<section class="card ref-card">
							<div class="ref-card-head"><h3>Études qui l'utilisent</h3><span class="text-sm tabular-nums text-ink-gray-6">{{ trace.etudes.length }}</span></div>
							<div v-if="trace.etudes.length" class="ref-scroll">
								<table class="ref-table">
									<thead><tr><th>Étude</th><th>Statut</th><th>Demande</th><th>Attribution</th><th>Créée le</th></tr></thead>
									<tbody>
										<tr v-for="row in trace.etudes" :key="row.name">
											<td><RouterLink class="ref-link tabular-nums" :to="{ name: 'Etude', params: { id: row.name } }">{{ row.name }}</RouterLink></td>
											<td><StatusPill :status="row.status" /></td>
											<td class="tabular-nums">{{ row.demande || '—' }}</td>
											<td :class="!row.assigne && 'text-ink-gray-6'">{{ row.assigne || 'Non attribuée' }}</td>
											<td class="tabular-nums">{{ formatDay(row.creation) }}</td>
										</tr>
									</tbody>
								</table>
							</div>
							<p v-else class="m-0 text-ink-gray-6">Aucune étude ne s'appuie sur ce tracé.</p>
						</section>

						<section v-if="trace.formes.length" class="card ref-card">
							<div class="ref-card-head"><h3>Formes de découpe</h3></div>
							<ul class="m-0 flex list-none flex-col gap-1 p-0">
								<li v-for="row in trace.formes" :key="row.name" class="flex items-center gap-2">
									<a class="ref-link tabular-nums" :href="deskUrl('Forme Decoupe', row.name)" target="_blank" rel="noopener noreferrer">{{ row.numero || row.name }}</a>
									<span v-if="row.a_refaire" class="list-tag tone-amber">À refaire</span>
								</li>
							</ul>
						</section>

						<!-- Le fil vient après le contenu. -->
						<aside class="record-activity" aria-label="Commentaires et activité du tracé">
							<ActivityFeed ref="feed" :api="activityApi" :version="trace.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
						</aside>
					</div>

					<div class="bureau-side">
						<section class="card ref-card" aria-label="Versions du tracé">
							<div class="ref-card-head"><h3>Versions</h3><span class="text-sm tabular-nums text-ink-gray-6">{{ trace.versions.length }}</span></div>
							<ol class="trace-versions">
								<li v-for="row in trace.versions" :key="row.name" :data-current="row.name === trace.name">
									<div class="flex flex-wrap items-center gap-1.5">
										<RouterLink v-if="row.name !== trace.name" class="ref-link font-semibold tabular-nums" :to="{ name: 'Trace', params: { id: row.name } }">{{ versionLabel(row.ver) }}</RouterLink>
										<strong v-else class="font-semibold tabular-nums">{{ versionLabel(row.ver) }}</strong>
										<StatusPill :status="row.statut" />
									</div>
									<p class="m-0 text-xs text-ink-gray-6 tabular-nums">{{ row.name }} · {{ formatDay(row.date_activation) }}<template v-if="row.par"> · {{ row.par }}</template></p>
									<p v-if="row.desc_changements" class="m-0 whitespace-pre-line text-sm">{{ row.desc_changements }}</p>
									<p v-else-if="row.ver === 1" class="m-0 text-sm text-ink-gray-6">Première version.</p>
								</li>
							</ol>
							<p v-if="trace.can_version" class="m-0 text-xs text-ink-gray-6">Une nouvelle version est en service dès sa création : les impositions de celle-ci deviennent obsolètes.</p>
						</section>
					</div>
				</div>
			</div>

			<TraceVersionDialog v-if="versionOpen" :trace="trace" @close="versionOpen = false" @saved="onVersion" @failed="refreshAll()" />
			<FormDialog v-if="fileOpen" title="Remplacer le fichier du tracé" :dirty="false" hint="" :busy="fileBusy" @close="fileOpen = false" @submit="sendFile">
				<p v-if="fileError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ fileError }}</p>
				<p class="m-0 text-ink-gray-6">Aucune imposition ne s'appuie encore sur ce tracé : le fichier se remplace sans nouvelle version. L'atelier ne lit que le PDF.</p>
				<FileUploader ref="uploader" deferred :multiple="false" doctype="Trace" :docname="trace.name" @change="fileError = ''" @uploaded="onUploaded" @settled="onSettled" />
				<template #actions><button type="button" class="btn-primary" :disabled="fileBusy" @click="sendFile">Remplacer</button></template>
			</FormDialog>
		</template>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</main>
</template>
