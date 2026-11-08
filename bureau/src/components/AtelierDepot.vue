<script setup lang="ts">
import { ref } from 'vue'
import type { UploadedFile } from '@shared/api'
import FileUploader from '@shared/components/FileUploader.vue'
import AtelierGabarit from './AtelierGabarit.vue'
import { batFileCheck } from '@/lib/batImport'

/** Déposer un PDF de tracé, ou partir d'un gabarit standard tiré des cotes. Le calcul qui suit s'attache le fichier. */
defineProps<{ note: string; cotations?: string | null; support?: string | null }>()
const emit = defineEmits<{ uploaded: [url: string] }>()
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const mode = ref<'pdf' | 'cotes'>('pdf')
function send() {
	uploader.value?.start({ doctype: '', docname: '' })
}
function onUploaded(file: UploadedFile) {
	emit('uploaded', file.file_url)
}
</script>

<template>
	<div class="atelier-depot">
		<div class="atelier-depot-tabs" role="tablist" aria-label="Source du tracé">
			<button type="button" role="tab" class="atelier-tab" :aria-selected="mode === 'pdf'" :aria-pressed="mode === 'pdf'" @click="mode = 'pdf'">Déposer un PDF</button>
			<button type="button" role="tab" class="atelier-tab" :aria-selected="mode === 'cotes'" :aria-pressed="mode === 'cotes'" @click="mode = 'cotes'">À partir des cotes</button>
		</div>
		<template v-if="mode === 'pdf'">
			<p class="m-0">L'atelier lit un PDF de tracé Esko : noir pour la coupe, rouge pour le rainage.</p>
			<FileUploader ref="uploader" deferred :multiple="false" accept=".pdf,application/pdf" :check="batFileCheck" @change="send" @uploaded="onUploaded" />
		</template>
		<AtelierGabarit v-else :cotations="cotations" :support="support" @uploaded="emit('uploaded', $event)" />
		<p class="m-0 text-sm text-ink-gray-6">{{ note }}</p>
	</div>
</template>
