<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { searchPantone } from '@/lib/api'
import type { ArticleTeinte, PantoneMatch } from '@/lib/articles'

/** Code Pantone d'une ligne : suggestions à la frappe. Un code inconnu reste accepté, avec un carré neutre. */
const props = defineProps<{ inputId: string }>()
const line = defineModel<ArticleTeinte>({ required: true })
const emit = defineEmits<{ error: [message: string] }>()

const results = ref<PantoneMatch[]>([])
const open = ref(false)
const cursor = ref(0)
let last = 0
let timer: ReturnType<typeof setTimeout> | null = null

function apply(match: PantoneMatch | null, code: string) {
	line.value = { ...line.value, code, label: match?.label ?? code, hex: match?.hex ?? null, approximative: match?.approximative ?? 0, needs_suffix: match?.needs_suffix ?? 0 }
}

async function run(code: string) {
	const request = ++last
	try {
		const found = await searchPantone(code)
		if (request !== last) return
		results.value = found.suggestions
		cursor.value = 0
		apply(found.exact, code)
	} catch (e) {
		if (request === last) emit('error', (e as Error).message)
	}
}
function onInput(event: Event) {
	const code = (event.target as HTMLInputElement).value
	apply(null, code)
	open.value = true
	if (timer) clearTimeout(timer)
	if (code.trim()) timer = setTimeout(() => run(code), 200)
	else results.value = []
}
function pick(match?: PantoneMatch) {
	if (!match) return
	apply(match, match.code)
	open.value = false
}
function setSuffix(suffix: 'C' | 'U') {
	run(`${line.value.code.trim()} ${suffix}`)
	open.value = false
}
function onKey(event: KeyboardEvent) {
	const size = results.value.length
	if (event.key === 'Escape' && open.value) {
		event.stopPropagation()
		open.value = false
	} else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && size) {
		event.preventDefault()
		open.value = true
		cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : size - 1)) % size
	} else if (event.key === 'Enter' && open.value && size) {
		event.preventDefault()
		pick(results.value[cursor.value])
	}
}
onBeforeUnmount(() => {
	if (timer) clearTimeout(timer)
})
</script>

<template>
	<div class="color-pantone">
		<div class="relative min-w-0 flex-auto">
			<input :id="props.inputId" :value="line.code" class="field-input" placeholder="Ex. 286 C" autocomplete="off" role="combobox" aria-autocomplete="list" :aria-expanded="open && results.length > 0" aria-label="Code Pantone" @input="onInput" @keydown="onKey" @blur="open = false" />
			<div v-if="open && results.length" class="app-menu picker-menu" role="listbox" aria-label="Codes Pantone">
				<button v-for="(match, index) in results" :key="match.code" type="button" class="app-menu-item" role="option" :aria-selected="index === cursor" @mousedown.prevent @click="pick(match)" @pointerenter="cursor = index">
					<span class="color-swatch" :class="!match.hex && 'color-swatch-none'" :style="match.hex ? { background: match.hex } : undefined" aria-hidden="true"></span>
					<span class="min-w-0 flex-auto truncate">{{ match.label }}</span>
				</button>
			</div>
		</div>
		<div v-if="line.needs_suffix" class="seg flex-none" role="group" aria-label="Papier couché ou non couché">
			<button type="button" :aria-pressed="false" title="Papier couché" @click="setSuffix('C')">C</button>
			<button type="button" :aria-pressed="false" title="Papier non couché" @click="setSuffix('U')">U</button>
		</div>
	</div>
</template>
