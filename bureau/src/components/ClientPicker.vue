<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import LucideSearch from '~icons/lucide/search'
import LucideX from '~icons/lucide/x'
import { searchClients } from '@/lib/api'
import type { ClientChoice } from '@/types'

/** Choix d'un client dans une fenêtre : une seule réponse compte, celle de la dernière frappe. */
const props = defineProps<{ inputId: string; invalid?: boolean }>()
const client = defineModel<ClientChoice | null>({ required: true })
const emit = defineEmits<{ error: [message: string] }>()

const query = ref('')
const results = ref<ClientChoice[]>([])
const open = ref(false)
const searched = ref(false)
const cursor = ref(0)
const input = ref<HTMLInputElement | null>(null)
let last = 0
let timer: ReturnType<typeof setTimeout> | null = null

async function run() {
	const request = ++last
	try {
		const found = await searchClients(query.value)
		if (request !== last) return
		results.value = found
		searched.value = true
		cursor.value = 0
	} catch (e) {
		if (request === last) emit('error', (e as Error).message)
	}
}
watch(query, () => {
	if (client.value) return
	open.value = true
	if (timer) clearTimeout(timer)
	timer = setTimeout(run, 200)
})
function show() {
	open.value = true
	if (!searched.value) run()
}
function pick(choice?: ClientChoice) {
	if (!choice) return
	client.value = choice
	open.value = false
}
async function change() {
	client.value = null
	query.value = ''
	await nextTick()
	input.value?.focus()
}
function onKey(event: KeyboardEvent) {
	if (event.key === 'Escape' && open.value) {
		event.stopPropagation()
		open.value = false
		return
	}
	const size = results.value.length
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		open.value = true
		if (size) cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : size - 1)) % size
	} else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && open.value) {
		event.preventDefault()
		pick(results.value[cursor.value])
	}
}
function onBlur(event: FocusEvent) {
	if (!(event.relatedTarget as HTMLElement | null)?.closest?.('.picker-menu')) open.value = false
}
onBeforeUnmount(() => {
	if (timer) clearTimeout(timer)
})
</script>

<template>
	<div v-if="client" class="picked">
		<div class="flex min-w-0 flex-auto flex-wrap items-baseline gap-x-2">
			<strong class="font-semibold text-ink-gray-9">{{ client.label }}</strong>
			<span class="text-sm text-ink-gray-6">{{ client.name }}<template v-if="client.wilaya"> · {{ client.wilaya }}</template></span>
		</div>
		<button :id="props.inputId" type="button" class="comment-tool" aria-label="Changer de client" title="Changer de client" @click="change"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
	</div>
	<div v-else class="relative">
		<LucideSearch class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-5" aria-hidden="true" />
		<input
			:id="props.inputId"
			ref="input"
			v-model="query"
			class="field-input pl-8"
			type="search"
			placeholder="Nom, code ou wilaya"
			autocomplete="off"
			role="combobox"
			aria-autocomplete="list"
			:aria-expanded="open"
			:aria-invalid="Boolean(invalid)"
			@focus="show"
			@click="show"
			@keydown="onKey"
			@blur="onBlur"
		/>
		<div v-if="open" class="app-menu picker-menu" role="listbox" aria-label="Clients">
			<button v-for="(choice, index) in results" :key="choice.name" type="button" class="app-menu-item" role="option" :aria-selected="index === cursor" @mousedown.prevent @click="pick(choice)" @pointerenter="cursor = index">
				<span class="min-w-0 flex-auto truncate">{{ choice.label }}</span>
				<span class="text-xs text-ink-gray-6">{{ choice.wilaya ? `${choice.wilaya} · ` : '' }}{{ choice.name }}</span>
			</button>
			<p v-if="searched && !results.length" class="app-menu-title">Aucun client ne correspond.</p>
			<p v-else-if="!searched" class="app-menu-title">Recherche…</p>
		</div>
	</div>
</template>
