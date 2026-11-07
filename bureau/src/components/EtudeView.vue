<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideCalendar from '~icons/lucide/calendar'
import LucideCalendarClock from '~icons/lucide/calendar-clock'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import LucidePackage from '~icons/lucide/package'
import LucideTruck from '~icons/lucide/truck'
import LucideUser from '~icons/lucide/user'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import AttributionButton from './AttributionButton.vue'
import EtudeActions from './EtudeActions.vue'
import EtudePieces from './EtudePieces.vue'
import RecordHeader from './RecordHeader.vue'
import StepTimeline from './StepTimeline.vue'
import TagEditor from './TagEditor.vue'
import { etudeActivity, setEtudeObservations } from '@/lib/api'
import type { PiecesResult } from '@/lib/etudePieces'
import { deskUrl, formatDay } from '@/lib/display'
import { actionLabel, blockedText, etudeHeaderActions, etudeTimeline, etudeTip, formatQuantity, isPrimaryEtudeAction } from '@/lib/etudes'
import { useEtude } from '@/lib/useEtude'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ changed: [] }>()

const { etude, assigneeOptions, assign, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh } = useEtude(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const actions = ref<InstanceType<typeof EtudeActions> | null>(null)
const activityApi = computed(() => etudeActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, etude })

const headerActions = computed(() => (etude.value ? etudeHeaderActions(etude.value) : []))
const canCancel = computed(() => etude.value?.actions.includes('Annuler'))
const timeline = computed(() => (etude.value ? etudeTimeline(etude.value) : null))
const tip = computed(() => (etude.value ? etudeTip(etude.value) : ''))

// Depuis l'aperçu : la fiche s'ouvre sur le fil.
watch(feed, async (current) => {
	if (!current || props.tab !== 'activite') return
	await nextTick()
	current.root?.scrollIntoView?.({ block: 'start' })
})

async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}
function onPiecesSaved(result: PiecesResult, message: string) {
	etude.value = result.etude
	notice.value = message
	feed.value?.refresh()
	emit('changed')
}

// Comme les pièces : l'équipe de l'étude renseigne tant que l'étude est en cours.
const canWriteObservations = computed(() => etude.value?.can_write && etude.value.status === 'En étude')
const observationsOpen = ref(false)
const observations = ref('')
const observationsBusy = ref(false)
const observationsError = ref('')
function openObservations() {
	observations.value = etude.value?.observations ?? ''
	observationsError.value = ''
	observationsOpen.value = true
}
async function saveObservations() {
	if (!etude.value || observationsBusy.value) return
	observationsBusy.value = true
	observationsError.value = ''
	try {
		onPiecesSaved(await setEtudeObservations(etude.value, observations.value), 'Observations enregistrées.')
		observationsOpen.value = false
	} catch (e) {
		observationsError.value = (e as Error).message
		refreshAll()
	} finally {
		observationsBusy.value = false
	}
}

