<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { saveImposition } from '@/lib/api'
import { impositionFormValues, type ImpositionRow, type PiecesResult } from '@/lib/etudePieces'
import type { EtudeDetail } from '@/lib/etudes'
import { usePieceUpload } from '@/lib/usePieceUpload'

/** Saisir une imposition, liée aussitôt à l'étude, ou mettre à jour celle de l'étude. */
const props = defineProps<{ etude: EtudeDetail; imposition?: (Partial<ImpositionRow> & { name: string }) | null }>()
const emit = defineEmits<{ close: []; saved: [result: PiecesResult, message: string]; failed: [] }>()

const values = reactive(impositionFormValues(props.imposition))
const busy = ref(false)
const error = ref('')
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const upload = usePieceUpload(uploader, 'imposition', 'Imposition')
const title = computed(() => (props.imposition ? `Mettre à jour ${props.imposition.name}` : 'Saisir une imposition'))

async function submit() {
	if (busy.value) return
	error.value = ''
	if (!props.imposition?.fichier && !upload.hasFile()) {
		error.value = "Joignez le fichier d'imposition."
		return
	}
	busy.value = true
	try {
		const saved = await saveImposition(props.etude, { ...values, imposition: props.imposition?.name })
		emit('saved', await upload.send(saved), props.imposition ? 'Imposition mise à jour.' : 'Imposition créée et liée à cette étude.')
		emit('close')
	} catch (e) {
		error.value = (e as Error).message
		emit('failed')
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog :title="title" :dirty="false" hint="" :busy="busy || upload.uploading.value" @close="emit('close')" @submit="submit">
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<div class="form-grid">
			<label class="form-field"><span class="field-label">Laize ou palette</span><select v-model="values.laize_pal" class="field-input"><option>Laize</option><option>Palette</option></select></label>
			<label class="form-field">
				<span class="field-label">Format {{ values.laize_pal.toLowerCase() }}</span>
				<input v-model="values.format_laize_palette" class="field-input" type="text" autocomplete="off" />
				<span class="field-note">{{ values.laize_pal === 'Laize' ? 'En mm : 720' : 'En mm : 720x450' }}</span>
			</label>
			<label class="form-field">
				<span class="field-label">Format d'impression (mm)</span>
				<input v-model="values.format_imp" class="field-input" type="text" autocomplete="off" />
				<span class="field-note">720x450</span>
			</label>
			<label class="form-field"><span class="field-label">Nombre de poses</span><input v-model="values.nbr_poses" class="field-input" type="number" min="1" step="1" /></label>
			<label class="form-field"><span class="field-label">Taux de chutes (%)</span><input v-model="values.taux_chutes" class="field-input" type="text" inputmode="decimal" autocomplete="off" /></label>
		</div>
		<div class="form-field">
			<span class="field-label">Fichier d'imposition</span>
			<span v-if="imposition?.fichier" class="field-note">Actuel : <a class="ref-link" :href="imposition.fichier.url" target="_blank" rel="noopener noreferrer">{{ imposition.fichier.name }}</a>. Il reste si vous n'en déposez pas d'autre.</span>
			<FileUploader ref="uploader" deferred :multiple="false" doctype="Imposition" :docname="imposition?.name" @change="error = ''" @uploaded="upload.onUploaded" @settled="upload.onSettled" />
		</div>
		<p v-if="imposition" class="rounded-control tone-blue px-3 py-2 text-sm">Le nouveau taux de chutes sera reporté sur l'étude.</p>
		<template #actions><button type="button" class="btn-primary" :disabled="busy || upload.uploading.value" @click="submit">{{ imposition ? 'Mettre à jour' : "Créer et lier à l'étude" }}</button></template>
	</FormDialog>
</template>
