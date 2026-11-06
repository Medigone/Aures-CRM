<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { searchFilterLink } from '@/lib/api'
import type { Option } from '@/types'

/** Valeur d'un champ lien : la saisie reste libre, et les valeurs du doctype lié sont proposées au fil de la frappe. */
const props = defineProps<{ modelValue: string; listDoctype: string; doctype: string; field: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const choices = ref<Option[]>([])
const open = ref(false)
const cursor = ref(-1)
let last = 0
let timer: ReturnType<typeof setTimeout> | null = null

async function search(text: string) {
	const request = ++last
	try {
		const found = await searchFilterLink(props.listDoctype, props.doctype, props.field, text)
		if (request === last) choices.value = found
	} catch {
		// La saisie libre reste possible sans propositions.
		if (request === last) choices.value = []
	}
}
function searchSoon(text: string) {
	if (timer) clearTimeout(timer)
	timer = setTimeout(() => search(text), 200)
}
function onInput(event: Event) {
	const text = (event.target as HTMLInputElement).value
	emit('update:modelValue', text)
	open.value = true
	cursor.value = -1
	searchSoon(text)
}
function onFocus() {
	open.value = true
	cursor.value = -1
	search(props.modelValue)
}
function choose(option: Option) {
	emit('update:modelValue', option.value)
	open.value = false
}
function onKeydown(event: KeyboardEvent) {
	if (!open.value) return
	if (event.key === 'Escape') {
		event.preventDefault()
		event.stopPropagation()
		open.value = false
	} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		const count = choices.value.length
		if (count) cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : count - 1) + (cursor.value < 0 && event.key === 'ArrowUp' ? 1 : 0)) % count
	} else if (event.key === 'Enter' && choices.value[cursor.value]) {
		event.preventDefault()
		choose(choices.value[cursor.value])
	}
}
onBeforeUnmount(() => {
	if (timer) clearTimeout(timer)
	last++
})
</script>

<template>
	<div class="min-w-0">
		<input class="field-input" type="text" role="combobox" autocomplete="off" aria-label="Valeur" aria-autocomplete="list" placeholder="Chercher…" :aria-expanded="open" :value="modelValue" @focus="onFocus" @input="onInput" @keydown="onKeydown" @blur="open = false" />
		<div v-if="open && choices.length" class="filter-field-list" role="listbox" aria-label="Valeurs">
			<button v-for="(option, position) in choices" :key="option.value" type="button" tabindex="-1" class="filter-field-option" role="option" :aria-selected="position === cursor" @pointerdown.prevent="choose(option)">
				<span class="truncate" :title="option.label">{{ option.label }}</span>
				<span v-if="option.label !== option.value" class="filter-field-hint truncate">{{ option.value }}</span>
			</button>
		</div>
	</div>
</template>
