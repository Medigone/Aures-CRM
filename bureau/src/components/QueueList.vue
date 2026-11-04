<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideListFilter from '~icons/lucide/list-filter'
import LucideRefreshCw from '~icons/lucide/refresh-cw'
import LucideX from '~icons/lucide/x'
import FilterBuilder from './FilterBuilder.vue'
import TicketStatus from './TicketStatus.vue'
import { bulkAction, bulkAssign, getReferences } from '@/lib/api'
import { echeanceLabel } from '@/lib/display'
import { conditionLabel, isComplete } from '@/lib/filters'
import { bulkSummary, canPause, canStart, COLUMNS, creanceText, isOpen, nextSort, stepPercent, stepText } from '@/lib/list'
import type { QueueState } from '@/lib/useQueue'
import type { BulkResult, Option, QueueTicket, QueueView, References } from '@/types'

const props = defineProps<{ state: QueueState; selected?: string }>()
const emit = defineEmits<{ pick: [name: string]; open: [name: string]; changed: [] }>()

const VIEWS: { key: QueueView; label: string; title: string; alert?: boolean }[] = [
	{ key: 'todo', label: 'À traiter', title: 'À traiter' },
	{ key: 'mine', label: 'À moi', title: 'À moi' },
	{ key: 'urgent', label: 'Urgences', title: 'Urgences à décider', alert: true },
	{ key: 'creance', label: 'Créance', title: 'Créance bloquée', alert: true },
	{ key: 'closed', label: 'Clos', title: 'Clos' },
]

const filtersOpen = ref(false)
const references = ref<References | null>(null)
const referencesError = ref('')
const list = ref<HTMLElement | null>(null)

const activeConditions = computed(() => props.state.conditions.value.filter(isComplete))
const filtersLabel = computed(() => (activeConditions.value.length ? `Filtres (${activeConditions.value.length})` : 'Filtres'))
const views = computed(() =>
	VIEWS.map((item) => ({ ...item, count: props.state.queue.value?.counts[item.key] ?? 0 })),
)
function removeCondition(id: number) {
	props.state.conditions.value = props.state.conditions.value.filter((condition) => condition.id !== id)
}

// La liste défile seule : le ticket ouvert doit y rester visible. Les rechargements en arrière-plan ne la bougent pas.
let revealed = false
async function revealSelected() {
	await nextTick()
	list.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
}
watch(() => props.selected, revealSelected)
watch(props.state.queue, () => {
	if (!revealed) {
		revealed = true
		revealSelected()
	}
})
watch(props.state.view, () => {
	list.value?.scrollTo({ top: 0 })
	checked.value = new Set()
})

// Sélection. Seuls les tickets visibles comptent : une action ne touche jamais une ligne cachée par un filtre.
const checked = ref(new Set<string>())
const picked = computed(() => props.state.tickets.value.filter((ticket) => checked.value.has(ticket.name)))
const allPicked = computed(() => props.state.tickets.value.length > 0 && picked.value.length === props.state.tickets.value.length)
const somePicked = computed(() => picked.value.length > 0 && !allPicked.value)
const pickedLabel = computed(() => (picked.value.length > 1 ? `${picked.value.length} tickets sélectionnés` : '1 ticket sélectionné'))
const startCount = computed(() => picked.value.filter(canStart).length)
const pauseCount = computed(() => picked.value.filter(canPause).length)
const assignCount = computed(() => picked.value.filter(isOpen).length)

function toggle(name: string) {
	const next = new Set(checked.value)
	if (!next.delete(name)) next.add(name)
	checked.value = next
}
function toggleAll() {
	checked.value = new Set(allPicked.value ? [] : props.state.tickets.value.map((ticket) => ticket.name))
}
function clearPicked() {
	checked.value = new Set()
	bulkAssignee.value = ''
}

// Actions groupées : le serveur traite chaque ticket à part et dit lesquels il n'a pas pu traiter.
const bulkAssignee = ref('')
const bulkBusy = ref(false)
const bulkMessage = ref('')
const bulkSkipped = ref<BulkResult['skipped']>([])
const bulkError = ref('')
let messageTimer: ReturnType<typeof setTimeout> | null = null

const assigneeOptions = computed<Option[]>(() => {
	const options = [...(references.value?.assignees ?? [])]
	if (window.user && !options.some((option) => option.value === window.user)) options.push({ value: window.user, label: window.user_fullname || window.user })
	return options
})

function dismissMessage() {
	if (messageTimer) clearTimeout(messageTimer)
	bulkMessage.value = ''
	bulkSkipped.value = []
}