function onTags(tags: string[]) {
	if (etude.value) etude.value.tags = tags
	emit('changed')
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Cette étude n'existe pas, ou elle n'est pas du ressort de votre équipe.</div>
		<div v-else-if="!etude" class="card p-8 text-center text-ink-gray-6">Chargement de l'étude…</div>

		<template v-else>
			<RecordHeader>
				<template #title><span class="tabular-nums">{{ etude.name }}</span></template>
				<template #flags>
					<StatusPill :status="etude.status" />
					<span class="urgence" :class="`urgence-${etude.urgence}`">{{ etude.urgence }}</span>
				</template>
				<template #sub>
					<RouterLink class="ref-link" :to="{ name: 'Client', params: { id: etude.client } }">{{ etude.client_label }}</RouterLink>
					<span v-if="etude.procede">{{ etude.procede }}</span>
					<span class="tabular-nums">{{ formatQuantity(etude.quantite) }} ex.</span>
					<span v-if="etude.retirage">Retirage</span>
					<div v-if="etude.tags.length || etude.can_write"><TagEditor :doctype="etude.doctype" :name="etude.name" :modified="etude.modified" :tags="etude.tags" :can-edit="etude.can_write" @changed="onTags" /></div>
				</template>
				<template #actions>
					<AttributionButton :ticket="etude" :options="assigneeOptions" :can-assign="etude.can_assign" :busy="busy" @assign="assign" />
					<button v-for="item in headerActions" :key="item.action" type="button" :class="isPrimaryEtudeAction(item.action) ? 'btn-primary' : 'btn-secondary'" :disabled="busy || item.missing.length > 0" :title="item.missing.length ? blockedText(etude) : undefined" @click="actions?.run(item.action)">{{ actionLabel(item.action) }}</button>
					<MoreMenu>
						<template v-if="canCancel">
							<button type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="actions?.run('Annuler')">{{ actionLabel('Annuler') }}</button>
							<div class="app-menu-sep"></div>
						</template>
						<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
						<a class="app-menu-item" role="menuitem" :href="deskUrl(etude.doctype, etude.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
					</MoreMenu>
				</template>
			</RecordHeader>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>

			<div class="ticket-dossier">
				<div class="bureau-detail demande-detail">
					<aside class="card record-rail" aria-label="Informations de l'étude">
						<dl class="record-facts">
							<div><dt><LucidePackage aria-hidden="true" />Article</dt><dd><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: etude.article } }">{{ etude.designation }}</RouterLink></dd></div>
							<div><dt><LucideCalendarClock aria-hidden="true" />Échéance</dt><dd class="tabular-nums" :class="etude.retard && 'etude-late'">{{ formatDay(etude.echeance) || '—' }}</dd></div>
							<div><dt><LucideTruck aria-hidden="true" />Livraison souhaitée</dt><dd class="tabular-nums">{{ formatDay(etude.livraison) || '—' }}</dd></div>
							<div v-if="etude.demande"><dt><LucideClipboardList aria-hidden="true" />Demande</dt><dd><RouterLink class="ref-link tabular-nums" :to="{ name: 'Demande', params: { id: etude.demande } }">{{ etude.demande }}</RouterLink></dd></div>
							<div><dt><LucideUser aria-hidden="true" />Commercial</dt><dd>{{ etude.commercial || 'Non attribué' }}</dd></div>
							<div><dt><LucideCalendar aria-hidden="true" />Créée le</dt><dd class="tabular-nums">{{ formatDay(etude.date) || '—' }}</dd></div>
						</dl>
					</aside>
					<div class="bureau-center">
						<EtudePieces :etude="etude" @saved="onPiecesSaved" @reload="refreshAll()" />
						<section v-if="etude.observations || canWriteObservations" class="card ref-card">
							<div class="ref-card-head">
								<h3>Observations</h3>
								<button v-if="canWriteObservations" type="button" class="btn-secondary" @click="openObservations">Modifier</button>
							</div>
							<p class="m-0 whitespace-pre-line" :class="!etude.observations && 'text-ink-gray-6'">{{ etude.observations || 'Aucune observation.' }}</p>
						</section>
						<!-- Le fil vient après le contenu. -->
						<aside class="record-activity" aria-label="Commentaires et activité de l'étude">
							<ActivityFeed ref="feed" :api="activityApi" :version="etude.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
						</aside>
					</div>
					<div class="bureau-side">
						<StepTimeline v-if="timeline" :steps="timeline.steps" :viewed="timeline.focus" :current="timeline.current" :focus="timeline.focus" :tip="tip" label="Étapes de l'étude" />
					</div>
				</div>
			</div>
			<EtudeActions ref="actions" :etude="etude" :busy="busy" :perform="perform" @done="notice = $event" />
			<FormDialog v-if="observationsOpen" title="Modifier les observations" :dirty="false" hint="" :busy="observationsBusy" @close="observationsOpen = false" @submit="saveObservations">
				<p v-if="observationsError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ observationsError }}</p>
				<label class="form-field"><span class="field-label">Observations</span><textarea v-model="observations" class="field-input" rows="5"></textarea></label>
				<template #actions><button type="button" class="btn-primary" :disabled="observationsBusy" @click="saveObservations">Enregistrer</button></template>
			</FormDialog>
		</template>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</main>
</template>
