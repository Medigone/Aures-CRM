<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { createCliche, getClicheOptions, savePlanFlexo } from '@/lib/api'
import type { ClicheOptions, FlexoPiece, PiecesResult } from '@/lib/etudePieces'
import type { EtudeDetail } from '@/lib/etudes'
import { usePieceUpload } from '@/lib/usePieceUpload'

/** Plan Flexo à créer ou mettre à jour, cliché à créer en brouillon. Le reste du circuit du cliché se poursuit sur le Desk. */
const props = defineProps<{ etude: EtudeDetail; kind: 'plan' | 'cliche'; plan?: FlexoPiece | null }>()
const emit = defineEmits<{ close: []; saved: [result: PiecesResult, message: string]; failed: [] }>()

const planValues = reactive({ dimensions: props.plan?.dimensions ?? '', laize: props.plan?.laize ?? '', sens_der: props.plan?.sens_der ?? '' })
const clicheValues = reactive({ laize: '', nbr_couleurs: '', developpement: '', hauteur_cliche: '', site_prod: '' })
const options = ref<ClicheOptions>({ developpements: [], sites: [] })
const busy = ref(false)
const error = ref('')
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const upload = usePieceUpload(uploader, 'plan_flexo', 'Plan Flexo')

onMounted(async () => {
	if (props.kind !== 'cliche') return
	try {
		options.value = await getClicheOptions(props.etude.name)
	} catch (e) {
		error.value = (e as Error).message
	}
})
async function submit() {
	if (busy.value) return
	error.value = ''
	if (props.kind === 'plan' && !props.plan?.fichier && !upload.hasFile()) {
		error.value = 'Joignez le fichier du plan.'
		return
	}
	busy.value = true
	try {
		if (props.kind === 'plan') emit('saved', await upload.send(await savePlanFlexo(props.etude, planValues)), props.plan?.name ? 'Plan Flexo mis à jour.' : 'Plan Flexo créé et lié.')
		else emit('saved', await createCliche(props.etude, clicheValues), 'Cliché créé en brouillon et lié.')
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
	<FormDialog :title="kind === 'cliche' ? 'Créer le cliché' : plan?.name ? `Mettre à jour le plan ${plan.name}` : 'Créer le plan Flexo'" :dirty="false" hint="" :busy="busy || upload.uploading.value" @close="emit('close')" @submit="submit">
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<template v-if="kind === 'plan'">
			<div class="form-grid">
				<label class="form-field"><span class="field-label">Dimensions (mm)</span><input v-model="planValues.dimensions" class="field-input" type="text" autocomplete="off" /></label>
				<label class="form-field"><span class="field-label">Laize</span><input v-model="planValues.laize" class="field-input" type="text" autocomplete="off" /></label>
				<label class="form-field"><span class="field-label">Sens de déroulement</span><select v-model="planValues.sens_der" class="field-input"><option value="">À choisir</option><option v-for="sens in 8" :key="sens" :value="String(sens)">{{ sens }}</option></select></label>
			</div>
			<div class="form-field">
				<span class="field-label">Fichier du plan</span>
				<span v-if="plan?.fichier" class="field-note">Actuel : <a class="ref-link" :href="plan.fichier.url" target="_blank" rel="noopener noreferrer">{{ plan.fichier.name }}</a>. Il reste si vous n'en déposez pas d'autre.</span>
				<FileUploader ref="uploader" deferred :multiple="false" doctype="Plan Flexo" :docname="plan?.name ?? undefined" @change="error = ''" @uploaded="upload.onUploaded" @settled="upload.onSettled" />
			</div>
		</template>
		<template v-else>
			<div class="form-grid">
				<label class="form-field"><span class="field-label">Laize (mm)</span><input v-model="clicheValues.laize" class="field-input" type="text" autocomplete="off" /></label>
				<label class="form-field"><span class="field-label">Nombre de couleurs</span><input v-model="clicheValues.nbr_couleurs" class="field-input" type="text" autocomplete="off" /></label>
				<label class="form-field"><span class="field-label">Développement</span><select v-model="clicheValues.developpement" class="field-input"><option value="">À choisir</option><option v-for="row in options.developpements" :key="row.value" :value="row.value">{{ row.label }}</option></select></label>
				<label class="form-field"><span class="field-label">Hauteur du cliché (mm)</span><input v-model="clicheValues.hauteur_cliche" class="field-input" type="text" autocomplete="off" /></label>
				<label class="form-field"><span class="field-label">Site de production</span><select v-model="clicheValues.site_prod" class="field-input"><option value="">À choisir</option><option v-for="row in options.sites" :key="row.value" :value="row.value">{{ row.label }}</option></select></label>
			</div>
			<p class="rounded-control tone-blue px-3 py-2 text-sm">Le cliché est créé en brouillon. Son circuit de validation se poursuit sur le Desk.</p>
		</template>
		<template #actions><button type="button" class="btn-primary" :disabled="busy || upload.uploading.value" @click="submit">{{ kind === 'cliche' ? 'Créer le cliché' : plan?.name ? 'Mettre à jour' : 'Créer le plan' }}</button></template>
	</FormDialog>
</template>
