<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { duplicateTrace, getTraceReferences, newTraceVersion, saveTrace } from '@/lib/api'
import { batConfirmationText, dimensionsLabel, sameCotations, type BatConfirmation, type EtudePieces, type PiecesResult, type SaveTraceResult, type TraceReference } from '@/lib/etudePieces'
import type { EtudeDetail } from '@/lib/etudes'
import { versionConsequences, versionDoneText, versionLabel } from '@/lib/traces'
import { usePieceUpload } from '@/lib/usePieceUpload'

/** Créer, dupliquer ou mettre à jour le tracé. En Offset ses dimensions deviennent les cotations de l'article : si elles viennent d'un BAT, cela se confirme. */
const props = defineProps<{ etude: EtudeDetail; pieces: EtudePieces }>()
const emit = defineEmits<{ close: []; saved: [result: PiecesResult, message: string]; failed: [] }>()

const offset = computed(() => Boolean(props.pieces.imposition))
const trace = computed(() => props.pieces.trace)
const editing = computed(() => Boolean(trace.value.name))
const articleCotations = computed(() => props.pieces.cotations?.valeur ?? '')

const mode = ref<'new' | 'copy'>('new')
// Sur un tracé existant : corriger la version en service, ou en mettre une nouvelle en service.
const change = ref<'fix' | 'version'>('fix')
const description = ref('')
const versioning = computed(() => editing.value && change.value === 'version')
// Des impositions s'appuient sur le dessin : le changer passe par une nouvelle version.
const fileLocked = computed(() => editing.value && !versioning.value && (trace.value.impositions ?? 0) > 0)
const consequences = computed(() => versionConsequences({ impositions: trace.value.impositions }))
const dimensions = ref(trace.value.dimensions || articleCotations.value)
const points = ref(String(trace.value.points_colle ?? 0))
const references = ref<TraceReference[] | null>(null)
const source = ref('')
const withImpositions = ref(true)
const confirmation = ref<BatConfirmation | null>(null)
const busy = ref(false)
const error = ref('')
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const upload = usePieceUpload(uploader, 'trace', 'Trace')

const copying = computed(() => mode.value === 'copy' && !editing.value)
const reference = computed(() => references.value?.find((row) => row.name === source.value))
const canCopyImpositions = computed(() => offset.value && (reference.value?.impositions ?? 0) > 0)
const willChangeArticle = computed(() => offset.value && Boolean(dimensions.value.trim()) && !sameCotations(dimensions.value, articleCotations.value))
const nextVersion = computed(() => (trace.value.ver ?? 1) + 1)
const title = computed(() => (versioning.value ? `Nouvelle version du tracé : ${versionLabel(nextVersion.value)}` : editing.value ? `Mettre à jour le tracé ${trace.value.name}` : 'Créer le tracé'))
const button = computed(() => (versioning.value ? 'Mettre en service' : editing.value ? 'Mettre à jour' : copying.value ? 'Dupliquer' : 'Créer le tracé'))

onMounted(async () => {
	if (editing.value) return
	try {
		references.value = await getTraceReferences(props.etude.name)
	} catch {
		references.value = []
	}
})
watch(reference, (row) => {
	if (!row) return
	dimensions.value = row.dimensions || articleCotations.value
	points.value = String(row.points_colle ?? 0)
})

function isConfirmation(result: SaveTraceResult): result is { confirmation: BatConfirmation } {
	return 'confirmation' in result
}
async function submit(confirmBat = 0) {
	if (busy.value) return
	error.value = ''
	if (!dimensions.value.trim()) {
		error.value = 'Indiquez les dimensions du tracé.'
		return
	}
	if (copying.value && !source.value) {
		error.value = "Choisissez l'article de référence."
		return
	}
	if (versioning.value && !description.value.trim()) {
		error.value = 'Décrivez ce qui change dans cette version.'
		return
	}
	if (!copying.value && !trace.value.fichier && !upload.hasFile()) {
		error.value = 'Joignez le fichier du tracé.'
		return
	}
	busy.value = true
	try {
		const common = { dimensions: dimensions.value, points_colle: Number(points.value) || 0, confirm_bat: confirmBat }
		const result = copying.value
			? await duplicateTrace(props.etude, { ...common, source: source.value, with_impositions: Number(withImpositions.value && canCopyImpositions.value) })
			: versioning.value
				? await newTraceVersion(props.etude, { ...common, desc_changements: description.value, copy_file: Number(!upload.hasFile()) })
				: await saveTrace(props.etude, common)
		if (isConfirmation(result)) {
			confirmation.value = result.confirmation
			return
		}
		const done = copying.value ? result : await upload.send(result)
		emit('saved', done, savedMessage(result))
		emit('close')
	} catch (e) {
		error.value = (e as Error).message
		confirmation.value = null
		emit('failed')
	} finally {
		busy.value = false
	}
}
function savedMessage(result: PiecesResult) {
	if (versioning.value) return versionDoneText({ ver: nextVersion.value, impositions: result.impositions ?? 0, formes: result.formes ?? 0 })
	if (!copying.value) return editing.value ? 'Tracé mis à jour.' : 'Tracé créé et lié.'
	if (result.fichier_copie === false) return "Tracé dupliqué et lié, mais son fichier n'a pas pu être copié : joignez-le."
	return result.impositions ? `Tracé dupliqué et lié, avec ${result.impositions} imposition${result.impositions > 1 ? 's' : ''}.` : 'Tracé dupliqué et lié.'
}
</script>

