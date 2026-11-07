<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideCheck from '~icons/lucide/check'
import StatusPill from '@shared/components/StatusPill.vue'
import EtudeFeuille from './EtudeFeuille.vue'
import EtudeFlexoDialogs from './EtudeFlexoDialogs.vue'
import EtudeImpositionDialog from './EtudeImpositionDialog.vue'
import EtudeImpositionForm from './EtudeImpositionForm.vue'
import EtudeMachineDialog from './EtudeMachineDialog.vue'
import EtudeTraceDialog from './EtudeTraceDialog.vue'
import { getEtudePieces, linkExistingPieces } from '@/lib/api'
import { deskUrl } from '@/lib/display'
import { cotationsOriginText, dimensionsLabel, machineStatusLabel, machineStatusTone, percentLabel, piecesBanner, quantityLabel, type EtudePieces, type PiecesResult } from '@/lib/etudePieces'
import type { EtudeDetail } from '@/lib/etudes'

/** Les pièces de l'étude dans l'ordre où elles dépendent l'une de l'autre : tracé, imposition, machine, ou en Flexo plan, maquette et cliché. */
const props = defineProps<{ etude: EtudeDetail }>()
const emit = defineEmits<{ saved: [result: PiecesResult, message: string]; reload: [] }>()

type Dialog = 'trace' | 'imposition' | 'impositionNew' | 'impositionEdit' | 'machine' | 'plan' | 'cliche' | null
const pieces = ref<EtudePieces | null>(null)
const dialog = ref<Dialog>(null)
const loadError = ref('')
const linking = ref(false)
const linkError = ref('')

let lastRequest = 0
async function load() {
	const request = ++lastRequest
	try {
		const response = await getEtudePieces(props.etude.name)
		if (request === lastRequest) {
			pieces.value = response
			loadError.value = ''
		}
	} catch (e) {
		if (request === lastRequest && !pieces.value) loadError.value = (e as Error).message
	}
}
watch(() => [props.etude.name, props.etude.modified], load, { immediate: true })

// Maquette, cliché, Desk s'ouvrent dans un autre onglet : au retour, la fiche montre ce qui a changé.
function onReturn() {
	if (document.visibilityState === 'visible' && !dialog.value) emit('reload')
}
onMounted(() => document.addEventListener('visibilitychange', onReturn))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onReturn))

function onSaved(result: PiecesResult, message: string) {
	lastRequest++
	pieces.value = result.pieces
	emit('saved', result, message)
}
function onFailed() {
	emit('reload')
}
async function linkExisting() {
	if (linking.value) return
	linking.value = true
	linkError.value = ''
	try {
		onSaved(await linkExistingPieces(props.etude), "Pièces de l'article liées à l'étude.")
	} catch (e) {
		linkError.value = (e as Error).message
		emit('reload')
	} finally {
		linking.value = false
	}
}

const isNew = computed(() => props.etude.status === 'Nouveau')
const banner = computed(() => (pieces.value ? piecesBanner(props.etude, pieces.value) : null))
const offset = computed(() => Boolean(pieces.value?.imposition))
const trace = computed(() => pieces.value?.trace)
const imposition = computed(() => pieces.value?.imposition)
const current = computed(() => imposition.value?.courante)
const machine = computed(() => pieces.value?.machine)
const machineBlocked = computed(() => machine.value?.alertes?.some((alert) => alert.tone === 'red'))
const atelierRoute = computed(() => ({ name: 'EtudeAtelier', params: { id: props.etude.name } }))
const origin = computed(() => cotationsOriginText(pieces.value?.cotations?.origine))
const flexoRows = computed(() => (pieces.value?.plan_flexo ? [pieces.value.plan_flexo, pieces.value.maquette, pieces.value.cliche] : []))
const unlinked = computed(() => Boolean(pieces.value?.travail) && flexoRows.value.some((row) => row?.name && !row.linked))
</script>

