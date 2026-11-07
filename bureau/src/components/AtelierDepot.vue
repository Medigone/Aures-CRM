<script setup lang="ts">
import { ref } from 'vue'
import type { UploadedFile } from '@shared/api'
import FileUploader from '@shared/components/FileUploader.vue'
import { batFileCheck } from '@/lib/batImport'

/** Déposer un PDF de tracé : il s'envoie seul, sans document, et le calcul qui suit se l'attache. */
defineProps<{ note: string }>()
const emit = defineEmits<{ uploaded: [url: string] }>()
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
function send() {
	uploader.value?.start({ doctype: '', docname: '' })
}
function onUploaded(file: UploadedFile) {
	emit('uploaded', file.file_url)
}
</script>

<template>
	<div class="atelier-depot">
		<p class="m-0">L'atelier lit un PDF de tracé Esko : noir pour la coupe, rouge pour le rainage.</p>
		<FileUploader ref="uploader" deferred :multiple="false" accept=".pdf,application/pdf" :check="batFileCheck" @change="send" @uploaded="onUploaded" />
		<p class="m-0 text-sm text-ink-gray-6">{{ note }}</p>
	</div>
</template>
