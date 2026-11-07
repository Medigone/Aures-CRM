<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { duplicateTrace, getTraceReferences, saveTrace } from '@/lib/api'
import { batConfirmationText, dimensionsLabel, sameCotations, type BatConfirmation, type EtudePieces, type PiecesResult, type SaveTraceResult, type TraceReference } from '@/lib/etudePieces'
import type { EtudeDetail } from '@/lib/etudes'
import { usePieceUpload } from '@/lib/usePieceUpload'

/** Créer, dupliquer ou mettre à jour le tracé. En Offset ses dimensions deviennent les cotations de l'article : si elles viennent d'un BAT, cela se confirme. */
const props = defineProps<{ etude: EtudeDetail; pieces: EtudePieces }>()
const emit = defineEmits<{ close: []; saved: [result: PiecesResult, message: string]; failed: [] }>()

const offset = computed(() => Boolean(props.pieces.imposition))
const trace = computed(() => props.pieces.trace)
const editing = computed(() => Boolean(trace.value.name))
const articleCotations = computed(() => props.pieces.cotations?.valeur ?? '')

const mode = ref<'new' | 'copy'>('new')
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
const title = computed(() => (editing.value ? `Mettre à jour le tracé ${trace.value.name}` : 'Créer le tracé'))
const button = computed(() => (editing.value ? 'Mettre à jour' : copying.value ? 'Dupliquer' : 'Créer le tracé'))

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
	if (!copying.value && !trace.value.fichier && !upload.hasFile()) {
		error.value = 'Joignez le fichier du tracé.'
		return
	}
	busy.value = true
	try {
		const common = { dimensions: dimensions.value, points_colle: Number(points.value) || 0, confirm_bat: confirmBat }
		const result = copying.value ? await duplicateTrace(props.etude, { ...common, source: source.value, with_impositions: Number(withImpositions.value && canCopyImpositions.value) }) : await saveTrace(props.etude, common)
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
				<span v-if="trace.fichier" class="field-note">Actuel : <a class="ref-link" :href="trace.fichier.url" target="_blank" rel="noopener noreferrer">{{ trace.fichier.name }}</a>. Il reste si vous n'en déposez pas d'autre.</span>
				<FileUploader ref="uploader" deferred :multiple="false" doctype="Trace" :docname="trace.name ?? undefined" @change="error = ''" @uploaded="upload.onUploaded" @settled="upload.onSettled" />
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
