<script setup lang="ts">
import { computed, type Component, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import LucideFileText from '~icons/lucide/file-text'
import LucidePackage from '~icons/lucide/package'
import LucidePlus from '~icons/lucide/plus'
import LucideSearch from '~icons/lucide/search'
import LucideShoppingCart from '~icons/lucide/shopping-cart'
import LucideTicket from '~icons/lucide/ticket'
import LucideWallet from '~icons/lucide/wallet'
import TicketStatus from './TicketStatus.vue'
import { getArticles, getClients, getQueue, getDemandes } from '@/lib/api'
import { type CreateKind, filterCommands, moveCursor, PALETTE_COMMANDS, type PaletteCommand, SECTION_TITLES } from '@/lib/palette'

/** Fenêtre du raccourci Cmd/Ctrl K : créer, ouvrir une liste, trouver un enregistrement. */
const emit = defineEmits<{ close: []; create: [kind: CreateKind]; done: [] }>()
const router = useRouter()
const MAX_RESULTS = 5

interface RecordItem {
	id: string
	label: string
	detail?: string | null
	status?: string
	icon: PaletteCommand['icon']
	to: RouteLocationRaw
}
type Item = { kind: 'command'; command: PaletteCommand } | { kind: 'record'; record: RecordItem }
interface Group {
	id: string
	title: string
	error?: string
	items: Item[]
}

const ICONS: Record<PaletteCommand['icon'], Component> = {
	ticket: LucidePlus,
	article: LucidePlus,
	client: LucidePlus,
	demandes: LucideClipboardList,
	tickets: LucideTicket,
	clients: LucideBuilding2,
	articles: LucidePackage,
	commandes: LucideShoppingCart,
	devis: LucideFileText,
	creances: LucideWallet,
}

const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)
const query = ref('')
const cursor = ref(0)
const loading = ref(false)
const records = ref<Group[]>([])
const hasQuery = computed(() => query.value.trim().length > 0)

const groups = computed<Group[]>(() => {
	const commands = filterCommands(PALETTE_COMMANDS, query.value)
	const sections: Group[] = (Object.keys(SECTION_TITLES) as PaletteCommand['section'][]).map((section) => ({
		id: section,
		title: SECTION_TITLES[section],
		items: commands.filter((command) => command.section === section).map((command): Item => ({ kind: 'command', command })),
	}))
	return [...sections, ...records.value].filter((group) => group.items.length || group.error)
})
const items = computed(() => groups.value.flatMap((group) => group.items))
const offsets = computed(() => {
	let total = 0
	return groups.value.map((group) => {
		const start = total
		total += group.items.length
		return start
	})
})

function settled<Row>(id: string, title: string, result: PromiseSettledResult<Row[]>, toRecord: (row: Row) => RecordItem): Group {
	if (result.status === 'rejected') return { id, title, error: (result.reason as Error).message, items: [] }
	return { id, title, items: result.value.map((row): Item => ({ kind: 'record', record: toRecord(row) })) }
}

// Une seule réponse compte : celle de la dernière frappe.
let lastRequest = 0
let timer: ReturnType<typeof setTimeout> | null = null
async function search() {
	const request = ++lastRequest
	const text = query.value
	const paging = { pageLength: MAX_RESULTS }
	const [tickets, demandes, clients, articles] = await Promise.allSettled([
		Promise.all([getQueue('todo', [], text, paging), getQueue('closed', [], text, paging)]).then(([active, closed]) => {
			const seen = new Set<string>()
			return [...active.tickets, ...closed.tickets].filter((ticket) => !seen.has(ticket.name) && seen.add(ticket.name)).slice(0, MAX_RESULTS)
		}),
		getDemandes('all', [], text, paging).then((response) => response.demandes),
		getClients('all', [], text, paging).then((response) => response.clients),
		getArticles('all', [], text, paging).then((response) => response.articles),
	])
	if (request !== lastRequest) return
	records.value = [
		settled('tickets', 'Tickets', tickets, (ticket) => ({ id: ticket.name, label: ticket.client, detail: ticket.name, status: ticket.status, icon: 'tickets', to: { name: 'Ticket', params: { id: ticket.name } } })),
		settled('demandes', 'Demandes', demandes, (demande) => ({ id: demande.name, label: demande.client_label, detail: demande.name, status: demande.status, icon: 'demandes', to: { name: 'Demande', params: { id: demande.name } } })),
		settled('clients', 'Clients', clients, (client) => ({ id: client.name, label: client.client, detail: client.wilaya, icon: 'clients', to: { name: 'Client', params: { id: client.name } } })),
		settled('articles', 'Articles', articles, (article) => ({ id: article.name, label: article.designation, detail: article.client_label, icon: 'articles', to: { name: 'Article', params: { id: article.name } } })),
	]
	loading.value = false
}
watch(query, () => {
	if (timer) clearTimeout(timer)
	lastRequest++
	cursor.value = 0
	records.value = []
	loading.value = hasQuery.value
	if (hasQuery.value) timer = setTimeout(search, 250)
})
watch(
	() => items.value.length,
	(size) => {
		if (cursor.value >= size) cursor.value = 0
	},
)
watch(cursor, async (index) => {
	await nextTick()
	list.value?.querySelector(`#palette-option-${index}`)?.scrollIntoView?.({ block: 'nearest' })
})

