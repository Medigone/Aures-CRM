<script setup lang="ts">
import { computed, ref } from 'vue'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import type { UploadedFile } from '@shared/api'
import { createTraceVersion, setTraceFile } from '@/lib/api'
import { batConfirmationText, dimensionsLabel, sameCotations, type BatConfirmation } from '@/lib/etudePieces'
import { versionConsequences, versionDoneText, versionLabel, type TraceDetail } from '@/lib/traces'

/** Nouvelle version du tracé, depuis sa fiche : en service tout de suite, comme une maquette activée. */
const props = defineProps<{ trace: TraceDetail }>()
const emit = defineEmits<{ close: []; saved: [trace: TraceDetail, message: string]; failed: [] }>()

const offset = computed(() => props.trace.procede !== 'Flexo')
const next = computed(() => Math.max(...props.trace.versions.map((row) => row.ver), props.trace.ver) + 1)
const description = ref('')
const dimensions = ref(props.trace.dimensions || '')
const points = ref(String(props.trace.points_colle ?? 0))
const confirmation = ref<BatConfirmation | null>(null)
const busy = ref(false)
const error = ref('')
const consequences = computed(() => versionConsequences(props.trace))
const willChangeArticle = computed(() => offset.value && Boolean(dimensions.value.trim()) && !sameCotations(dimensions.value, props.trace.dimensions || ''))

// Le fichier part une fois la version créée, puis se range dessus.
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const uploading = ref(false)
let uploadedUrl = ''
let settle: ((value: TraceDetail) => void) | null = null
let fail: ((error: Error) => void) | null = null
let created: TraceDetail | null = null
const hasFile = () => Boolean(uploader.value?.items.length)
function onUploaded(file: UploadedFile) {
	uploadedUrl = file.file_url
}
async function onSettled(_sent: number, failed: number) {
	uploading.value = false
	try {
		if (failed || !uploadedUrl || !created) throw new Error("La version est créée, mais son fichier n'est pas joint. Déposez-le depuis sa fiche.")
		settle?.(await setTraceFile(created, uploadedUrl))
	} catch (e) {
		fail?.(e as Error)
	}
}
function sendFile(trace: TraceDetail) {
	if (!hasFile()) return Promise.resolve(trace)
	created = trace
	uploadedUrl = ''
	uploading.value = true
	return new Promise<TraceDetail>((resolve, reject) => {
		settle = resolve
		fail = reject
		uploader.value?.start({ doctype: 'Trace', docname: trace.name })
	})
}

async function submit(confirmBat = 0) {
	if (busy.value) return
	error.value = ''
	if (!description.value.trim()) {
		error.value = 'Décrivez ce qui change dans cette version.'
		return
	}
	if (!dimensions.value.trim()) {
		error.value = 'Indiquez les dimensions du tracé.'
		return
	}
	busy.value = true
	try {
		const result = await createTraceVersion(props.trace, { desc_changements: description.value, dimensions: dimensions.value, points_colle: Number(points.value) || 0, confirm_bat: confirmBat, copy_file: Number(!hasFile()) })
		if ('confirmation' in result) {
			confirmation.value = result.confirmation
			return
		}
		let message = versionDoneText(result)
		let trace = result.trace
		try {
			trace = await sendFile(result.trace)
		} catch (e) {
			message = `${message} ${(e as Error).message}`
		}
		emit('saved', trace, message)
		emit('close')
	} catch (e) {
		error.value = (e as Error).message
		confirmation.value = null
		emit('failed')
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog :title="confirmation ? 'Remplacer les cotations du BAT ?' : `Nouvelle version du tracé : ${versionLabel(next)}`" :dirty="Boolean(description)" hint="" :busy="busy || uploading" @close="emit('close')" @submit="submit(confirmation ? 1 : 0)">
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<template v-if="confirmation">
			<p class="m-0">{{ batConfirmationText(confirmation) }}</p>
			<p class="m-0 text-ink-gray-6">L'article sera mis à jour. Sa fiche gardera que ses cotations venaient du BAT et qui les a modifiées depuis le tracé.</p>
		</template>
		<template v-else>
			<p class="m-0 text-ink-gray-6">La {{ versionLabel(next) }} est en service dès sa création. La {{ versionLabel(trace.ver) }} reste consultable, marquée obsolète.</p>
			<ul v-if="consequences.length" class="m-0 flex list-none flex-col gap-1 rounded-control tone-amber px-3 py-2 text-sm">
				<li v-for="line in consequences" :key="line">{{ line }}</li>
			</ul>
			<label class="form-field">
				<span class="field-label">Ce qui change</span>
				<textarea v-model="description" class="field-input" rows="3" placeholder="Par exemple : patte de collage élargie à 15 mm, demande du client du 6 novembre"></textarea>
			</label>
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
			<div class="form-field">
				<span class="field-label">Fichier du tracé</span>
				<span class="field-note"><template v-if="trace.fichier">Sans nouveau fichier, celui de la {{ versionLabel(trace.ver) }} est recopié : {{ trace.fichier.name }}.</template><template v-else>La version actuelle n'a pas de fichier.</template> L'atelier ne lit que le PDF.</span>
				<FileUploader ref="uploader" deferred :multiple="false" doctype="Trace" @change="error = ''" @uploaded="onUploaded" @settled="onSettled" />
			</div>
			<p v-if="willChangeArticle" class="rounded-control tone-amber px-3 py-2 text-sm">Les cotations de l'article {{ trace.designation }} seront mises à jour : {{ dimensionsLabel(trace.dimensions || '') }} deviendra {{ dimensionsLabel(dimensions) }}.</p>
		</template>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy || uploading" @click="submit(confirmation ? 1 : 0)">{{ confirmation ? 'Remplacer et mettre en service' : 'Mettre en service' }}</button>
		</template>
	</FormDialog>
</template>
