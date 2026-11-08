<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { createGroupImposition, groupCandidates, simulateGroup } from '@/lib/api'
import { mm, percentLabel, sheetsLabel, type AtelierEtude, type AtelierFormat, type AtelierReglages } from '@/lib/atelier'
import { formatQuantity } from '@/lib/etudes'
import { GROUP_MAX, GROUP_TONES, groupError, groupPoses, surplusLabel, type GroupCandidate, type GroupEntry, type GroupResult } from '@/lib/groupage'

/**
 * Plusieurs articles d'un même support sur la feuille, pas forcément d'un même client. Les poses de chacun se
 * saisissent ; le moteur range un bloc par article, sur chaque format coché. Une Imposition par article à la création.
 */
const props = defineProps<{ etude: AtelierEtude; calcul: string; formats: AtelierFormat[]; reglages: AtelierReglages; defaultPoses: number; canWork: boolean; canCreate: boolean }>()
const emit = defineEmits<{ created: [message: string] }>()

const open = ref(false)
const candidates = ref<GroupCandidate[] | null>(null)
const support = ref<string | null>(null)
const entries = ref<GroupEntry[]>([{ etude: props.etude.name, designation: props.etude.designation, client_label: props.etude.client_label, quantite: props.etude.quantite, poses: props.defaultPoses || 1 }])
const picked = ref('')
const result = ref<GroupResult | null>(null)
const shown = ref(0)
const error = ref('')
const busy = ref(false)
const confirm = ref(false)

const available = computed(() => (candidates.value ?? []).filter((row) => row.lisible && !entries.value.some((entry) => entry.etude === row.name)))
const sheetFormats = computed(() => props.formats.filter((row) => row.coche && !row.bobine))
const line = computed(() => result.value?.lignes[shown.value] ?? null)
const poses = computed(() => (result.value && line.value ? groupPoses(result.value, line.value) : []))
const allInStudy = computed(() => (result.value?.membres ?? []).every((member) => member.status === 'En étude'))

