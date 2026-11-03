<script setup lang="ts">
import { ref } from 'vue'
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
	<div>
		<span class="field-label">Pièces jointes</span>
		<div class="flex gap-2">
			<label class="btn-secondary flex-1 cursor-pointer">
				<LucideCamera class="h-4 w-4" aria-hidden="true" />Photo
				<input type="file" accept="image/*" capture="environment" class="sr-only" @change="add" />
			</label>
			<label class="btn-secondary flex-1 cursor-pointer">
				<LucidePaperclip class="h-4 w-4" aria-hidden="true" />Fichier
				<input type="file" accept="image/*,application/pdf" multiple class="sr-only" @change="add" />
			</label>
		</div>
		<p v-if="error" class="mt-1 text-xs text-ink-red-3">{{ error }}</p>
		<div v-if="model.length" class="mt-2 grid grid-cols-3 gap-2">
			<div v-for="(a, i) in model" :key="i" class="relative overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white">
				<img v-if="a.data.startsWith('data:image')" :src="a.data" :alt="a.filename" class="h-24 w-full object-cover" />
				<div v-else class="flex h-24 items-center justify-center p-2 text-center text-xs text-ink-gray-7">{{ a.filename }}</div>
				<button type="button" class="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" :aria-label="`Retirer ${a.filename}`" @click="remove(i)">
					<LucideX class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>
</template>
