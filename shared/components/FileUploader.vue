<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideCheck from '~icons/lucide/check'
import LucideUpload from '~icons/lucide/upload'
import LucideX from '~icons/lucide/x'
import type { UploadedFile } from '../api'
import { fileExtension, formatFileSize } from '../text'
import { useUploads, type UploadItem, type UploadTarget } from '../useUploads'

/**
 * Envoi de fichiers commun aux applications : dépôt ou choix, plusieurs à la fois, avec l'avancement de chacun.
 * Sans document (`deferred`), les fichiers attendent `start` : c'est le cas d'un document encore à créer.
 */
const props = withDefaults(
	defineProps<{
		doctype?: string
		docname?: string
		/** Affiche la zone de dépôt. Sans elle, l'envoi passe par `pick` ou `add`. */
		zone?: boolean
		multiple?: boolean
		accept?: string
		deferred?: boolean
		disabled?: boolean
		check?: (file: File) => string
	}>(),
	{ zone: true, multiple: true },
)
const emit = defineEmits<{ uploaded: [file: UploadedFile]; settled: [sent: number, failed: number]; change: [] }>()

const target = (): UploadTarget | null => (props.doctype && props.docname ? { doctype: props.doctype, docname: props.docname } : null)
const { items, maxSize, sending, percent, add, start, cancel, cancelAll, retry, retryAll, clear } = useUploads({
	target,
	auto: !props.deferred,
	check: props.check,
	onUploaded: (file) => emit('uploaded', file),
	onSettled: (sent, failed) => emit('settled', sent, failed),
})

const input = ref<HTMLInputElement | null>(null)
const over = ref(false)
function pick() {
	input.value?.click()
}
function onInput(event: Event) {
	const field = event.target as HTMLInputElement
	if (field.files?.length) addFiles(field.files)
	field.value = ''
}
function addFiles(files: FileList | File[]) {
	const list = Array.from(files)
	// Un seul fichier attendu : le nouveau remplace celui qui n'est pas encore parti.
	if (!props.multiple && !sending.value) clear()
	else if (!props.multiple && props.deferred) clear()
	add(props.multiple ? list : list.slice(0, 1))
	emit('change')
}
function onDrop(event: DragEvent) {
	over.value = false
	if (!props.disabled && event.dataTransfer?.files.length) addFiles(event.dataTransfer.files)
}
function remove(id: number) {
	cancel(id)
	emit('change')
}

const limit = computed(() => (maxSize.value ? `${formatFileSize(maxSize.value)} maximum par fichier` : ''))
const note = computed(() => [props.multiple ? 'Plusieurs fichiers à la fois' : '', limit.value].filter(Boolean).join(' · '))
const failed = computed(() => items.value.filter((item) => item.status === 'error').length)
const done = computed(() => items.value.filter((item) => item.status === 'done').length)
const refused = computed(() => items.value.filter((item) => item.status === 'refused').length)
const heading = computed(() => {
	const count = items.value.length
	const bits = [done.value ? `${done.value} ${done.value > 1 ? 'terminés' : 'terminé'}` : '', refused.value ? `${refused.value} ${refused.value > 1 ? 'refusés' : 'refusé'}` : '', failed.value ? `${failed.value} en échec` : ''].filter(Boolean)
	if (!sending.value && failed.value) return `${done.value} ${done.value > 1 ? 'fichiers' : 'fichier'} sur ${count} ${done.value > 1 ? 'envoyés' : 'envoyé'}`
	const label = sending.value ? `Envoi de ${count} ${count > 1 ? 'fichiers' : 'fichier'}` : `${count} ${count > 1 ? 'fichiers' : 'fichier'}`
	return bits.length ? `${label} : ${bits.join(', ')}` : label
})
function itemPercent(item: UploadItem) {
	return item.size ? Math.min(100, Math.round((item.loaded / item.size) * 100)) : 0
}
function meta(item: UploadItem) {
	if (item.status === 'sending') return `${formatFileSize(item.loaded)} sur ${formatFileSize(item.size)} · ${itemPercent(item)} %`
	if (item.status === 'queued') return `${formatFileSize(item.size)} · en attente`
	if (item.status === 'done') return `${formatFileSize(item.size)} · envoyé`
	return item.error
}

defineExpose({ pick, add: addFiles, start, clear, items, sending })
</script>

<template>
	<div class="uploader">
		<input ref="input" class="sr-only" type="file" tabindex="-1" aria-label="Choisir des fichiers" :multiple="multiple" :accept="accept" :disabled="disabled" @change="onInput" />
		<div v-if="zone" class="upload-zone" :data-over="over" @dragenter.prevent="over = true" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent.stop="onDrop">
			<LucideUpload class="h-5 w-5" aria-hidden="true" />
			<p><b class="font-medium text-ink-gray-9">{{ multiple ? 'Glissez vos fichiers ici' : 'Glissez votre fichier ici' }}</b> ou <button type="button" class="upload-browse" :disabled="disabled" @click="pick">parcourez</button></p>
			<p v-if="note" class="text-sm text-ink-gray-6">{{ note }}</p>
		</div>

		<section v-if="items.length" class="upload-panel" aria-label="Envoi des fichiers">
			<div class="upload-head">
				<b class="font-semibold text-ink-gray-9" role="status">{{ heading }}</b>
				<button v-if="sending && !deferred" type="button" class="btn-ghost" @click="cancelAll">Tout annuler</button>
				<button v-else-if="failed" type="button" class="btn-secondary" @click="retryAll">Réessayer</button>
			</div>
			<div v-if="sending && items.length > 1 && !deferred" class="upload-bar" role="progressbar" aria-label="Avancement total" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${percent}%` }"></span></div>
			<ul class="upload-list">
				<li v-for="item in items" :key="item.id" class="upload-item">
					<span class="upload-ext" aria-hidden="true">{{ fileExtension(item.name) }}</span>
					<span class="min-w-0">
						<span class="upload-name" :title="item.name">{{ item.name }}</span>
						<span class="upload-meta" :class="(item.status === 'error' || item.status === 'refused') && 'text-tone-red'">
							<LucideCheck v-if="item.status === 'done'" class="h-3.5 w-3.5" aria-hidden="true" />{{ meta(item) }}
						</span>
						<span v-if="item.status === 'sending'" class="upload-bar" role="progressbar" :aria-label="`Avancement de ${item.name}`" :aria-valuenow="itemPercent(item)" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${itemPercent(item)}%` }"></span></span>
					</span>
					<span class="flex flex-none items-center gap-1">
						<button v-if="item.status === 'error'" type="button" class="btn-ghost" @click="retry(item.id)">Réessayer</button>
						<button v-if="item.status !== 'done'" type="button" class="comment-tool" :aria-label="`${item.status === 'sending' ? 'Annuler' : 'Retirer'} ${item.name}`" @click="remove(item.id)"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
					</span>
				</li>
			</ul>
		</section>
	</div>
</template>