watch(open, async (value) => {
	if (!value || candidates.value) return
	try {
		const response = await groupCandidates(props.etude.name)
		candidates.value = response.etudes
		support.value = response.support
	} catch (e) {
		error.value = (e as Error).message
	}
})
function outdated() {
	result.value = null
}
function add() {
	const row = available.value.find((candidate) => candidate.name === picked.value)
	if (!row || entries.value.length >= GROUP_MAX) return
	entries.value = [...entries.value, { etude: row.name, designation: row.designation, client_label: row.client_label, quantite: row.quantite, poses: 1 }]
	picked.value = ''
	outdated()
}
function remove(index: number) {
	entries.value = entries.value.filter((_entry, at) => at !== index)
	outdated()
}
const margins = () => ({ lisiere: props.reglages.lisiere, pince: props.reglages.pince, marge_arriere: props.reglages.marge_arriere })
const members = () => entries.value.map((entry) => ({ etude: entry.etude, poses: entry.poses }))
async function simulate() {
	error.value = groupError(entries.value) || (sheetFormats.value.length ? '' : 'Cochez au moins un format de feuille.')
	if (error.value) return
	busy.value = true
	try {
		result.value = await simulateGroup({ etude: props.etude.name, calcul: props.calcul, membres: members(), formats: sheetFormats.value, ...margins() })
		shown.value = 0
		if (!result.value.lignes.length) error.value = 'Les poses demandées ne tiennent sur aucun format coché : réduisez-les ou cochez un format plus grand.'
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
async function create() {
	if (!line.value) return
	busy.value = true
	error.value = ''
	try {
		const created = await createGroupImposition({ etude: props.etude.name, calcul: props.calcul, membres: members(), laize: line.value.laize, depl: line.value.depl, ...margins() })
		confirm.value = false
		emit('created', `Feuille groupée ${created.groupage} : ${created.impositions.map((row) => `${row.imposition} pour ${row.etude}`).join(', ')}.`)
	} catch (e) {
		error.value = (e as Error).message
		confirm.value = false
	} finally {
		busy.value = false
	}
}
const blockOf = (etude: string) => line.value?.blocs.find((block) => block.etude === etude)
</script>

<template>
	<section class="card atelier-group" aria-label="Groupage">
		<details :open="open" @toggle="open = ($event.target as HTMLDetailsElement).open">
			<summary>Groupage<small>Plusieurs articles du même support sur une feuille</small></summary>
			<p v-if="support" class="m-0 text-sm text-ink-gray-6">Études ouvertes sur {{ support }}, tous clients confondus. Chaque article garde son tracé ; deux articles ne partagent jamais un trait de coupe.</p>
			<table class="atelier-table atelier-group-members">
				<thead><tr><th>Article</th><th>Client</th><th class="end">Quantité</th><th class="end">Poses</th><th><span class="sr-only">Retirer</span></th></tr></thead>
				<tbody>
					<tr v-for="(entry, index) in entries" :key="entry.etude">
						<td><span class="atelier-group-dot" :data-tone="GROUP_TONES[index]" aria-hidden="true"></span><b class="font-medium text-ink-gray-9">{{ entry.designation }}</b><small class="block text-ink-gray-6">{{ entry.etude }}</small></td>
						<td>{{ entry.client_label }}</td>
						<td class="end">{{ formatQuantity(entry.quantite) }}</td>
						<td class="end"><input v-model.number="entry.poses" class="field-input tabular-nums atelier-group-poses" type="number" min="1" step="1" :aria-label="`Poses de ${entry.designation}`" :disabled="!canWork" @change="outdated" /></td>
						<td class="end"><button v-if="index > 0 && canWork" type="button" class="btn-ghost" @click="remove(index)">Retirer</button></td>
					</tr>
				</tbody>
			</table>
			<div v-if="canWork" class="atelier-group-add">
				<select v-model="picked" class="field-input" :disabled="!available.length || entries.length >= GROUP_MAX" aria-label="Étude à ajouter">
					<option value="">{{ candidates === null ? 'Chargement des études…' : available.length ? 'Ajouter une étude du même support' : 'Aucune autre étude ouverte sur ce support' }}</option>
					<option v-for="row in available" :key="row.name" :value="row.name">{{ row.designation }} · {{ row.client_label }} · {{ formatQuantity(row.quantite) }} ex. · {{ row.name }}</option>
				</select>
				<button type="button" class="btn-secondary" :disabled="!picked" @click="add">Ajouter</button>
				<button type="button" class="btn-primary" :disabled="busy || entries.length < 2" @click="simulate">{{ busy && !confirm ? 'Rangement…' : 'Ranger sur les formats cochés' }}</button>
			</div>
			<p v-if="error" role="alert" class="field-error m-0">{{ error }}</p>

			<template v-if="result && line">
				<div class="atelier-tabs-list" role="group" aria-label="Formats groupés">
					<button v-for="(row, index) in result.lignes" :key="row.libelle" type="button" class="atelier-tab tabular-nums" :aria-pressed="index === shown" @click="shown = index">{{ row.libelle }} · {{ sheetsLabel(row.nb_feuilles) }} f.</button>
				</div>
				<p v-if="result.refus.length" class="m-0 text-sm text-ink-gray-6">Ne tient pas sur : {{ result.refus.join(', ') }}.</p>
				<div class="atelier-group-view">
					<figure class="etude-sheet atelier-group-sheet">
						<svg :viewBox="`0 0 ${line.laize} ${line.depl}`" role="img" :aria-label="`Feuille groupée ${line.libelle} millimètres, ${line.nb_poses} poses`">
							<rect x="0" y="0" :width="line.laize" :height="line.depl" class="atelier-group-paper" />
							<g :transform="`translate(0 ${line.depl}) scale(1 -1)`">
								<g v-for="pose in poses" :key="pose.key" :transform="pose.transform" :data-tone="GROUP_TONES[pose.article]">
									<path class="atelier-group-cut" :d="pose.paths?.path_coupe" />
									<path v-if="pose.paths?.path_rainage" class="etude-sheet-crease" :d="pose.paths.path_rainage" />
								</g>
							</g>
						</svg>
						<figcaption class="tabular-nums">Feuille {{ line.libelle }} mm · {{ line.nb_poses }} poses · reste {{ mm(line.reste_laize) }} × {{ mm(line.reste_depl) }}</figcaption>
					</figure>
					<div class="atelier-stats">
						<div class="atelier-rate tabular-nums">{{ sheetsLabel(line.nb_feuilles) }}<small>feuilles à tirer</small></div>
						<p class="m-0 text-sm text-ink-gray-6">{{ percentLabel(line.taux_chutes) }} de la feuille en chutes. Le tirage suit l'article qui demande le plus de feuilles ; les autres sont surproduits.</p>
						<button v-if="canCreate" type="button" class="btn-primary" :disabled="busy || !allInStudy" :title="allInStudy ? undefined : 'Toutes les études doivent être En étude'" @click="confirm = true">Créer les impositions groupées</button>
						<p v-if="canCreate && !allInStudy" class="m-0 text-sm text-ink-gray-6">Démarrez d'abord chaque étude du groupage.</p>
					</div>
				</div>
				<div class="atelier-table-wrap atelier-group-table">
					<table class="atelier-table">
						<thead><tr><th>Article</th><th class="end">Grille</th><th class="end">Il lui faut</th><th class="end">En trop</th></tr></thead>
						<tbody>
							<tr v-for="(member, index) in result.membres" :key="member.etude">
								<td><span class="atelier-group-dot" :data-tone="GROUP_TONES[index]" aria-hidden="true"></span>{{ member.designation }}<small class="block text-ink-gray-6">{{ member.etude }}</small></td>
								<td class="end">{{ blockOf(member.etude)?.n_col }} × {{ blockOf(member.etude)?.n_rang }}</td>
								<td class="end">{{ sheetsLabel(blockOf(member.etude)?.feuilles_necessaires ?? 0) }} f.</td>
								<td class="end">{{ surplusLabel(blockOf(member.etude)?.surproduction ?? 0) }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</template>
		</details>
		<FormDialog v-if="confirm && line && result" title="Créer les impositions groupées ?" :dirty="false" hint="" :busy="busy" @close="confirm = false" @submit="create">
			<p class="m-0">Une imposition par article sur la feuille <b class="font-semibold text-ink-gray-9">{{ line.libelle }} mm</b>, un seul PDF pour toutes, {{ sheetsLabel(line.nb_feuilles) }} feuilles à tirer.</p>
			<ul class="m-0 pl-4 text-sm">
				<li v-for="member in result.membres" :key="member.etude">{{ member.etude }}, {{ member.designation }} : {{ blockOf(member.etude)?.poses }} poses</li>
			</ul>
			<p class="rounded-control tone-amber px-3 py-2 text-sm">Chaque étude prend son imposition, à la place de celle qu'elle avait. Une imposition groupée ne devient jamais l'idéale de son article.</p>
			<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="create">Créer et lier aux études</button></template>
		</FormDialog>
	</section>
</template>
