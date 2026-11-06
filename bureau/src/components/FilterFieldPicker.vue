<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import LucideChevronDown from '~icons/lucide/chevron-down'
import { fieldTitle, searchFields, type FilterField } from '@/lib/filters'

/** Choix du champ d'un filtre : on tape dans le champ, la liste se réduit à chaque lettre. Elle montre dix lignes, par ordre alphabétique. */
const props = defineProps<{ modelValue: string; fields: FilterField[]; autofocus?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const query = ref('')
const cursor = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const current = computed(() => {
	const field = props.fields.find((item) => item.value === props.modelValue)
	return field ? fieldTitle(field) : props.modelValue
})
const found = computed(() => searchFields(props.fields, query.value))

function reveal() {
	list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
}
async function show() {
	if (open.value) return
	open.value = true
	query.value = ''
	cursor.value = 0
	await nextTick()
	list.value?.scrollTo?.({ top: 0 })
}
function hide() {
	open.value = false
	query.value = ''
}
function choose(field: FilterField) {
	hide()
	input.value?.blur()
	if (field.value !== props.modelValue) emit('update:modelValue', field.value)
}
function onInput(event: Event) {
	query.value = (event.target as HTMLInputElement).value
	open.value = true
	cursor.value = 0
	list.value?.scrollTo?.({ top: 0 })
}
async function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		if (!open.value) return
		event.preventDefault()
		event.stopPropagation()
		hide()
	} else if (event.key === 'Enter') {
		if (!open.value) return
		event.preventDefault()
		const field = found.value[cursor.value]
		if (field) choose(field)
	} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		if (!open.value) return show()
		const count = found.value.length
		if (!count) return
		cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : count - 1)) % count
		await nextTick()
		reveal()
	}
}
onMounted(() => {
	if (props.autofocus) input.value?.focus()
})
</script>

<template>
	<div class="filter-field min-w-0 flex-1">
		<div class="filter-field-box">
			<input
				ref="input"
				class="field-input"
				type="text"
				role="combobox"
				autocomplete="off"
				aria-label="Champ du filtre"
				aria-autocomplete="list"
				:aria-expanded="open"
				:value="open ? query : current"
				:placeholder="open ? current : 'Chercher un champ'"
				@focus="show"
				@click="show"
				@input="onInput"
				@keydown="onKeydown"
				@blur="hide"
			/>
			<LucideChevronDown class="filter-field-chevron h-3.5 w-3.5 text-ink-gray-6" aria-hidden="true" />
		</div>
		<div v-if="open" ref="list" class="filter-field-list" role="listbox" aria-label="Champs">
			<p v-if="!found.length" class="filter-field-empty">Aucun champ ne porte ce nom.</p>
			<button v-for="(field, position) in found" :key="field.value" type="button" tabindex="-1" class="filter-field-option" role="option" :aria-selected="position === cursor" @pointerdown.prevent="choose(field)">
				<span class="truncate" :title="field.label">{{ field.label }}</span>
				<span v-if="field.group" class="filter-field-hint truncate">{{ field.group }}</span>
			</button>
		</div>
	</div>
</template>
