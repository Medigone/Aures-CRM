<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import DataList from './DataList.vue'
import DemandeDialog from './DemandeDialog.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import { getDemandeOptions, getDemandes } from '@/lib/api'
import { clientTone, procedeTone } from '@/lib/articles'
import { DEFAULT_DEMANDE_COLUMNS, DEMANDE_COLUMNS, DEMANDE_VIEWS, demandeSortText, typeLabel, visibleDemandeColumns, type DemandeOptions, type DemandeRow, type DemandeView } from '@/lib/demandes'
import { formatDay } from '@/lib/display'
import { describeCondition, type Condition } from '@/lib/filters'
import type { ExportQuery } from '@/lib/exports'
import type { DemandesState } from '@/lib/useDemandes'

const props = defineProps<{ state: DemandesState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string, tab?: string]; changed: [] }>()

const options = ref<DemandeOptions | null>(null)
const optionsError = ref('')
const dataList = ref<{ revealCreated: () => Promise<void> } | null>(null)
const fields = computed(() => options.value?.filter_fields ?? [])
const labelOf = (condition: Condition) => describeCondition(condition, fields.value)
async function fetchRows(query: ExportQuery, start: number, pageLength: number) {
	const state = props.state
	const response = await getDemandes(query.view as DemandeView, query.conditions, query.search, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.demandes as DemandeRow[], total: response.total }
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
	creating.value = false
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
		options.value = await getDemandeOptions()
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
		:rows="state.demandes.value"
		title="Demandes de faisabilité"
		noun="demande"
		search-label="Rechercher une demande"
		search-placeholder="Numéro, client, article, bon de commande"
		create-label="Nouvelle demande"
		:columns="DEMANDE_COLUMNS"
		:visible-of="visibleDemandeColumns"
		:default-columns="DEFAULT_DEMANDE_COLUMNS"
		columns-key="bureau-demandes-colonnes"
		:views="DEMANDE_VIEWS"
		:counts="state.response.value?.counts"
		default-sort-label="Ordre par date"
		:sort-text="demandeSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-rows="fetchRows"
		:selected="selected"
		:created="created ?? undefined"
		:load-error="optionsError"
		doctype="Demande Faisabilite"
		:export-fields="fields"
		bulk-doctype="Demande Faisabilite"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
		@create="creating = true"
	>
		<template #filters="{ conditions, update, canSave }">
			<FilterBuilder :model-value="conditions" :fields="fields" doctype="Demande Faisabilite" :can-save="canSave" @update:model-value="update" />
		</template>

		<template #cells="{ row, columns }">
			<template v-for="column in columns" :key="column.key">
				<span v-if="column.key === 'name'" class="list-client tabular-nums" :title="row.name">{{ row.name }}</span>
				<span v-else-if="column.key === 'client_label'" class="flex min-w-0 items-center gap-1.5" :title="row.client_label">
					<span class="list-mono flex-none" :class="clientTone(row.client_label)" aria-hidden="true">{{ row.client_label.charAt(0) }}</span>
					<span class="truncate">{{ row.client_label }}</span>
				</span>
				<span v-else-if="column.key === 'articles'" class="flex min-w-0 items-baseline gap-1.5" :title="row.articles || undefined">
					<span class="truncate">{{ row.articles || '—' }}</span>
					<span v-if="row.articles_count > 1" class="flex-none text-xs text-ink-gray-6">+{{ row.articles_count - 1 }}</span>
				</span>
				<span v-else-if="column.key === 'type'">{{ typeLabel(row.type) || '—' }}</span>
				<span v-else-if="column.key === 'status'"><StatusPill :status="row.status" /></span>
				<span v-else-if="column.key === 'procede'"><span v-if="row.procede" class="list-tag" :class="procedeTone(row.procede)">{{ row.procede }}</span><template v-else>—</template></span>
				<span v-else-if="column.key === 'urgence'"><span class="urgence" :class="`urgence-${row.urgence}`">{{ row.urgence }}</span></span>
				<span v-else-if="column.key === 'livraison'" class="tabular-nums">{{ formatDay(row.livraison) || '—' }}</span>
				<span v-else-if="column.key === 'commercial'" :title="row.commercial || undefined">{{ row.commercial || '—' }}</span>
				<TagCell v-else-if="column.key === 'tags'" :tags="row.tags" :max="1" />
				<span v-else-if="column.key === 'ticket'" class="tabular-nums">{{ row.ticket || '—' }}</span>
				<span v-else-if="column.key === 'bon_commande'" class="tabular-nums">{{ row.bon_commande || '—' }}</span>
				<span v-else-if="column.key === 'creation'" class="tabular-nums">{{ formatDay(row.creation) || '—' }}</span>
				<span v-else-if="column.key === 'cree_par'" :title="row.cree_par || undefined">{{ row.cree_par || '—' }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name, 'articles')">Voir les articles</button>
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name, 'etudes')">Voir les études et devis</button>
		</template>

		<template #drawer><slot name="drawer"></slot></template>

		<DemandeDialog v-if="creating" @close="creating = false" @created="onCreated" />
		<AppToast :message="created ? `Demande ${created} créée.` : ''" :duration="0" @close="created = null">
			<button type="button" class="app-toast-action" @click="openCreated">Ouvrir la fiche</button>
		</AppToast>
	</DataList>
</template>
