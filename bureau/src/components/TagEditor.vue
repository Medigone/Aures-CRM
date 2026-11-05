<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import LucidePlus from '~icons/lucide/plus'
import LucideX from '~icons/lucide/x'
import { addDocTag, getBulkTags, removeDocTag } from '@/lib/api'

/** Tags du tiroir et de la fiche : retrait d'un clic, ajout avec les tags existants proposés. */
const props = defineProps<{ doctype: string; name: string; modified: string; tags?: string[]; canEdit: boolean }>()
const emit = defineEmits<{ changed: [tags: string[]] }>()

const current = computed(() => props.tags ?? [])
const adding = ref(false)
const text = ref('')
const found = ref<string[]>([])
const cursor = ref(0)
const busy = ref(false)
const error = ref('')
const input = ref<HTMLInputElement | null>(null)
let last = 0
let timer: ReturnType<typeof setTimeout> | null = null

// Une virgule sépare les tags dans la colonne `_user_tags` : elle ne peut pas en faire partie.
const typed = computed(() => text.value.replace(/,/g, ' ').trim())
const choices = computed(() => {
	const known = found.value.filter((tag) => !current.value.includes(tag))
	const isNew = typed.value && !found.value.includes(typed.value) && !current.value.includes(typed.value)
	return [...known.map((tag) => ({ tag, label: tag })), ...(isNew ? [{ tag: typed.value, label: `Créer « ${typed.value} »` }] : [])]
})

async function search() {
	const request = ++last
	try {
		const tags = (await getBulkTags(typed.value)) ?? []
		if (request === last) found.value = tags
	} catch {
		// Sans propositions, la saisie libre reste possible.
		if (request === last) found.value = []
	}
	cursor.value = 0
}
watch(text, () => {
	if (timer) clearTimeout(timer)
	timer = setTimeout(search, 200)
})
async function open() {
	adding.value = true
	error.value = ''
	text.value = ''
	await search()
	await nextTick()
	input.value?.focus()
}
async function run(action: () => Promise<{ tags: string[] }>) {
	if (busy.value) return
	busy.value = true
	error.value = ''
	try {
		emit('changed', (await action()).tags)
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
const row = () => ({ name: props.name, modified: props.modified })
async function add(tag: string) {
	await run(() => addDocTag(props.doctype, row(), tag))
	text.value = ''
	await nextTick()
	input.value?.focus()
}
function remove(tag: string) {
	run(() => removeDocTag(props.doctype, row(), tag))
}
function onKey(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		event.stopPropagation()
		adding.value = false
	} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		const count = choices.value.length
		if (count) cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : count - 1)) % count
	} else if (event.key === 'Enter') {
		event.preventDefault()
		const choice = choices.value[cursor.value]
		if (choice) add(choice.tag)
	}
}
onBeforeUnmount(() => {
	if (timer) clearTimeout(timer)
})
</script>

<template>
	<div v-if="current.length || canEdit" class="flex flex-col gap-1">
		<div class="tag-row" role="group" aria-label="Tags">
			<span v-for="tag in current" :key="tag" class="tag-pill" :title="tag">
				<span>{{ tag }}</span>
				<button v-if="canEdit" type="button" class="tag-x" :aria-label="`Retirer le tag ${tag}`" :disabled="busy" @click="remove(tag)"><LucideX class="h-2.5 w-2.5" aria-hidden="true" /></button>
			</span>
			<div v-if="adding" class="tag-edit">
				<input ref="input" v-model="text" type="text" aria-label="Nouveau tag" autocomplete="off" role="combobox" aria-autocomplete="list" :aria-expanded="Boolean(choices.length)" :disabled="busy" @keydown="onKey" @blur="adding = false" />
				<div v-if="choices.length" class="app-menu picker-menu" role="listbox" aria-label="Tags existants">
					<button v-for="(choice, index) in choices" :key="choice.tag" type="button" class="app-menu-item" role="option" :aria-selected="index === cursor" @mousedown.prevent @click="add(choice.tag)" @pointerenter="cursor = index">
						<span class="min-w-0 flex-auto truncate">{{ choice.label }}</span>
					</button>
				</div>
			</div>
			<button v-else-if="canEdit" type="button" class="tag-add" @click="open"><LucidePlus class="h-3 w-3" aria-hidden="true" />Ajouter un tag</button>
		</div>
		<p v-if="error" role="alert" class="text-sm text-tone-red">{{ error }}</p>
	</div>
</template>