<template>
	<FormDialog :title="confirmation ? 'Remplacer les cotations du BAT ?' : title" :dirty="false" hint="" :busy="busy || upload.uploading.value" @close="emit('close')" @submit="submit(confirmation ? 1 : 0)">
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<template v-if="confirmation">
			<p class="m-0">{{ batConfirmationText(confirmation) }}</p>
			<p class="m-0 text-ink-gray-6">L'article sera mis à jour. Sa fiche gardera que ses cotations venaient du BAT et qui les a modifiées depuis le tracé.</p>
		</template>
		<template v-else>
			<div v-if="!editing" class="seg self-start" role="group" aria-label="Origine du tracé">
				<button type="button" :aria-pressed="mode === 'new'" @click="mode = 'new'">Nouveau tracé</button>
				<button type="button" :aria-pressed="mode === 'copy'" @click="mode = 'copy'">Dupliquer d'un autre article</button>
			</div>
			<template v-if="copying">
				<p class="m-0 text-ink-gray-6">Pour un article voisin du même client. Le tracé reçoit un nouveau numéro, et son fichier est copié.</p>
				<label class="form-field">
					<span class="field-label">Article de référence</span>
					<select v-model="source" class="field-input">
						<option value="" disabled>{{ references === null ? 'Chargement…' : references.length ? 'Choisir' : 'Aucun autre tracé pour ce client' }}</option>
						<option v-for="row in references ?? []" :key="row.name" :value="row.name">{{ row.designation }}, {{ row.name }}</option>
					</select>
				</label>
			</template>
			<template v-if="editing && trace.can_version">
				<div class="seg self-start" role="group" aria-label="Ce qui change">
					<button type="button" :aria-pressed="change === 'fix'" @click="change = 'fix'">Corriger la {{ versionLabel(trace.ver ?? 1) }}</button>
					<button type="button" :aria-pressed="change === 'version'" @click="change = 'version'">Nouvelle version</button>
				</div>
				<p class="m-0 text-ink-gray-6">{{ versioning ? `La ${versionLabel(nextVersion)} est en service dès sa création, et l'étude passe dessus. La ${versionLabel(trace.ver ?? 1)} reste consultable, marquée obsolète.` : 'Une correction garde le même tracé et ses impositions : pour une erreur de saisie, pas pour un dessin qui change.' }}</p>
				<ul v-if="versioning && consequences.length" class="m-0 flex list-none flex-col gap-1 rounded-control tone-amber px-3 py-2 text-sm">
					<li v-for="line in consequences" :key="line">{{ line }}</li>
				</ul>
				<label v-if="versioning" class="form-field">
					<span class="field-label">Ce qui change</span>
					<textarea v-model="description" class="field-input" rows="3" placeholder="Par exemple : patte de collage élargie à 15 mm, demande du client du 6 novembre"></textarea>
				</label>
			</template>
			<p v-if="trace.ecart && editing && articleCotations" class="rounded-control tone-amber px-3 py-2 text-sm">Les cotations de l'article ({{ dimensionsLabel(articleCotations) }}) ont changé sur sa fiche et ne correspondent plus à ce tracé.</p>
			<div class="form-grid">
				<label class="form-field">
					<span class="field-label">Dimensions (mm)</span>
					<input v-model="dimensions" class="field-input" type="text" autocomplete="off" />
					<span v-if="offset" class="field-note">Même format que les cotations de l'article : 75, 56x280 ou 80x35x118.</span>
				</label>
				<label v-if="offset" class="form-field">
					<span class="field-label">Points de colle</span>
					<input v-model="points" class="field-input" type="number" min="0" step="1" />
				</label>
			</div>
			<label v-if="copying && canCopyImpositions" class="flex items-center gap-2">
				<input v-model="withImpositions" class="h-4 w-4" type="checkbox" />
				Dupliquer aussi ses {{ reference?.impositions }} impositions
			</label>
			<div v-if="!copying" class="form-field">
				<span class="field-label">Fichier du tracé</span>
				<span v-if="trace.fichier && versioning" class="field-note">Sans nouveau fichier, celui de la {{ versionLabel(trace.ver ?? 1) }} est recopié : {{ trace.fichier.name }}. L'atelier ne lit que le PDF.</span>
				<span v-else-if="trace.fichier" class="field-note">Actuel : <a class="ref-link" :href="trace.fichier.url" target="_blank" rel="noopener noreferrer">{{ trace.fichier.name }}</a>. Il reste si vous n'en déposez pas d'autre.</span>
				<span v-if="fileLocked" class="field-note">{{ trace.impositions }} imposition{{ (trace.impositions ?? 0) > 1 ? 's s\'appuient' : ' s\'appuie' }} sur ce fichier : pour changer le dessin, choisissez Nouvelle version.</span>
				<FileUploader v-else ref="uploader" deferred :multiple="false" doctype="Trace" :docname="trace.name ?? undefined" @change="error = ''" @uploaded="upload.onUploaded" @settled="upload.onSettled" />
			</div>
			<p v-if="willChangeArticle" class="rounded-control tone-amber px-3 py-2 text-sm"><template v-if="articleCotations">Les cotations de l'article {{ etude.designation }} seront mises à jour : {{ dimensionsLabel(articleCotations) }} deviendra {{ dimensionsLabel(dimensions) }}.</template><template v-else>L'article {{ etude.designation }} n'a pas de cotations : il recevra {{ dimensionsLabel(dimensions) }}.</template></p>
		</template>
		<template #actions>
			<template v-if="confirmation">
				<button type="button" class="btn-secondary" :disabled="busy" @click="confirmation = null">Revoir</button>
				<button type="button" class="btn-primary" :disabled="busy" @click="submit(1)">Remplacer les cotations</button>
			</template>
			<button v-else type="button" class="btn-primary" :disabled="busy || upload.uploading.value" @click="submit(0)">{{ button }}</button>
		</template>
	</FormDialog>
</template>
