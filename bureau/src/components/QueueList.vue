<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideMessageSquare from '~icons/lucide/message-square'
import LucideX from '~icons/lucide/x'
import AppToast from './AppToast.vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import NewTicketDialog from './NewTicketDialog.vue'
import TicketStatus from './TicketStatus.vue'
import { bulkAction, bulkAssign, getQueue, getReferences } from '@/lib/api'
import { echeanceLabel } from '@/lib/display'
import { conditionLabel, FIELDS, withDoctypeFields, type Condition } from '@/lib/filters'
import { canPause, canStart, COLUMNS, creanceText, DEFAULT_COLUMNS, isOpen, sortText, stepPercent, stepText, visibleColumns } from '@/lib/list'
import type { ExportQuery } from '@/lib/exports'
import type { BulkState } from '@/lib/useBulk'
import { TICKET_VIEWS, type QueueState } from '@/lib/useQueue'
import type { Option, QueueTicket, References } from '@/types'

const props = defineProps<{ state: QueueState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string]; changed: [] }>()

const references = ref<References | null>(null)
const referencesError = ref('')
const dataList = ref<{ revealCreated: () => Promise<void> } | null>(null)
const labelOf = (condition: Condition) => conditionLabel(condition, references.value)
async function fetchRows(query: ExportQuery, start: number, pageLength: number) {
	const state = props.state
	const response = await getQueue(query.view as QueueState['view']['value'], query.conditions, query.search, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.tickets, total: response.total }
}

// Actions propres aux tickets : la barre commune de DataList les affiche à côté de Modifier, Tags, Exporter et Supprimer.
const checked = ref(new Set<string>())
const bulkAssignee = ref('')
watch(checked, (names) => {
	if (!names.size) bulkAssignee.value = ''
})
const assigneeOptions = computed<Option[]>(() => {
	const options = [...(references.value?.assignees ?? [])]
	if (window.user && !options.some((option) => option.value === window.user)) options.push({ value: window.user, label: window.user_fullname || window.user })
	return options
})

// Les tickets non concernés partent aussi : le serveur reste seul juge et le message les signale.
function assignPicked(picked: QueueTicket[], bulk: BulkState) {
	const user = bulkAssignee.value
	const label = assigneeOptions.value.find((option) => option.value === user)?.label ?? user
	bulk.run(picked, (batch) => bulkAssign(batch, user), `ticket attribué à ${label}`, `tickets attribués à ${label}`)
}
function startPicked(picked: QueueTicket[], bulk: BulkState) {
	bulk.run(picked, (batch) => bulkAction(batch, 'Démarrer'), 'ticket démarré', 'tickets démarrés')
}
function pausePicked(picked: QueueTicket[], bulk: BulkState) {
	bulk.run(picked, (batch) => bulkAction(batch, 'Pause'), 'ticket mis en pause', 'tickets mis en pause')
}

// Menu de la ligne : mêmes actions serveur que la sélection, pour un seul ticket, sans toucher à ce qui est coché.
function takeRow(ticket: QueueTicket, bulk: BulkState) {
	const user = window.user
	if (!user) return
	const label = window.user_fullname || user
	bulk.run([ticket], (batch) => bulkAssign(batch, user), `ticket attribué à ${label}`, `tickets attribués à ${label}`, true)
}
function startRow(ticket: QueueTicket, bulk: BulkState) {
	bulk.run([ticket], (batch) => bulkAction(batch, 'Démarrer'), 'ticket démarré', 'tickets démarrés', true)
}
function pauseRow(ticket: QueueTicket, bulk: BulkState) {
	bulk.run([ticket], (batch) => bulkAction(batch, 'Pause'), 'ticket mis en pause', 'tickets mis en pause', true)
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
		:views="TICKET_VIEWS"
		:counts="state.queue.value?.counts"
		default-sort-label="Urgence, puis échéance"
		:sort-text="sortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-rows="fetchRows"
		:selected="selected"
		:created="created?.name"
		:load-error="referencesError"
		bulk-doctype="Ticket Commercial"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
		@create="creating = true"
	>
		<template #filters="{ conditions, update }">
			<FilterBuilder :model-value="conditions" @update:model-value="update" :references="references" :fields="withDoctypeFields(FIELDS, references?.filter_fields)" />
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
				<TagCell v-else-if="column.key === 'tags'" :tags="ticket.tags" :max="1" />
			</template>
		</template>

		<template #rowMenu="{ row: ticket, bulk }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', ticket.name)">Ouvrir la fiche</button>
			<button v-if="isOpen(ticket)" type="button" class="app-menu-item" role="menuitem" :disabled="bulk.busy.value" @click="takeRow(ticket, bulk)">Prendre en charge</button>
			<button v-if="canStart(ticket)" type="button" class="app-menu-item" role="menuitem" :disabled="bulk.busy.value" @click="startRow(ticket, bulk)">Démarrer</button>
			<button v-if="canPause(ticket)" type="button" class="app-menu-item" role="menuitem" :disabled="bulk.busy.value" @click="pauseRow(ticket, bulk)">Mettre en pause</button>
		</template>

		<template #bulkActions="{ picked, bulk }">
			<select id="bulk-assignee" v-model="bulkAssignee" class="field-input w-[170px]" aria-label="Pris en charge par" :disabled="bulk.busy.value">
				<option value="">Pris en charge par…</option>
				<option v-for="option in assigneeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
			</select>
			<button type="button" class="btn-primary" :disabled="bulk.busy.value || !bulkAssignee || !picked.filter(isOpen).length" @click="assignPicked(picked, bulk)">Attribuer</button>
			<span class="bureau-bulk-sep" aria-hidden="true"></span>
			<button type="button" class="btn-secondary" :disabled="bulk.busy.value || !picked.filter(canStart).length" @click="startPicked(picked, bulk)">Démarrer ({{ picked.filter(canStart).length }})</button>
			<button type="button" class="btn-secondary" :disabled="bulk.busy.value || !picked.filter(canPause).length" @click="pausePicked(picked, bulk)">Mettre en pause ({{ picked.filter(canPause).length }})</button>
		</template>

		<template #drawer><slot name="drawer"></slot></template>

		<NewTicketDialog v-if="creating" @close="creating = false" @created="onCreated" />
		<AppToast :message="createdMessage" :tone="created?.failedFiles ? 'warning' : 'success'" :duration="0" @close="dismissCreated">
			<button type="button" class="app-toast-action" @click="openCreated">Ouvrir la fiche</button>
		</AppToast>
	</DataList>
</template>
