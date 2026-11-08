<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import { getImpositionOptions, getImpositions } from '@/lib/api'
import { clientTone } from '@/lib/articles'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import type { ExportQuery } from '@/lib/exports'
import { describeCondition, type Condition } from '@/lib/filters'
import { chutesText, defaultImpositionColumns, IMPOSITION_COLUMNS, IMPOSITION_DOCTYPE, IMPOSITION_VIEWS, impositionFlags, impositionSortText, origineLabel, type ImpositionListRow, type ImpositionOptions, type ImpositionView } from '@/lib/impositions'
import { fieldCellText } from '@/lib/listViews'
import type { ImpositionsState } from '@/lib/useImpositions'

const props = defineProps<{ state: ImpositionsState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string]; changed: [] }>()

// Pas de création ici : une imposition naît à l'atelier, depuis une étude.
const defaultColumns = defaultImpositionColumns()
const options = ref<ImpositionOptions | null>(null)
const optionsError = ref('')
const fields = computed(() => options.value?.filter_fields ?? [])
const labelOf = (condition: Condition) => describeCondition(condition, fields.value)
const canSeeTrace = canRead('Trace')

async function fetchRows(query: ExportQuery, start: number, pageLength: number) {
	const state = props.state
	const response = await getImpositions(query.view as ImpositionView, query.conditions, query.search, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.impositions as ImpositionListRow[], total: response.total }
}

onMounted(async () => {
	try {
		options.value = await getImpositionOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
</script>

<template>
	<DataList
		:state="state"
		:rows="state.impositions.value"
		title="Impositions"
		noun="imposition"
		search-label="Rechercher une imposition"
		search-placeholder="Numéro, article, client, tracé, machine"
		:columns="IMPOSITION_COLUMNS"
		locked-column="name"
		:default-columns="defaultColumns"
		list-id="impositions"
		:views="IMPOSITION_VIEWS"
		:counts="state.response.value?.counts"
		default-sort-label="Les plus récentes"
		:sort-text="impositionSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-rows="fetchRows"
		:selected="selected"
		:load-error="optionsError"
		:doctype="IMPOSITION_DOCTYPE"
		:export-fields="fields"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
	>
		<template #filters="{ conditions, update, canSave }">
			<FilterBuilder :model-value="conditions" :fields="fields" :doctype="IMPOSITION_DOCTYPE" :can-save="canSave" @update:model-value="update" />
		</template>

		<template #cells="{ row, columns }">
			<template v-for="column in columns" :key="column.key">
				<span v-if="column.key === 'name'" class="list-client tabular-nums" :title="row.name">{{ row.name }}</span>
				<span v-else-if="column.key === 'designation'" class="truncate" :title="row.designation">{{ row.designation }}</span>
				<span v-else-if="column.key === 'client_label'" class="flex min-w-0 items-center gap-1.5" :title="row.client_label">
					<span class="list-mono flex-none" :class="clientTone(row.client_label)" aria-hidden="true">{{ row.client_label.charAt(0) }}</span>
					<span class="truncate">{{ row.client_label }}</span>
				</span>
				<span v-else-if="column.key === 'trace'" class="tabular-nums">{{ row.trace || '—' }}</span>
				<span v-else-if="column.key === 'poses'" class="list-col-end tabular-nums" :title="row.grille ? `${row.grille} (colonnes × rangs)` : undefined">{{ row.poses || '—' }}</span>
				<span v-else-if="column.key === 'format'" class="truncate tabular-nums" :title="row.support || undefined">{{ row.format || '—' }}</span>
				<span v-else-if="column.key === 'chutes'" class="list-col-end tabular-nums">{{ chutesText(row.chutes) || '—' }}</span>
				<span v-else-if="column.key === 'machine'" class="truncate" :class="!row.machine && 'text-ink-gray-6'" :title="row.machine || undefined">{{ row.machine || '—' }}</span>
				<span v-else-if="column.key === 'origine'"><span class="list-tag" :class="row.origine === 'Moteur v1' ? 'tone-blue' : 'tone-gray'">{{ origineLabel(row.origine) }}</span></span>
				<span v-else-if="column.key === 'etat'" class="flex min-w-0 gap-1">
					<span v-for="flag in impositionFlags(row)" :key="flag.label" class="list-tag" :class="flag.tone" :title="flag.title">{{ flag.label }}</span>
				</span>
				<TagCell v-else-if="column.key === 'tags'" :tags="row.tags" :max="1" />
				<span v-else-if="column.key === 'creation'" class="tabular-nums">{{ formatDay(row.creation) || '—' }}</span>
				<span v-else-if="column.key === 'modified'" class="tabular-nums">{{ formatDay(row.modified) || '—' }}</span>
				<span v-else :class="column.end && 'list-col-end tabular-nums'" :title="String(column.text(row))">{{ fieldCellText(column, row) }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<a class="app-menu-item" role="menuitem" :href="deskUrl(IMPOSITION_DOCTYPE, row.name)" target="_blank" rel="noopener noreferrer">Ouvrir sur le Desk</a>
			<RouterLink v-if="row.trace && canSeeTrace" class="app-menu-item" role="menuitem" :to="{ name: 'Trace', params: { id: row.trace } }">Voir le tracé</RouterLink>
			<RouterLink class="app-menu-item" role="menuitem" :to="{ name: 'Article', params: { id: row.article } }">Voir l'article</RouterLink>
		</template>

		<template #drawer><slot name="drawer"></slot></template>
	</DataList>
</template>