function choose(item?: Item) {
	if (!item) return
	if (item.kind === 'record') {
		router.push(item.record.to)
		emit('done')
		return
	}
	const { action } = item.command
	if (action.type === 'create') {
		emit('create', action.kind)
		return
	}
	if (action.type === 'route') router.push(action.to)
	else window.open(action.href, '_blank', 'noopener,noreferrer')
	emit('done')
}

function onKeydown(event: KeyboardEvent) {
	// Le raccourci remonte jusqu'à la barre, qui referme la fenêtre. Rien d'autre n'atteint la page derrière.
	if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) return
	event.stopPropagation()
	if (event.isComposing) return
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		cursor.value = moveCursor(cursor.value, items.value.length, event.key === 'ArrowDown' ? 1 : -1)
	} else if (event.key === 'Enter') {
		event.preventDefault()
		choose(items.value[cursor.value])
	} else if (event.key === 'Escape') {
		event.preventDefault()
		emit('close')
	} else if (event.key === 'Tab') {
		event.preventDefault()
	}
}

onMounted(() => input.value?.focus())
onBeforeUnmount(() => {
	lastRequest++
	if (timer) clearTimeout(timer)
})
</script>

<template>
	<div class="dialog-scrim command-palette-scrim" @pointerdown.self="emit('close')" @keydown="onKeydown">
		<div class="dialog command-palette" role="dialog" aria-modal="true" aria-label="Rechercher ou créer">
			<div class="command-palette-head">
				<LucideSearch class="h-4 w-4 flex-none text-ink-gray-5" aria-hidden="true" />
				<input
					ref="input"
					v-model="query"
					class="command-palette-input"
					type="text"
					placeholder="Créer, ouvrir une liste, chercher un ticket, un client, un article…"
					autocomplete="off"
					spellcheck="false"
					role="combobox"
					aria-expanded="true"
					aria-controls="palette-list"
					aria-label="Rechercher ou créer"
					:aria-activedescendant="items.length ? `palette-option-${cursor}` : undefined"
				/>
			</div>
			<div id="palette-list" ref="list" class="command-palette-list" role="listbox" aria-label="Résultats">
				<div v-for="(group, groupIndex) in groups" :key="group.id" role="group" :aria-label="group.title">
					<p class="app-menu-title">{{ group.title }}</p>
					<p v-if="group.error" role="alert" class="command-palette-note text-tone-red">{{ group.error }}</p>
					<button
						v-for="(item, index) in group.items"
						:id="`palette-option-${offsets[groupIndex] + index}`"
						:key="item.kind === 'command' ? item.command.id : item.record.id"
						type="button"
						class="app-menu-item"
						role="option"
						tabindex="-1"
						:aria-selected="offsets[groupIndex] + index === cursor"
						@click="choose(item)"
						@pointerenter="cursor = offsets[groupIndex] + index"
					>
						<template v-if="item.kind === 'command'">
							<component :is="ICONS[item.command.icon]" class="h-3.5 w-3.5 flex-none text-ink-gray-6" aria-hidden="true" />
							<span class="min-w-0 flex-1 truncate text-ink-gray-9">{{ item.command.label }}</span>
							<span v-if="item.command.hint" class="text-xs text-ink-gray-6">{{ item.command.hint }}</span>
						</template>
						<template v-else>
							<component :is="ICONS[item.record.icon]" class="h-3.5 w-3.5 flex-none text-ink-gray-6" aria-hidden="true" />
							<span class="min-w-0 flex-1 truncate font-medium text-ink-gray-9">{{ item.record.label }}</span>
							<TicketStatus v-if="item.record.status" :status="item.record.status" />
							<span v-if="item.record.detail" class="max-w-[40%] truncate text-xs tabular-nums text-ink-gray-6">{{ item.record.detail }}</span>
						</template>
					</button>
				</div>
				<p v-if="loading" class="command-palette-note">Recherche…</p>
				<p v-else-if="!groups.length" class="command-palette-note">Rien ne correspond à « {{ query.trim() }} ».</p>
			</div>
			<div class="command-palette-foot" aria-hidden="true">
				<span><kbd class="palette-kbd">↑</kbd> <kbd class="palette-kbd">↓</kbd> Se déplacer</span>
				<span><kbd class="palette-kbd">Entrée</kbd> Ouvrir</span>
				<span><kbd class="palette-kbd">Échap</kbd> Fermer</span>
			</div>
		</div>
	</div>
</template>
