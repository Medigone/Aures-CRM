<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import { getEtudeOptions, getEtudes } from '@/lib/api'
import { clientTone, procedeTone } from '@/lib/articles'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import { defaultEtudeColumns, ETUDE_COLUMNS, etudeSortText, etudeViews, formatQuantity, primaryEtudeDoctype, type EtudeOptions, type EtudeRow, type EtudeView } from '@/lib/etudes'
import type { ExportQuery } from '@/lib/exports'
import { describeCondition, type Condition } from '@/lib/filters'
import { fieldCellText } from '@/lib/listViews'
import type { EtudesState } from '@/lib/useEtudes'

const props = defineProps<{ state: EtudesState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string]; changed: [] }>()

// Pas de création ici : une étude naît toujours d'une demande.
const doctype = primaryEtudeDoctype()
const defaultColumns = defaultEtudeColumns()
const views = etudeViews()
const options = ref<EtudeOptions | null>(null)
const optionsError = ref('')
const fields = computed(() => options.value?.filter_fields ?? [])
const labelOf = (condition: Condition) => describeCondition(condition, fields.value)
const canSeeDemande = canRead('Demande Faisabilite')

async function fetchRows(query: ExportQuery, start: number, pageLength: number) {
	const state = props.state
	const response = await getEtudes(query.view as EtudeView, query.conditions, query.search, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.etudes as EtudeRow[], total: response.total }
}

onMounted(async () => {
	try {
		options.value = await getEtudeOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
</script>

<template>
	<DataList
		:state="state"
		:rows="state.etudes.value"
		title="Études de faisabilité"
		noun="étude"
		search-label="Rechercher une étude"
		search-placeholder="Numéro, article, client, demande"
		:columns="ETUDE_COLUMNS"
		locked-column="name"
		:default-columns="defaultColumns"
		list-id="etudes"
		:views="views"
		:counts="state.response.value?.counts"
		default-sort-label="Urgence puis échéance"
		:sort-text="etudeSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-rows="fetchRows"
		:selected="selected"
		:load-error="optionsError"
		:doctype="doctype"
		:row-doctype="(row: EtudeRow) => row.doctype"
		:export-fields="options?.both ? [] : fields"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
	>
		<template #filters="{ conditions, update, canSave }">
			<FilterBuilder :model-value="conditions" :fields="fields" :doctype="doctype" :can-save="canSave" @update:model-value="update" />
		</template>

		<template #cells="{ row, columns }">
			<template v-for="column in columns" :key="column.key">
				<span v-if="column.key === 'name'" class="list-client tabular-nums" :title="row.name">{{ row.name }}</span>
				<span v-else-if="column.key === 'designation'" class="flex min-w-0 items-baseline gap-1.5" :title="row.designation">
					<span class="truncate">{{ row.designation }}</span>
					<span v-if="row.retirage" class="flex-none text-xs text-ink-gray-6">Retirage</span>
				</span>
				<span v-else-if="column.key === 'client_label'" class="flex min-w-0 items-center gap-1.5" :title="row.client_label">
					<span class="list-mono flex-none" :class="clientTone(row.client_label)" aria-hidden="true">{{ row.client_label.charAt(0) }}</span>
					<span class="truncate">{{ row.client_label }}</span>
				</span>
				<span v-else-if="column.key === 'procede'"><span v-if="row.procede" class="list-tag" :class="procedeTone(row.procede)">{{ row.procede }}</span><template v-else>—</template></span>
				<span v-else-if="column.key === 'quantite'" class="list-col-end tabular-nums">{{ formatQuantity(row.quantite) }}</span>
				<span v-else-if="column.key === 'urgence'"><span class="urgence" :class="`urgence-${row.urgence}`">{{ row.urgence }}</span></span>
				<span v-else-if="column.key === 'echeance'" class="tabular-nums" :class="row.retard && 'etude-late'" :title="row.retard ? 'Échéance dépassée' : undefined">{{ formatDay(row.echeance) || '—' }}</span>
				<span v-else-if="column.key === 'status'"><StatusPill :status="row.status" /></span>
				<span v-else-if="column.key === 'manquantes'" class="etude-pieces" :title="String(column.text(row))">
					<span v-for="piece in row.pieces" :key="piece.key" class="etude-piece" :data-done="Boolean(piece.value)">{{ piece.label }}</span>
				</span>
				<span v-else-if="column.key === 'assigne'" :class="!row.assigne && 'text-ink-gray-6'" :title="row.assigne || undefined">{{ row.assigne || 'Non attribuée' }}</span>
				<span v-else-if="column.key === 'demande'" class="tabular-nums">{{ row.demande || '—' }}</span>
				<TagCell v-else-if="column.key === 'tags'" :tags="row.tags" :max="1" />
				<span v-else-if="column.key === 'livraison'" class="tabular-nums">{{ formatDay(row.livraison) || '—' }}</span>
				<span v-else-if="column.key === 'commercial'" :title="row.commercial || undefined">{{ row.commercial || '—' }}</span>
				<span v-else-if="column.key === 'date'" class="tabular-nums">{{ formatDay(row.date) || '—' }}</span>
				<span v-else-if="column.key === 'creation'" class="tabular-nums">{{ formatDay(row.creation) || '—' }}</span>
				<span v-else-if="column.key === 'modified'" class="tabular-nums">{{ formatDay(row.modified) || '—' }}</span>
				<span v-else :class="column.end && 'list-col-end tabular-nums'" :title="String(column.text(row))">{{ fieldCellText(column, row) }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<a class="app-menu-item" role="menuitem" :href="deskUrl(row.doctype, row.name)" target="_blank" rel="noopener noreferrer">Ouvrir sur le Desk</a>
			<RouterLink v-if="row.demande && canSeeDemande" class="app-menu-item" role="menuitem" :to="{ name: 'Demande', params: { id: row.demande } }">Voir la demande</RouterLink>
			<RouterLink class="app-menu-item" role="menuitem" :to="{ name: 'Article', params: { id: row.article } }">Voir l'article</RouterLink>
		</template>

		<template #drawer><slot name="drawer"></slot></template>
	</DataList>
</template>
