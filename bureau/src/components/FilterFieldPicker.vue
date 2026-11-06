<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideSearch from '~icons/lucide/search'
import { COMMON_GROUP, groupFields, searchFields, type FilterField } from '@/lib/filters'

/** Choix du champ d'un filtre : un doctype en compte plus de cent, on les cherche par leur nom. */
const props = defineProps<{ modelValue: string; fields: FilterField[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const query = ref('')
const cursor = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const current = computed(() => props.fields.find((field) => field.value === props.modelValue)?.label ?? props.modelValue)
const found = computed(() => searchFields(props.fields, query.value))
// En recherche, la liste suit la pertinence : la rubrique passe à côté du nom.
const searching = computed(() => Boolean(query.value.trim()))
const groups = computed(() => (searching.value ? [{ label: '', fields: found.value }] : groupFields(found.value)))

async function show() {
	open.value = true
	query.value = ''
	cursor.value = Math.max(found.value.findIndex((field) => field.value === props.modelValue), 0)
	await nextTick()
	input.value?.focus()
	reveal()
}
function reveal() {
	list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
}
function choose(field: FilterField) {
	open.value = false
	if (field.value !== props.modelValue) emit('update:modelValue', field.value)
}
function onInput() {
	cursor.value = 0
}
async function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.preventDefault()
		event.stopPropagation()
		open.value = false
	} else if (event.key === 'Enter') {
		event.preventDefault()
		const field = found.value[cursor.value]
		if (field) choose(field)
	} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		const count = found.value.length
		if (!count) return
		cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : count - 1)) % count
		await nextTick()
		reveal()
	}
}
</script>

<template>
	<div class="filter-field min-w-0 flex-1">
		<button v-if="!open" type="button" class="field-input filter-field-button" aria-label="Champ du filtre" aria-haspopup="listbox" @click="show">
			<span class="truncate">{{ current }}</span>
			<LucideChevronDown class="h-3.5 w-3.5 flex-none text-ink-gray-6" aria-hidden="true" />
		</button>
		<template v-else>
			<label class="filter-field-search field-input">
				<LucideSearch class="h-3.5 w-3.5 flex-none text-ink-gray-6" aria-hidden="true" />
				<input ref="input" v-model="query" type="text" role="combobox" aria-expanded="true" aria-label="Chercher un champ" placeholder="Chercher un champ" autocomplete="off" @input="onInput" @keydown="onKeydown" @blur="open = false" />
			</label>
			<div ref="list" class="filter-field-list" role="listbox" aria-label="Champs">
				<p v-if="!found.length" class="filter-field-empty">Aucun champ ne porte ce nom.</p>
				<template v-for="(group, position) in groups" :key="position">
					<p v-if="group.label" class="filter-field-group">{{ group.label }}</p>
					<button v-for="field in group.fields" :key="field.value" type="button" tabindex="-1" class="filter-field-option" role="option" :aria-selected="found[cursor]?.value === field.value" @pointerdown.prevent="choose(field)">
						{{ field.label }}
						<span v-if="searching" class="filter-field-hint">{{ field.group ?? COMMON_GROUP }}</span>
					</button>
				</template>
			</div>
		</template>
	</div>
</template>
