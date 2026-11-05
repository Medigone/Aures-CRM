<script setup lang="ts">
import { ref, watch } from 'vue'
import LucideSearch from '~icons/lucide/search'
import LucideX from '~icons/lucide/x'
import { searchBulkLink } from '@/lib/api'
import type { Option } from '@/types'

/** Valeur d'un champ lien, cherchée sur le serveur avec les droits de la personne. */
const props = defineProps<{ doctype: string; fieldname: string; modelValue: string; inputId: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const query = ref('')
const label = ref('')
const choices = ref<Option[]>([])
const open = ref(false)
const searched = ref(false)
const cursor = ref(0)
const error = ref('')
let last = 0
let timer: ReturnType<typeof setTimeout> | null = null

// Une seule réponse compte, celle de la dernière frappe.
async function search() {
	const request = ++last
	try {
		const found = await searchBulkLink(props.doctype, props.fieldname, query.value)
		if (request !== last) return
		choices.value = found
		searched.value = true
		error.value = ''
		cursor.value = 0
	} catch (e) {
		if (request === last) error.value = (e as Error).message
	}
}
watch(query, () => {
	open.value = true
	if (timer) clearTimeout(timer)
	timer = setTimeout(search, 200)
})
function show() {
	open.value = true
	if (!searched.value) search()
}
function pick(choice: Option) {
	label.value = choice.label
	emit('update:modelValue', choice.value)
	open.value = false
}
function change() {
	emit('update:modelValue', '')
	query.value = ''
	searched.value = false
}
function onKey(event: KeyboardEvent) {
	if (event.key === 'Escape' && open.value) {
		event.stopPropagation()
		open.value = false
	} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		const count = choices.value.length
		if (count) cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : count - 1)) % count
		open.value = true
	} else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey) {
		event.preventDefault()
		const choice = choices.value[cursor.value]
		if (open.value && choice) pick(choice)
	}
}
</script>

<template>
	<div v-if="modelValue" class="picked">
		<strong class="min-w-0 flex-auto truncate font-semibold text-ink-gray-9">{{ label || modelValue }}</strong>
		<button :id="inputId" type="button" class="comment-tool" aria-label="Changer de valeur" title="Changer de valeur" @click="change"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
	</div>
	<div v-else class="relative">
		<LucideSearch class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-5" aria-hidden="true" />
		<input :id="inputId" v-model="query" class="field-input pl-8" type="search" placeholder="Rechercher" autocomplete="off" role="combobox" aria-autocomplete="list" :aria-expanded="open" @focus="show" @click="show" @keydown="onKey" @blur="open = false" />
		<div v-if="open" class="app-menu picker-menu" role="listbox" aria-label="Valeurs possibles">
			<button v-for="(choice, index) in choices" :key="choice.value" type="button" class="app-menu-item" role="option" :aria-selected="index === cursor" @mousedown.prevent @click="pick(choice)" @pointerenter="cursor = index">
				<span class="min-w-0 flex-auto truncate">{{ choice.label }}</span>
			</button>
			<p v-if="error" class="app-menu-title" role="alert">{{ error }}</p>
			<p v-else-if="searched && !choices.length" class="app-menu-title">Aucune valeur ne correspond.</p>
			<p v-else-if="!searched" class="app-menu-title">Recherche…</p>
		</div>
	</div>
</template>
