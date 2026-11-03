<script setup lang="ts">
import { computed, ref } from 'vue'
import LucideCamera from '~icons/lucide/camera'
import LucidePaperclip from '~icons/lucide/paperclip'
import LucideX from '~icons/lucide/x'
import { compressPhoto } from '@/lib/photo'
import type { Attachment } from '@/types'

/** Photos (réduites) et documents joints à une saisie ; partent avec elle dans la file d'envoi. */
const model = defineModel<Attachment[]>({ required: true })
const props = withDefaults(defineProps<{ max?: number }>(), { max: 6 })
const MAX_BYTES = 5 * 1024 * 1024
const error = ref<string | null>(null)
const camera = ref<HTMLInputElement | null>(null)

/** Taille approximative d'une data URL (base64 : 3 octets pour 4 caractères). */
const sizeOf = (a: Attachment) => Math.round(((a.data.length - a.data.indexOf(',') - 1) * 3) / 4)
const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`)
const total = computed(() => model.value.reduce((sum, a) => sum + sizeOf(a), 0))
const extension = (a: Attachment) => (a.filename.split('.').pop() || 'fichier').toUpperCase().slice(0, 4)
defineExpose({ openCamera: () => camera.value?.click() })

function readAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result))
		reader.onerror = () => reject(new Error('Fichier illisible.'))
		reader.readAsDataURL(file)
	})
}

async function add(event: Event) {
	const input = event.target as HTMLInputElement
	error.value = null
	for (const file of Array.from(input.files || [])) {
		if (model.value.length >= props.max) {
			error.value = `${props.max} pièces jointes au plus.`
			break
		}
		try {
			if (file.type.startsWith('image/')) model.value = [...model.value, await compressPhoto(file)]
			else if (file.size > MAX_BYTES) error.value = `${file.name} dépasse 5 Mo.`
			else model.value = [...model.value, { filename: file.name, data: await readAsDataUrl(file) }]
		} catch (e) {
			error.value = (e as Error).message
		}
	}
	input.value = ''
}

function remove(index: number) {
	model.value = model.value.filter((_, i) => i !== index)
}
</script>

<template>
	<section class="space-y-2.5">
		<div class="flex items-baseline justify-between">
			<h2 class="text-[15px] font-semibold">Pièces jointes</h2>
			<span v-if="model.length" class="text-sm text-ink-gray-6">{{ model.length }} fichier{{ model.length > 1 ? 's' : '' }} · {{ formatSize(total) }}</span>
		</div>
		<div v-if="model.length" class="grid grid-cols-3 gap-2.5">
			<div v-for="(a, i) in model" :key="i" class="relative aspect-square overflow-hidden rounded-2xl bg-surface-white dark:bg-surface-cards">
				<img v-if="a.data.startsWith('data:image')" :src="a.data" :alt="a.filename" class="h-full w-full object-cover" />
				<div v-else class="flex h-full flex-col justify-between p-2.5">
					<span class="self-start rounded-md bg-surface-red-2 px-1.5 py-0.5 text-[11px] font-bold text-ink-red-3">{{ extension(a) }}</span>
					<span class="min-w-0">
						<span class="block truncate text-xs font-semibold">{{ a.filename }}</span>
						<span class="text-[11px] text-ink-gray-6">{{ formatSize(sizeOf(a)) }}</span>
					</span>
				</div>
				<button type="button" class="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white" :aria-label="`Retirer ${a.filename}`" @click="remove(i)">
					<LucideX class="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-2.5">
			<label class="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-outline-gray-4 text-sm font-semibold active:bg-surface-gray-2">
				<LucideCamera class="h-5 w-5" aria-hidden="true" />Photo
				<input ref="camera" type="file" accept="image/*" capture="environment" class="sr-only" @change="add" />
			</label>
			<label class="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-outline-gray-4 text-sm font-semibold active:bg-surface-gray-2">
				<LucidePaperclip class="h-5 w-5" aria-hidden="true" />Fichier
				<input type="file" accept="image/*,application/pdf" multiple class="sr-only" @change="add" />
			</label>
		</div>
		<p v-if="error" class="text-xs text-ink-red-3">{{ error }}</p>
	</section>
</template>