async function runBulk(tickets: QueueTicket[], action: () => Promise<BulkResult>, one: string, many: string) {
	if (bulkBusy.value || !tickets.length) return
	bulkBusy.value = true
	bulkError.value = ''
	dismissMessage()
	try {
		const result = await action()
		bulkMessage.value = bulkSummary(result, one, many)
		bulkSkipped.value = result.skipped
		clearPicked()
		// Un succès complet s'efface seul ; ce qui n'a pas été traité reste jusqu'à ce qu'on l'ait lu.
		if (!result.skipped.length) messageTimer = setTimeout(dismissMessage, 6000)
	} catch (e) {
		bulkError.value = (e as Error).message
	} finally {
		bulkBusy.value = false
		emit('changed')
	}
}
// Les tickets non concernés partent aussi : le serveur reste seul juge et le message les signale.
function assignPicked() {
	const user = bulkAssignee.value
	const label = assigneeOptions.value.find((option) => option.value === user)?.label ?? user
	runBulk(picked.value, () => bulkAssign(picked.value, user), `ticket attribué à ${label}`, `tickets attribués à ${label}`)
}
function startPicked() {
	runBulk(picked.value, () => bulkAction(picked.value, 'Démarrer'), 'ticket démarré', 'tickets démarrés')
}
function pausePicked() {
	runBulk(picked.value, () => bulkAction(picked.value, 'Pause'), 'ticket mis en pause', 'tickets mis en pause')
}

function setSort(key: string) {
	props.state.sort.value = nextSort(props.state.sort.value, key)
}
function arrow(key: string) {
	const sort = props.state.sort.value
	return sort?.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : ''
}
function sortLabel(key: string, label: string) {
	const sort = props.state.sort.value
	return sort?.key === key ? `${label}, tri ${sort.dir === 'asc' ? 'croissant' : 'décroissant'}` : `Trier par ${label}`
}

onMounted(async () => {
	try {
		references.value = await getReferences()
	} catch (e) {
		referencesError.value = (e as Error).message
	}
})
onBeforeUnmount(() => {
	if (messageTimer) clearTimeout(messageTimer)
})
</script>

