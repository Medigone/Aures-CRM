<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import LucideMessageSquare from '~icons/lucide/message-square'
import LucideX from '~icons/lucide/x'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import NewTicketDialog from './NewTicketDialog.vue'
import TicketStatus from './TicketStatus.vue'
import { bulkAction, bulkAssign, getQueue, getReferences } from '@/lib/api'
import { echeanceLabel } from '@/lib/display'
import { conditionLabel, type Condition } from '@/lib/filters'
import { bulkSummary, canPause, canStart, COLUMNS, creanceText, DEFAULT_COLUMNS, isOpen, sortText, stepPercent, stepText, visibleColumns } from '@/lib/list'
import type { QueueState } from '@/lib/useQueue'
import type { BulkResult, Option, QueueTicket, References } from '@/types'

const props = defineProps<{ state: QueueState; selected?: string }>()
const emit = defineEmits<{ pick: [name: string]; open: [name: string]; changed: [] }>()

const VIEWS = [
	{ key: 'todo', label: 'À traiter' },
	{ key: 'mine', label: 'À moi' },
	{ key: 'urgent', label: 'Urgences à décider' },
	{ key: 'creance', label: 'Créance bloquée' },
	{ key: 'closed', label: 'Clos' },
]

const references = ref<References | null>(null)
const referencesError = ref('')
const dataList = ref<{ revealCreated: () => Promise<void> } | null>(null)
const labelOf = (condition: Condition) => conditionLabel(condition, references.value)
async function fetchAll(start: number, pageLength: number) {
	const state = props.state
	const response = await getQueue(state.view.value, state.conditions.value, state.search.value, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.tickets, total: response.total }
}

// Sélection. Seuls les tickets visibles comptent : une action ne touche jamais une ligne cachée par un filtre.
const checked = ref(new Set<string>())
const picked = computed(() => props.state.tickets.value.filter((ticket) => checked.value.has(ticket.name)))
const pickedLabel = computed(() => (picked.value.length > 1 ? `${picked.value.length} tickets sélectionnés` : '1 ticket sélectionné'))
const startCount = computed(() => picked.value.filter(canStart).length)
const pauseCount = computed(() => picked.value.filter(canPause).length)
const assignCount = computed(() => picked.value.filter(isOpen).length)

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

