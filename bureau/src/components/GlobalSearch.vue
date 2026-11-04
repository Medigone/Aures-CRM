<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideSearch from '~icons/lucide/search'
import TicketStatus from './TicketStatus.vue'
import { getQueue } from '@/lib/api'
import type { QueueTicket } from '@/types'

/** Recherche de la barre du haut : tous les tickets, ouverts ou clos, quelle que soit la vue affichée. */
const emit = defineEmits<{ open: [name: string] }>()
const MAX_RESULTS = 8

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const open = ref(false)
const loading = ref(false)
const error = ref('')
const results = ref<QueueTicket[]>([])
const cursor = ref(0)
const hasQuery = computed(() => query.value.trim().length > 0)

// Une seule réponse compte : celle de la dernière frappe.
let lastRequest = 0
let timer: ReturnType<typeof setTimeout> | null = null
async function run() {
	const request = ++lastRequest
	loading.value = true
	error.value = ''
	try {
		const [active, closed] = await Promise.all([getQueue('todo', [], query.value, { pageLength: MAX_RESULTS }), getQueue('closed', [], query.value, { pageLength: MAX_RESULTS })])
		if (request !== lastRequest) return
		const seen = new Set<string>()
		results.value = [...active.tickets, ...closed.tickets].filter((ticket) => !seen.has(ticket.name) && seen.add(ticket.name)).slice(0, MAX_RESULTS)
		cursor.value = 0
	} catch (e) {
		if (request === lastRequest) error.value = (e as Error).message
	} finally {
		if (request === lastRequest) loading.value = false
	}
}
watch(query, () => {
	if (timer) clearTimeout(timer)
	open.value = hasQuery.value
	if (!hasQuery.value) {
		lastRequest++
		results.value = []
		loading.value = false
		return
	}
	loading.value = true
	timer = setTimeout(run, 250)
})

function choose(ticket?: QueueTicket) {
	if (!ticket) return
	query.value = ''
	open.value = false
	input.value?.blur()
	emit('open', ticket.name)
}
function onInputKey(event: KeyboardEvent) {
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		const size = results.value.length
		if (size) cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : size - 1)) % size
	} else if (event.key === 'Enter') {
		choose(results.value[cursor.value])
	} else if (event.key === 'Escape') {
		query.value = ''
		input.value?.blur()
	}
}
function onShortcut(event: KeyboardEvent) {
	if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
		event.preventDefault()
		input.value?.focus()
	}
}
function onPointerDown(event: PointerEvent) {
	if (!root.value?.contains(event.target as Node)) open.value = false
}
onMounted(() => {
	window.addEventListener('keydown', onShortcut)
	document.addEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => {
	window.removeEventListener('keydown', onShortcut)
	document.removeEventListener('pointerdown', onPointerDown)
	if (timer) clearTimeout(timer)
})
</script>

<template>
	<div ref="root" class="global-search">
		<label class="relative block">
			<LucideSearch class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-5" aria-hidden="true" />
			<input ref="input" v-model="query" class="field-input pl-8" type="search" placeholder="Rechercher un ticket" aria-label="Rechercher un ticket, ouvert ou clos, par client ou numéro" @focus="open = hasQuery" @keydown="onInputKey" />
			<kbd v-if="!query">Ctrl K</kbd>
		</label>
		<div v-if="open" class="app-menu global-search-results" role="listbox" aria-label="Tickets trouvés">
			<p v-if="error" role="alert" class="app-menu-title text-tone-red">{{ error }}</p>
			<p v-else-if="loading && !results.length" class="app-menu-title">Recherche…</p>
			<p v-else-if="!results.length" class="app-menu-title">Aucun ticket ne correspond.</p>
			<button
				v-for="(ticket, index) in results"
				:key="ticket.name"
				type="button"
				class="app-menu-item"
				role="option"
				:aria-selected="index === cursor"
				@click="choose(ticket)"
				@pointerenter="cursor = index"
			>
				<span class="min-w-0 flex-1 truncate font-medium text-ink-gray-9">{{ ticket.client }}</span>
				<TicketStatus :status="ticket.status" />
				<span class="tabular-nums text-xs text-ink-gray-6">{{ ticket.name }}</span>
			</button>
		</div>
	</div>
</template>
