<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import { getTraceOptions, getTraces } from '@/lib/api'
import { clientTone, procedeTone } from '@/lib/articles'
import { deskUrl, formatDay } from '@/lib/display'
import type { ExportQuery } from '@/lib/exports'
import { describeCondition, type Condition } from '@/lib/filters'
import { fieldCellText } from '@/lib/listViews'
import { defaultTraceColumns, dimensionsText, fileKindLabel, TRACE_COLUMNS, TRACE_DOCTYPE, TRACE_VIEWS, traceSortText, versionLabel, type TraceOptions, type TraceRow, type TraceView } from '@/lib/traces'
import type { TracesState } from '@/lib/useTraces'

const props = defineProps<{ state: TracesState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string]; changed: [] }>()

// Pas de création ici : un tracé naît toujours d'une étude.
const defaultColumns = defaultTraceColumns()
const options = ref<TraceOptions | null>(null)
const optionsError = ref('')
const fields = computed(() => options.value?.filter_fields ?? [])
const labelOf = (condition: Condition) => describeCondition(condition, fields.value)

async function fetchRows(query: ExportQuery, start: number, pageLength: number) {
	const state = props.state
	const response = await getTraces(query.view as TraceView, query.conditions, query.search, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.traces as TraceRow[], total: response.total }
}

onMounted(async () => {
	try {
		options.value = await getTraceOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
</script>

<template>
	<DataList
		:state="state"
		:rows="state.traces.value"
		title="Tracés"
		noun="tracé"
		search-label="Rechercher un tracé"
		search-placeholder="Numéro, article, client, dimensions"
		:columns="TRACE_COLUMNS"
		locked-column="name"
		:default-columns="defaultColumns"
		list-id="traces"
		:views="TRACE_VIEWS"
		:counts="state.response.value?.counts"
		default-sort-label="Les plus récents"
		:sort-text="traceSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-rows="fetchRows"
		:selected="selected"
		:load-error="optionsError"
		:doctype="TRACE_DOCTYPE"
		:export-fields="fields"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
	>
		<template #filters="{ conditions, update, canSave }">
			<FilterBuilder :model-value="conditions" :fields="fields" :doctype="TRACE_DOCTYPE" :can-save="canSave" @update:model-value="update" />
		</template>

		<template #cells="{ row, columns }">
			<template v-for="column in columns" :key="column.key">
				<span v-if="column.key === 'name'" class="list-client tabular-nums" :title="row.name">{{ row.name }}</span>
				<span v-else-if="column.key === 'ver'" class="flex items-center gap-1.5">
					<span class="tabular-nums">{{ versionLabel(row.ver) }}</span>
					<span v-if="row.statut !== 'En service'" class="list-tag tone-gray">Obsolète</span>
				</span>
				<span v-else-if="column.key === 'designation'" class="truncate" :title="row.designation">{{ row.designation }}</span>
				<span v-else-if="column.key === 'client_label'" class="flex min-w-0 items-center gap-1.5" :title="row.client_label">
					<span class="list-mono flex-none" :class="clientTone(row.client_label)" aria-hidden="true">{{ row.client_label.charAt(0) }}</span>
					<span class="truncate">{{ row.client_label }}</span>
				</span>
				<span v-else-if="column.key === 'procede'"><span v-if="row.procede" class="list-tag" :class="procedeTone(row.procede)">{{ row.procede }}</span><template v-else>—</template></span>
				<span v-else-if="column.key === 'dimensions'" class="truncate tabular-nums" :title="dimensionsText(row.dimensions)">{{ dimensionsText(row.dimensions) || '—' }}</span>
				<span v-else-if="column.key === 'points_colle'" class="list-col-end tabular-nums">{{ row.points_colle }}</span>
				<span v-else-if="column.key === 'fichier'">
					<span v-if="row.fichier" class="list-tag" :class="row.fichier === 'pdf' ? 'tone-green' : 'tone-amber'" :title="row.fichier === 'image' ? 'Une image : l\'atelier ne peut pas la lire' : undefined">{{ fileKindLabel(row.fichier) }}</span>
					<span v-else class="text-ink-gray-6">Aucun</span>
				</span>
				<span v-else-if="column.key === 'impositions'" class="list-col-end tabular-nums" :class="!row.impositions && 'text-ink-gray-6'">{{ row.impositions || '—' }}</span>
				<span v-else-if="column.key === 'statut'"><StatusPill :status="row.statut" /></span>
				<TagCell v-else-if="column.key === 'tags'" :tags="row.tags" :max="1" />
				<span v-else-if="column.key === 'creation'" class="tabular-nums">{{ formatDay(row.creation) || '—' }}</span>
				<span v-else-if="column.key === 'modified'" class="tabular-nums">{{ formatDay(row.modified) || '—' }}</span>
				<span v-else :class="column.end && 'list-col-end tabular-nums'" :title="String(column.text(row))">{{ fieldCellText(column, row) }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<a class="app-menu-item" role="menuitem" :href="deskUrl(TRACE_DOCTYPE, row.name)" target="_blank" rel="noopener noreferrer">Ouvrir sur le Desk</a>
			<RouterLink class="app-menu-item" role="menuitem" :to="{ name: 'Article', params: { id: row.article } }">Voir l'article</RouterLink>
		</template>

		<template #drawer><slot name="drawer"></slot></template>
	</DataList>
</template>