async function runBulk(tickets: QueueTicket[], action: () => Promise<BulkResult>, one: string, many: string, keepPicked = false) {
	if (bulkBusy.value || !tickets.length) return
	bulkBusy.value = true
	bulkError.value = ''
	dismissMessage()
	try {
		const result = await action()
		bulkMessage.value = bulkSummary(result, one, many)
		bulkSkipped.value = result.skipped
		if (!keepPicked) clearPicked()
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

// Menu de la ligne : mêmes actions serveur que la sélection, pour un seul ticket, sans toucher à ce qui est coché.
function takeRow(ticket: QueueTicket) {
	const user = window.user
	if (!user) return
	const label = window.user_fullname || user
	runBulk([ticket], () => bulkAssign([ticket], user), `ticket attribué à ${label}`, `tickets attribués à ${label}`, true)
}
function startRow(ticket: QueueTicket) {
	runBulk([ticket], () => bulkAction([ticket], 'Démarrer'), 'ticket démarré', 'tickets démarrés', true)
}
function pauseRow(ticket: QueueTicket) {
	runBulk([ticket], () => bulkAction([ticket], 'Pause'), 'ticket mis en pause', 'tickets mis en pause', true)
}

// Création : la liste reste en place, et amène à la nouvelle ligne une fois la fenêtre fermée ou prête pour la suivante.
const creating = ref(false)
const created = ref<{ name: string; failedFiles: number } | null>(null)
let createdTimer: ReturnType<typeof setTimeout> | null = null
function dismissCreated() {
	if (createdTimer) clearTimeout(createdTimer)
	created.value = null
}
async function onCreated(result: { name: string; failedFiles: number }) {
	const state = props.state
	dismissCreated()
	created.value = result
	// Un fichier non envoyé reste signalé jusqu'à ce qu'on ferme le message.
	if (!result.failedFiles) createdTimer = setTimeout(dismissCreated, 8000)
	state.view.value = 'todo'
	state.search.value = ''
	state.conditions.value = []
	await nextTick()
	await state.load()
	await state.reveal(result.name)
	await dataList.value?.revealCreated()
}
const createdMessage = computed(() => {
	if (!created.value) return ''
	const failed = created.value.failedFiles
	const files = !failed ? '' : failed > 1 ? ` ${failed} fichiers n'ont pas été envoyés : joignez-les depuis la fiche.` : " Un fichier n'a pas été envoyé : joignez-le depuis la fiche."
	return `Ticket ${created.value.name} créé.${files}`
})
function openCreated() {
	const name = created.value?.name
	dismissCreated()
	if (name) emit('open', name)
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
	if (createdTimer) clearTimeout(createdTimer)
})
</script>

<template>
	<DataList
		ref="dataList"
		v-model:checked="checked"
		:state="state"
		:rows="state.tickets.value"
		title="Tickets"
		noun="ticket"
		search-label="Rechercher un client ou un ticket"
		search-placeholder="Client ou n° de ticket"
		create-label="Nouveau ticket"
		:columns="COLUMNS"
		:visible-of="visibleColumns"
		:default-columns="DEFAULT_COLUMNS"
		columns-key="bureau-tickets-colonnes"
		:views="VIEWS"
		:counts="state.queue.value?.counts"
		default-sort-label="Urgence, puis échéance"
		:sort-text="sortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-all="fetchAll"
		:selected="selected"
		:created="created?.name"
		:load-error="referencesError"
		selectable
		check-all-label="Sélectionner tous les tickets de la page"
		:check-label="(ticket) => `Sélectionner le ticket ${ticket.name}`"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@create="creating = true"
	>
		<template #filters>
			<FilterBuilder v-model="state.conditions.value" :references="references" />
		</template>

		<template #cells="{ row: ticket, columns }">
			<template v-for="column in columns" :key="column.key">
				<span v-if="column.key === 'client'" class="list-client" :title="ticket.client">{{ ticket.client }}</span>
				<span v-else-if="column.key === 'type'">{{ ticket.request_type }}</span>
				<span v-else-if="column.key === 'status'"><TicketStatus :status="ticket.status" /></span>
				<span v-else-if="column.key === 'urgence'" class="list-urgence">
					<span class="urgence" :class="`urgence-${ticket.niveau_urgence}`">{{ ticket.niveau_urgence }}</span>
					<span v-if="ticket.urgence_en_attente" class="list-ask" :title="`Urgence ${ticket.niveau_urgence_demande} à décider`">→ {{ ticket.niveau_urgence_demande }}</span>
				</span>
				<span v-else-if="column.key === 'echeance'" :class="ticket.is_late && 'font-semibold text-tone-red'">{{ echeanceLabel(ticket) }}</span>
				<span v-else-if="column.key === 'step'" class="list-step">
					<span class="list-bar" aria-hidden="true"><i :style="{ width: `${stepPercent(ticket)}%` }"></i></span>
					<span class="truncate" :title="stepText(ticket)">{{ stepText(ticket) }}</span>
				</span>
				<span v-else-if="column.key === 'name'" class="tabular-nums text-ink-gray-7">{{ ticket.name }}</span>
				<span v-else-if="column.key === 'assigne'">{{ ticket.assigne_a_nom || 'Non attribué' }}</span>
				<span v-else-if="column.key === 'comments'" class="list-comments" :title="ticket.comments ? `${ticket.comments} commentaire${ticket.comments > 1 ? 's' : ''}` : undefined">
					<template v-if="ticket.comments"><LucideMessageSquare class="h-3.5 w-3.5" aria-hidden="true" />{{ ticket.comments }}</template>
				</span>
				<span v-else-if="column.key === 'commercial'" :title="ticket.commercial || undefined">{{ ticket.commercial || '—' }}</span>
				<span v-else-if="column.key === 'creance'">{{ creanceText(ticket) }}</span>
			</template>
		</template>

		<template #rowMenu="{ row: ticket }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', ticket.name)">Ouvrir la fiche</button>
			<button v-if="isOpen(ticket)" type="button" class="app-menu-item" role="menuitem" :disabled="bulkBusy" @click="takeRow(ticket)">Prendre en charge</button>
			<button v-if="canStart(ticket)" type="button" class="app-menu-item" role="menuitem" :disabled="bulkBusy" @click="startRow(ticket)">Démarrer</button>
			<button v-if="canPause(ticket)" type="button" class="app-menu-item" role="menuitem" :disabled="bulkBusy" @click="pauseRow(ticket)">Mettre en pause</button>
		</template>

		<template #bulk>
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
				<p v-if="bulkError" role="alert" class="w-full text-sm text-tone-red">{{ bulkError }}</p>
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
		</template>

		<template #drawer><slot name="drawer"></slot></template>

		<NewTicketDialog v-if="creating" @close="creating = false" @created="onCreated" />
		<div v-if="created" class="toast-action" role="status">
			<span>{{ createdMessage }}</span>
			<button type="button" @click="openCreated">Ouvrir la fiche</button>
			<button v-if="created.failedFiles" type="button" aria-label="Fermer ce message" @click="dismissCreated"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
		</div>
	</DataList>
</template>