<template>
	<section aria-label="Liste des tickets" class="bureau-list">
		<div class="bureau-toolbar">
			<h1 class="mr-1 text-xl font-semibold">Tickets</h1>
			<div class="views">
				<button
					v-for="item in views"
					:key="item.key"
					type="button"
					class="view"
					:aria-pressed="state.view.value === item.key"
					:aria-label="`${item.title} : ${item.count}`"
					:title="item.title"
					@click="state.view.value = item.key"
				>
					<span>{{ item.label }}</span>
					<span class="view-count" :class="item.alert && item.count > 0 && 'view-count-alert'">{{ item.count }}</span>
				</button>
			</div>
			<span class="flex-auto"></span>
			<input v-model="state.search.value" class="field-input bureau-search rounded-full" type="search" aria-label="Rechercher un client ou un ticket" placeholder="Client ou n° de ticket" />
			<button type="button" class="btn-secondary shrink-0" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
				<LucideListFilter class="h-3.5 w-3.5" aria-hidden="true" />
				{{ filtersLabel }}
			</button>
			<button type="button" class="icon-btn" aria-label="Actualiser la liste" :disabled="state.loading.value" @click="state.load()">
				<LucideRefreshCw class="h-4 w-4" :class="state.loading.value && 'animate-spin'" aria-hidden="true" />
			</button>

			<div v-if="filtersOpen" class="bureau-popover" role="group" aria-label="Filtres combinés">
				<FilterBuilder v-model="state.conditions.value" :references="references" />
				<button type="button" class="btn-primary self-end" @click="filtersOpen = false">Fermer</button>
			</div>
		</div>

		<div v-if="activeConditions.length" class="flex flex-none flex-wrap items-center gap-1.5">
			<button v-for="condition in activeConditions" :key="condition.id" type="button" class="filter-chip" :aria-label="`Retirer le filtre ${conditionLabel(condition, references)}`" @click="removeCondition(condition.id)">
				{{ conditionLabel(condition, references) }}
				<LucideX class="h-3 w-3" aria-hidden="true" />
			</button>
			<button type="button" class="min-h-[var(--ctl)] px-1 text-sm font-medium text-accent hover:underline" @click="state.conditions.value = []">Tout effacer</button>
		</div>

		<p v-if="state.error.value || referencesError" role="alert" class="flex-none rounded-xl bg-surface-red-2 px-3.5 py-2.5 text-sm text-ink-red-3">
			{{ state.error.value || referencesError }}
			<button v-if="state.error.value" type="button" class="ml-1 font-semibold underline" @click="state.load()">Réessayer</button>
		</p>

		<div class="bureau-list-area">
			<div ref="list" class="bureau-list-card">
				<div class="list-head">
					<label class="list-check">
						<input type="checkbox" aria-label="Sélectionner tous les tickets de la vue" :checked="allPicked" :indeterminate="somePicked" :disabled="!state.tickets.value.length" @change="toggleAll" />
					</label>
					<div class="list-cols">
						<button v-for="column in COLUMNS" :key="column.key" type="button" :aria-label="sortLabel(column.key, column.label)" @click="setSort(column.key)">
							{{ column.label }} <span aria-hidden="true">{{ arrow(column.key) }}</span>
						</button>
					</div>
				</div>
				<p v-if="!state.queue.value" class="px-4 py-12 text-center text-ink-gray-6">Chargement…</p>
				<p v-else-if="!state.tickets.value.length" class="px-4 py-12 text-center text-ink-gray-6">Aucun ticket dans cette vue.</p>
				<div v-for="ticket in state.tickets.value" :key="ticket.name" class="list-row" :class="{ 'list-row-on': ticket.name === selected, 'list-row-checked': checked.has(ticket.name) }">
					<label class="list-check">
						<input type="checkbox" :aria-label="`Sélectionner le ticket ${ticket.name}`" :checked="checked.has(ticket.name)" @change="toggle(ticket.name)" />
					</label>
					<button type="button" class="list-cols list-row-main" :aria-current="ticket.name === selected ? 'true' : undefined" @click="emit('pick', ticket.name)" @dblclick="emit('open', ticket.name)">
						<span class="list-client" :title="ticket.client">{{ ticket.client }}</span>
						<span>{{ ticket.request_type }}</span>
						<span><TicketStatus :status="ticket.status" /></span>
						<span class="list-urgence">
							<span class="urgence" :class="`urgence-${ticket.niveau_urgence}`">{{ ticket.niveau_urgence }}</span>
							<span v-if="ticket.urgence_en_attente" class="list-ask" :title="`Urgence ${ticket.niveau_urgence_demande} à décider`">→ {{ ticket.niveau_urgence_demande }}</span>
						</span>
						<span :class="ticket.is_late && 'font-semibold text-ink-red-3'">{{ echeanceLabel(ticket) }}</span>
						<span class="list-step">
							<span class="list-bar" aria-hidden="true"><i :style="{ width: `${stepPercent(ticket)}%` }"></i></span>
							<span class="truncate" :title="stepText(ticket)">{{ stepText(ticket) }}</span>
						</span>
						<span class="tabular-nums text-ink-gray-7">{{ ticket.name }}</span>
						<span>{{ creanceText(ticket) }}</span>
						<span :title="ticket.commercial || undefined">{{ ticket.commercial || '—' }}</span>
						<span>{{ ticket.assigne_a_nom || 'Non attribué' }}</span>
					</button>
				</div>
				<p v-if="state.queue.value?.truncated" class="py-2 text-center text-xs text-ink-gray-6">Seuls les {{ state.queue.value.limit }} premiers tickets sont affichés : affinez avec les filtres.</p>
				<!-- La barre flottante ne doit pas cacher les dernières lignes. -->
				<div v-if="picked.length" class="h-[72px]" aria-hidden="true"></div>
			</div>

			<div v-if="picked.length" class="bureau-bulk" role="group" aria-label="Actions sur les tickets sélectionnés">
				<strong class="whitespace-nowrap font-semibold">{{ pickedLabel }}</strong>
				<span class="bureau-bulk-sep" aria-hidden="true"></span>
				<label class="whitespace-nowrap text-sm text-ink-gray-7" for="bulk-assignee">Pris en charge par</label>
				<select id="bulk-assignee" v-model="bulkAssignee" class="field-input w-[170px]" :disabled="bulkBusy">
					<option value="">Choisir…</option>
					<option v-for="option in assigneeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
				</select>
				<button type="button" class="btn-primary" :disabled="bulkBusy || !bulkAssignee || !assignCount" @click="assignPicked">Attribuer</button>
				<span class="bureau-bulk-sep" aria-hidden="true"></span>
				<button type="button" class="btn-secondary" :disabled="bulkBusy || !startCount" @click="startPicked">Démarrer ({{ startCount }})</button>
				<button type="button" class="btn-secondary" :disabled="bulkBusy || !pauseCount" @click="pausePicked">Mettre en pause ({{ pauseCount }})</button>
				<button type="button" class="icon-btn" aria-label="Désélectionner tout" :disabled="bulkBusy" @click="clearPicked"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
				<p v-if="bulkError" role="alert" class="w-full text-sm text-ink-red-3">{{ bulkError }}</p>
			</div>
			<div v-else-if="bulkMessage" class="bureau-bulk" role="status">
				<div class="min-w-0 flex-1">
					<p class="font-semibold">{{ bulkMessage }}</p>
					<ul v-if="bulkSkipped.length" class="m-0 mt-1 max-h-32 list-none overflow-y-auto p-0 text-sm text-ink-gray-7">
						<li v-for="item in bulkSkipped" :key="item.name">{{ item.name }} : {{ item.reason }}</li>
					</ul>
				</div>
				<button type="button" class="icon-btn" aria-label="Fermer ce message" @click="dismissMessage"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
			</div>

			<slot name="drawer"></slot>
		</div>
	</section>
</template>
