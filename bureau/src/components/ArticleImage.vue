<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import LucidePencil from '~icons/lucide/pencil'
import LucidePlus from '~icons/lucide/plus'
import LucideX from '~icons/lucide/x'
import FormDialog from '@shared/components/FormDialog.vue'
import { formatFileSize, fileUrl } from '@shared/text'
import { useUploads } from '@shared/useUploads'
import { setArticleFile } from '@/lib/api'
import { isImageFile, type ArticleDetail } from '@/lib/articles'

/** Visuel de l'article : l'ancienne image reste visible pendant l'envoi, et un refus ne la perd pas. */
const props = defineProps<{ article: ArticleDetail; busy: boolean; perform: (action: () => Promise<ArticleDetail>) => Promise<boolean> }>()

const message = ref('')
const { items, add, cancel } = useUploads({
	target: () => ({ doctype: 'Item', docname: props.article.name }),
	check: (file) => (file.type.startsWith('image/') ? '' : "Ce fichier n'est pas une image. L'image actuelle est conservée."),
	onUploaded: async (uploaded) => {
		await props.perform(() => setArticleFile(props.article, 'image', uploaded.file_url))
	},
	onSettled: (_sent, failed) => {
		if (failed) showFailure()
	},
})
const sending = computed(() => items.value.find((item) => item.status === 'sending' || item.status === 'queued'))
const percent = computed(() => (sending.value?.size ? Math.min(100, Math.round((sending.value.loaded / sending.value.size) * 100)) : 0))

function showFailure() {
	const failure = items.value.find((item) => item.status === 'error' || item.status === 'refused')
	if (!failure) return
	message.value = failure.error
	items.value = items.value.filter((item) => item.id !== failure.id)
}
function send(files: FileList | File[]) {
	message.value = ''
	add(Array.from(files).slice(0, 1))
	showFailure()
}

const input = ref<HTMLInputElement | null>(null)
function onInput(event: Event) {
	const field = event.target as HTMLInputElement
	if (field.files?.length) send(field.files)
	field.value = ''
}
const over = ref(false)
function onDrop(event: DragEvent) {
	over.value = false
	if (props.article.can_edit && event.dataTransfer?.files.length) send(event.dataTransfer.files)
}

const menu = ref(false)
const root = ref<HTMLElement | null>(null)
function onPointerDown(event: PointerEvent) {
	if (menu.value && !root.value?.contains(event.target as Node)) menu.value = false
}
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') menu.value = false
}
onMounted(() => {
	document.addEventListener('pointerdown', onPointerDown)
	document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onPointerDown)
	document.removeEventListener('keydown', onKeydown)
})

const images = computed(() => props.article.documents.filter((row) => isImageFile(row.file_name) && row.file_url !== props.article.fichiers.image))
const choosing = ref(false)
function choose(url: string) {
	choosing.value = false
	message.value = ''
	props.perform(() => setArticleFile(props.article, 'image', url))
}
function clear() {
	if (window.confirm("Retirer l'image de cet article ? Le fichier reste dans Documents.")) props.perform(() => setArticleFile(props.article, 'image', ''))
}
</script>

<template>
	<div ref="root" class="article-visual" :data-over="over" @dragenter.prevent="over = article.can_edit" @dragover.prevent="over = article.can_edit" @dragleave="over = false" @drop.prevent.stop="onDrop">
		<img v-if="article.image" :src="fileUrl(article.image) || undefined" alt="Visuel de l'article" />
		<svg v-else class="dieline" viewBox="0 0 120 84" aria-hidden="true"><path class="cut" d="M8 24 L8 60 L20 60 L24 76 L52 76 L56 60 L92 60 L96 76 L108 76 L112 60 L112 24 L108 8 L96 8 L92 24 L56 24 L52 8 L24 8 L20 24 Z" /><path class="fold" d="M20 24 L20 60 M56 24 L56 60 M92 24 L92 60 M20 24 L56 24 M92 24 L112 24 M20 60 L56 60 M92 60 L112 60" /></svg>

		<div v-if="sending" class="article-visual-progress">
			<div class="flex items-center justify-between gap-2">
				<span class="truncate">{{ sending.name }} · {{ percent }} %</span>
				<button type="button" class="comment-tool" aria-label="Annuler l'envoi" @click="cancel(sending.id)"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
			</div>
			<span class="upload-bar" role="progressbar" aria-label="Avancement de l'image" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100"><span :style="{ width: `${percent}%` }"></span></span>
		</div>

		<template v-else-if="article.can_edit">
			<input ref="input" class="sr-only" type="file" accept="image/*" tabindex="-1" aria-label="Choisir une image" @change="onInput" />
			<button v-if="article.own_image || images.length" type="button" class="article-visual-change" aria-haspopup="menu" :aria-expanded="menu" :disabled="busy" @click="menu = !menu">
				<LucidePencil v-if="article.own_image" class="h-3.5 w-3.5" aria-hidden="true" /><LucidePlus v-else class="h-3.5 w-3.5" aria-hidden="true" />
				{{ article.own_image ? "Changer l'image" : 'Ajouter une image' }}
			</button>
			<button v-else type="button" class="article-visual-change" :disabled="busy" @click="input?.click()"><LucidePlus class="h-3.5 w-3.5" aria-hidden="true" />Ajouter une image</button>
			<div v-if="menu" class="app-menu article-visual-menu" role="menu" @click="menu = false">
				<button type="button" class="app-menu-item" role="menuitem" @click="input?.click()">Importer une image</button>
				<button v-if="images.length" type="button" class="app-menu-item" role="menuitem" @click="choosing = true">Choisir dans les documents</button>
				<a v-if="article.own_image" class="app-menu-item" role="menuitem" :href="fileUrl(article.image) || undefined" target="_blank" rel="noopener noreferrer">Voir en grand</a>
				<template v-if="article.own_image">
					<div class="app-menu-sep"></div>
					<button type="button" class="app-menu-item text-tone-red" role="menuitem" @click="clear">Retirer l'image</button>
				</template>
			</div>
		</template>
	</div>
	<p v-if="message" role="alert" class="px-3.5 py-2 text-sm text-tone-red">{{ message }}</p>

	<FormDialog v-if="choosing" title="Choisir une image" :dirty="false" hint="Parmi les images jointes à cet article" @close="choosing = false" @submit="choosing = false">
		<ul class="pp-rows">
			<li v-for="row in images" :key="row.file_url">
				<button type="button" class="pp-row pp-row-plain" @click="choose(row.file_url)">
					<img class="pp-thumb-small" :src="fileUrl(row.file_url) || undefined" alt="" loading="lazy" />
					<span class="min-w-0"><span class="pp-row-title">{{ row.file_name }}</span><span class="pp-row-sub">{{ formatFileSize(row.file_size) }} · {{ row.owner_name }}</span></span>
				</button>
			</li>
		</ul>
	</FormDialog>
</template>
