<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import ClientDialog from './ClientDialog.vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import { getClientOptions, getClients } from '@/lib/api'
import { CLIENT_COLUMNS, CLIENT_FILTER_FIELDS, CLIENT_VIEWS, clientConditionLabel, clientFilterChoices, clientSortText, DEFAULT_CLIENT_COLUMNS, formatAmount, visibleClientColumns, type ClientOptions, type ClientRow } from '@/lib/clients'
import { formatDay } from '@/lib/display'
import type { Condition } from '@/lib/filters'
import type { ClientsState } from '@/lib/useClients'

const props = defineProps<{ state: ClientsState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string, tab?: string] }>()

const options = ref<ClientOptions | null>(null)
const optionsError = ref('')
const dataList = ref<{ revealCreated: () => Promise<void> } | null>(null)
const labelOf = (condition: Condition) => clientConditionLabel(condition, options.value)
async function fetchAll(start: number, pageLength: number) {
	const state = props.state
	const response = await getClients(state.view.value, state.conditions.value, state.search.value, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.clients as ClientRow[], total: response.total }
}

// Création : la liste reste en place, avec la nouvelle ligne surlignée et un lien vers sa fiche.
const creating = ref(false)
const created = ref<string | null>(null)
let createdTimer: ReturnType<typeof setTimeout> | null = null
function dismissCreated() {
	if (createdTimer) clearTimeout(createdTimer)
	created.value = null
}
async function onCreated(name: string) {
	const state = props.state
	dismissCreated()
	created.value = name
	createdTimer = setTimeout(dismissCreated, 8000)
	state.view.value = 'all'
	state.search.value = ''
	state.conditions.value = []
	await nextTick()
	await state.load()
	await state.reveal(name)
	await dataList.value?.revealCreated()
}
function openCreated() {
	const name = created.value
	dismissCreated()
	if (name) emit('open', name)
}

onMounted(async () => {
	try {
		options.value = await getClientOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
onBeforeUnmount(() => {
	if (createdTimer) clearTimeout(createdTimer)
})
</script>

<template>
	<DataList
		ref="dataList"
		:state="state"
		:rows="state.clients.value"
		title="Clients"
		noun="client"
		search-label="Rechercher un client"
		search-placeholder="Nom, code, wilaya, contact"
		create-label="Nouveau prospect"
		:columns="CLIENT_COLUMNS"
		:visible-of="visibleClientColumns"
		:default-columns="DEFAULT_CLIENT_COLUMNS"
		columns-key="bureau-clients-colonnes"
		:views="CLIENT_VIEWS"
		:counts="state.response.value?.counts"
		default-sort-label="Ordre par nom"
		:sort-text="clientSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-all="fetchAll"
		:selected="selected"
		:created="created ?? undefined"
		:load-error="optionsError"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@create="creating = true"
	>
		<template #filters>
			<FilterBuilder v-model="state.conditions.value" :fields="CLIENT_FILTER_FIELDS" first-field="status" :choices-of="(field) => clientFilterChoices(field, options)" />
		</template>

		<template #cells="{ row, columns }">
			<template v-for="column in columns" :key="column.key">
				<span v-if="column.key === 'client'" class="flex min-w-0 items-baseline gap-1.5" :title="row.client">
					<span class="list-client truncate">{{ row.client }}</span>
					<span v-if="row.grand_compte" class="record-flag">Grand compte</span>
				</span>
				<span v-else-if="column.key === 'status'"><StatusPill :status="row.status" /></span>
				<span v-else-if="column.key === 'wilaya'">{{ row.wilaya || '—' }}</span>
				<span v-else-if="column.key === 'commercial'" :title="row.commercial || undefined">{{ row.commercial || 'Non attribué' }}</span>
				<span v-else-if="column.key === 'visite'" :class="row.visite ? 'tabular-nums' : 'text-ink-gray-6'">{{ formatDay(row.visite) || 'Jamais' }}</span>
				<span v-else-if="column.key === 'creance'" class="list-col-end tabular-nums" :class="!row.creance && 'text-ink-gray-6'">{{ formatAmount(row.creance) }}</span>
				<span v-else-if="column.key === 'tickets'" class="list-col-end tabular-nums" :class="!row.tickets && 'text-ink-gray-6'">{{ row.tickets }}</span>
				<span v-else-if="column.key === 'categorie'">{{ row.categorie || '—' }}</span>
				<span v-else-if="column.key === 'contact'" :title="row.contact || undefined">{{ row.contact || '—' }}</span>
				<span v-else-if="column.key === 'telephone'" class="tabular-nums">{{ row.telephone || '—' }}</span>
				<span v-else-if="column.key === 'name'" class="tabular-nums text-ink-gray-7">{{ row.name }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name, 'affaires')">Voir les affaires</button>
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name, 'relation')">Voir les visites et appels</button>
		</template>

		<template #drawer><slot name="drawer"></slot></template>

		<ClientDialog v-if="creating" @close="creating = false" @created="onCreated" />
		<div v-if="created" class="toast-action" role="status">
			<span>Prospect créé.</span>
			<button type="button" @click="openCreated">Ouvrir la fiche</button>
		</div>
	</DataList>
</template>