<template>
	<section class="card ref-card etude-pieces-card" aria-label="Pièces de l'étude">
		<div class="ref-card-head"><h3>Pièces de l'étude</h3></div>
		<p v-if="loadError" role="alert" class="etude-blocked">{{ loadError }}</p>
		<p v-else-if="linkError" role="alert" class="etude-blocked">{{ linkError }}</p>
		<p v-else-if="banner" class="etude-pieces-banner" :class="`tone-${banner.tone}`">{{ banner.text }}</p>
		<p v-if="!pieces && !loadError" class="m-0 text-ink-gray-6">Chargement des pièces…</p>

		<div v-if="pieces" class="etude-work-list">
			<!-- Tracé -->
			<div class="etude-work" :data-locked="isNew">
				<span class="etude-work-mark" :data-state="trace?.linked ? 'done' : isNew ? 'locked' : 'todo'" aria-hidden="true"><LucideCheck v-if="trace?.linked" /></span>
				<span class="etude-work-label">Tracé</span>
				<div class="etude-work-body">
					<p v-if="isNew" class="etude-quiet">Démarrez l'étude pour renseigner les pièces.</p>
					<p v-else-if="!trace?.name" class="etude-quiet">Aucun tracé pour cet article.</p>
					<template v-else>
						<p class="etude-work-line">
							<a class="ref-link tabular-nums" :href="deskUrl('Trace', trace.name)" target="_blank" rel="noopener noreferrer">{{ trace.name }}</a>
							<span v-if="trace.dimensions" class="etude-quiet tabular-nums">{{ dimensionsLabel(trace.dimensions) }} mm</span>
							<span v-if="offset && trace.points_colle" class="etude-quiet tabular-nums">{{ trace.points_colle }} point{{ trace.points_colle > 1 ? 's' : '' }} de colle</span>
							<span v-if="!trace.linked" class="etude-quiet">existe déjà pour cet article.</span>
						</p>
						<a v-if="trace.fichier" class="etude-file" :href="trace.fichier.url" target="_blank" rel="noopener noreferrer">{{ trace.fichier.name }}<LucideArrowUpRight aria-hidden="true" /></a>
						<p v-else-if="trace.linked && 'fichier' in trace" class="etude-quiet">Aucun fichier joint.</p>
						<p v-if="trace.ecart" class="etude-work-alert" data-tone="amber">{{ pieces.cotations?.valeur ? `Les cotations de l'article (${dimensionsLabel(pieces.cotations.valeur)}) ne correspondent pas à ce tracé.` : "L'article n'a pas encore de cotations : ce tracé les lui donnera à sa prochaine mise à jour." }}</p>
						<p v-if="origin" class="etude-quiet etude-small">Cotations de l'article. {{ origin }}</p>
					</template>
				</div>
				<div v-if="!isNew && pieces.travail" class="etude-work-actions">
					<button v-if="trace?.name && !trace.linked" type="button" class="btn-primary" :disabled="linking" @click="linkExisting">Lier à l'étude</button>
					<button v-else-if="trace?.name && trace.can_edit" type="button" class="btn-secondary" @click="dialog = 'trace'">Mettre à jour</button>
					<button v-else-if="!trace?.name && trace?.can_create" type="button" class="btn-primary" @click="dialog = 'trace'">Créer le tracé</button>
				</div>
			</div>

			<template v-if="offset">
				<!-- Imposition -->
				<div class="etude-work" :data-locked="isNew || !trace?.linked">
					<span class="etude-work-mark" :data-state="current ? 'done' : isNew || !trace?.linked ? 'locked' : 'todo'" aria-hidden="true"><LucideCheck v-if="current" /></span>
					<span class="etude-work-label">Imposition</span>
					<div class="etude-work-body">
						<template v-if="current">
							<p class="etude-work-line">
								<a class="ref-link tabular-nums" :href="deskUrl('Imposition', current.name)" target="_blank" rel="noopener noreferrer">{{ current.name }}</a>
								<span v-if="current.origine" class="badge tone-gray">{{ current.origine }}</span>
								<span v-if="current.calcul" class="etude-quiet etude-small tabular-nums">{{ current.calcul }}</span>
							</p>
							<div :class="current.dessin && 'etude-imposition'">
								<EtudeFeuille v-if="current.dessin" :dessin="current.dessin" />
								<dl v-if="current.format || current.nbr_poses" class="etude-stats">
									<div><dt>Format</dt><dd>{{ current.format || '—' }}</dd></div>
									<div><dt>Poses</dt><dd>{{ current.nbr_poses }}</dd></div>
									<div><dt>Taux de chutes</dt><dd>{{ percentLabel(current.taux_chutes) }}</dd></div>
									<div><dt>Feuilles</dt><dd>{{ quantityLabel(pieces.nbr_feuilles) }}</dd></div>
								</dl>
							</div>
							<a v-if="current.fichier" class="etude-file" :href="current.fichier.url" target="_blank" rel="noopener noreferrer">{{ current.fichier.name }}<LucideArrowUpRight aria-hidden="true" /></a>
						</template>
						<p v-else-if="!isNew && !trace?.linked" class="etude-quiet">Le tracé vient d'abord : l'imposition se calcule à partir de lui.</p>
						<p v-else-if="!isNew" class="etude-quiet">{{ imposition?.nombre ? `${imposition.nombre} imposition${imposition.nombre > 1 ? 's existent' : ' existe'} déjà pour ce tracé.` : 'Aucune imposition pour ce tracé.' }}</p>
					</div>
					<div v-if="pieces.travail && trace?.linked" class="etude-work-actions">
						<button v-if="imposition?.can_create || imposition?.can_edit" type="button" :class="current ? 'btn-secondary' : 'btn-primary'" @click="dialog = 'imposition'">{{ current ? 'Changer' : 'Choisir ou créer' }}</button>
						<button v-if="current && imposition?.can_edit" type="button" class="btn-secondary" @click="dialog = 'impositionEdit'">Mettre à jour</button>
						<RouterLink v-if="imposition?.atelier" class="btn-secondary" :to="atelierRoute">Atelier</RouterLink>
					</div>
				</div>

				<!-- Machine -->
				<div class="etude-work" :data-locked="isNew">
					<span class="etude-work-mark" :data-state="machine?.name && !machineBlocked ? 'done' : isNew ? 'locked' : 'todo'" aria-hidden="true"><LucideCheck v-if="machine?.name && !machineBlocked" /></span>
					<span class="etude-work-label">Machine</span>
					<div class="etude-work-body">
						<template v-if="machine?.name">
							<p class="etude-work-line">
								<span class="font-medium text-ink-gray-9">{{ machine.name }}</span>
								<StatusPill v-if="machine.status" :status="machineStatusLabel(machine.status)" :tone="machineStatusTone(machine.status)" />
							</p>
							<dl class="etude-stats">
								<div v-if="machine.format"><dt>Format max</dt><dd>{{ machine.format }}</dd></div>
								<div><dt>Passages</dt><dd>{{ machine.passages || '—' }}</dd></div>
								<div v-if="machine.charge"><dt>Charge presse</dt><dd>{{ quantityLabel(machine.charge) }} feuilles</dd></div>
							</dl>
							<p v-if="machine.detail" class="etude-quiet etude-small">{{ machine.detail }}</p>
							<p v-for="alert in machine.alertes" :key="alert.text" class="etude-work-alert" :data-tone="alert.tone">{{ alert.text }}</p>
						</template>
						<template v-else-if="!isNew">
							<p class="etude-quiet">Non choisie. Conseillée, mais pas exigée pour conclure.</p>
							<p v-if="!current" class="etude-quiet etude-small">Sans imposition, le format ne peut pas encore être contrôlé.</p>
						</template>
					</div>
					<div v-if="machine?.can_change" class="etude-work-actions">
						<button type="button" :class="!machine.name && current ? 'btn-primary' : 'btn-secondary'" @click="dialog = 'machine'">{{ machine.name ? 'Changer' : 'Choisir la presse' }}</button>
					</div>
				</div>
			</template>

			<template v-else>
				<!-- Plan Flexo -->
				<div class="etude-work" :data-locked="isNew">
					<span class="etude-work-mark" :data-state="pieces.plan_flexo?.linked ? 'done' : isNew ? 'locked' : 'todo'" aria-hidden="true"><LucideCheck v-if="pieces.plan_flexo?.linked" /></span>
					<span class="etude-work-label">Plan Flexo</span>
					<div class="etude-work-body">
						<template v-if="pieces.plan_flexo?.name">
							<p class="etude-work-line">
								<a class="ref-link tabular-nums" :href="deskUrl('Plan Flexo', pieces.plan_flexo.name)" target="_blank" rel="noopener noreferrer">{{ pieces.plan_flexo.name }}</a>
								<span v-if="pieces.plan_flexo.dimensions" class="etude-quiet tabular-nums">{{ pieces.plan_flexo.dimensions }}</span>
								<span v-if="pieces.plan_flexo.laize" class="etude-quiet tabular-nums">laize {{ pieces.plan_flexo.laize }}</span>
								<span v-if="!pieces.plan_flexo.linked" class="etude-quiet">existe déjà pour cet article.</span>
							</p>
							<a v-if="pieces.plan_flexo.fichier" class="etude-file" :href="pieces.plan_flexo.fichier.url" target="_blank" rel="noopener noreferrer">{{ pieces.plan_flexo.fichier.name }}<LucideArrowUpRight aria-hidden="true" /></a>
						</template>
						<p v-else-if="!isNew" class="etude-quiet">Aucun plan pour cet article.</p>
					</div>
					<div v-if="pieces.travail" class="etude-work-actions">
						<button v-if="pieces.plan_flexo?.name && pieces.plan_flexo.can_edit" type="button" class="btn-secondary" @click="dialog = 'plan'">Mettre à jour</button>
						<button v-else-if="pieces.plan_flexo?.can_create" type="button" class="btn-primary" @click="dialog = 'plan'">Créer le plan</button>
					</div>
				</div>

				<!-- Maquette : son circuit reste sur le Desk. -->
				<div class="etude-work" :data-locked="isNew">
					<span class="etude-work-mark" :data-state="pieces.maquette?.linked ? 'done' : isNew ? 'locked' : 'todo'" aria-hidden="true"><LucideCheck v-if="pieces.maquette?.linked" /></span>
					<span class="etude-work-label">Maquette</span>
					<div class="etude-work-body">
						<p v-if="pieces.maquette?.name" class="etude-work-line">
							<a class="ref-link tabular-nums" :href="deskUrl('Maquette', pieces.maquette.name)" target="_blank" rel="noopener noreferrer">{{ pieces.maquette.name }}</a>
							<StatusPill v-if="pieces.maquette.status" :status="pieces.maquette.status" />
							<span v-if="!pieces.maquette.linked" class="etude-quiet">existe déjà pour cet article.</span>
						</p>
						<p v-else-if="!isNew" class="etude-quiet">Aucune version activée pour cet article.</p>
					</div>
					<div v-if="pieces.travail && !pieces.maquette?.name" class="etude-work-actions">
						<a class="btn-secondary" :href="`/app/maquette?article=${encodeURIComponent(etude.article)}`" target="_blank" rel="noopener noreferrer">Gérer sur le Desk<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" /></a>
					</div>
				</div>

				<!-- Cliché -->
				<div class="etude-work" :data-locked="isNew">
					<span class="etude-work-mark" :data-state="pieces.cliche?.linked ? 'done' : isNew ? 'locked' : 'todo'" aria-hidden="true"><LucideCheck v-if="pieces.cliche?.linked" /></span>
					<span class="etude-work-label">Cliché</span>
					<div class="etude-work-body">
						<template v-if="pieces.cliche?.name">
							<p class="etude-work-line">
								<a class="ref-link tabular-nums" :href="deskUrl('Cliche', pieces.cliche.name)" target="_blank" rel="noopener noreferrer">{{ pieces.cliche.name }}</a>
								<StatusPill v-if="pieces.cliche.status" :status="pieces.cliche.status" />
								<span v-if="!pieces.cliche.linked" class="etude-quiet">existe déjà pour cet article.</span>
							</p>
							<p class="etude-quiet etude-small">Son circuit de validation se poursuit sur le Desk.</p>
						</template>
						<p v-else-if="!isNew" class="etude-quiet">Aucun cliché actif pour cet article.</p>
					</div>
					<div v-if="pieces.travail && !pieces.cliche?.name && pieces.cliche?.can_create" class="etude-work-actions">
						<button type="button" class="btn-primary" @click="dialog = 'cliche'">Créer le cliché</button>
					</div>
				</div>
				<div v-if="unlinked" class="etude-work-link"><button type="button" class="btn-secondary" :disabled="linking" @click="linkExisting">Lier les pièces de l'article à cette étude</button></div>
			</template>
		</div>

		<EtudeTraceDialog v-if="dialog === 'trace' && pieces" :etude="etude" :pieces="pieces" @close="dialog = null" @saved="onSaved" @failed="onFailed" />
		<EtudeImpositionDialog v-else-if="dialog === 'imposition' && pieces" :etude="etude" :pieces="pieces" :atelier-route="atelierRoute" @close="dialog = null" @saved="onSaved" @failed="onFailed" @manual="dialog = 'impositionNew'" />
		<EtudeImpositionForm v-else-if="dialog === 'impositionNew'" :etude="etude" @close="dialog = null" @saved="onSaved" @failed="onFailed" />
		<EtudeImpositionForm v-else-if="dialog === 'impositionEdit'" :etude="etude" :imposition="current" @close="dialog = null" @saved="onSaved" @failed="onFailed" />
		<EtudeMachineDialog v-else-if="dialog === 'machine'" :etude="etude" :current="machine?.name ?? null" :has-imposition="Boolean(current)" @close="dialog = null" @saved="onSaved" @failed="onFailed" />
		<EtudeFlexoDialogs v-else-if="dialog === 'plan' || dialog === 'cliche'" :etude="etude" :kind="dialog" :plan="pieces?.plan_flexo" @close="dialog = null" @saved="onSaved" @failed="onFailed" />
	</section>
</template>
