<script setup lang="ts">
import { reactive, ref } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { exportAtelier } from '@/lib/api'
import { downloadFile, sheetLabel, type Scenario } from '@/lib/atelier'

/** Télécharger des feuilles : le PDF à l'échelle ou le CFF2 pour ArtiosCAD. */
const props = defineProps<{ calcul: string; sheets: Scenario[]; current: Scenario | null }>()
const emit = defineEmits<{ close: [] }>()
const checked = reactive(props.sheets.map((row) => row === props.current))
const format = ref<'pdf' | 'cff2'>('pdf')
const busy = ref(false)
const error = ref('')
// Le lien reste à l'écran si le navigateur retient le téléchargement.
const ready = ref<{ file_url: string; file_name: string } | null>(null)
async function submit() {
	const scenarios = props.sheets.filter((_row, index) => checked[index])
	if (!scenarios.length) {
		error.value = 'Cochez au moins une feuille.'
		return
	}
	busy.value = true
	error.value = ''
	try {
		const file = await exportAtelier(props.calcul, scenarios, format.value)
		ready.value = file
		downloadFile(file.file_url, file.file_name)
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog title="Télécharger des feuilles" :dirty="false" hint="" :busy="busy" @close="emit('close')" @submit="submit">
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<p v-if="ready" role="status" class="rounded-control tone-green px-3 py-2 text-sm">Fichier prêt : <a class="font-semibold underline" :href="ready.file_url" :download="ready.file_name">{{ ready.file_name }}</a>. Le téléchargement a démarré. Sinon, cliquez sur son nom.</p>
		<label v-for="(row, index) in sheets" :key="index" class="atelier-check"><input v-model="checked[index]" type="checkbox" /><span>{{ row.libelle }}<small>{{ sheetLabel(row) }}, {{ row.n_col }} × {{ row.n_rang }}</small></span></label>
		<label class="form-field"><span class="field-label">Format</span><select v-model="format" class="field-input" @change="ready = null"><option value="pdf">PDF à l'échelle</option><option value="cff2">CFF2 ArtiosCAD</option></select></label>
		<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="submit">{{ busy ? 'Préparation du fichier…' : ready ? 'Télécharger à nouveau' : 'Télécharger' }}</button></template>
	</FormDialog>
</template>
