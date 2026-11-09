<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import { getDevisList, getDevisOptions } from '@/lib/api'
import { clientTone } from '@/lib/articles'
import { chiffrageText, commandeText, DEFAULT_DEVIS_COLUMNS, DEVIS_COLUMNS, DEVIS_DOCTYPE, DEVIS_VIEWS, devisSortText, devisStage, devisTypeLabel, moneyText, type DevisOptions, type DevisRow, type DevisView } from '@/lib/devis'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import type { ExportQuery } from '@/lib/exports'
import { describeCondition, type Condition } from '@/lib/filters'
import { fieldCellText } from '@/lib/listViews'
import type { DevisListState } from '@/lib/useDevisList'

const props = defineProps<{ state: DevisListState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string]; changed: [] }>()

// Pas de création ici : un devis part toujours d'une demande de faisabilité.
const options = ref<DevisOptions | null>(null)
const optionsError = ref('')
const fields = computed(() => options.value?.filter_fields ?? [])
const labelOf = (condition: Condition) => describeCondition(condition, fields.value)
const canSeeDemande = canRead('Demande Faisabilite')
const canSeeClient = canRead('Customer')

async function fetchRows(query: ExportQuery, start: number, pageLength: number) {
	const state = props.state
	const response = await getDevisList(query.view as DevisView, query.conditions, query.search, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.devis as DevisRow[], total: response.total }
}

/** Part des lignes chiffrées, pour la barre : pleine en vert, partielle en bleu. */
const ratio = (row: DevisRow) => (row.lignes ? Math.round((row.chiffrees / row.lignes) * 100) : 0)

onMounted(async () => {
	try {
		options.value = await getDevisOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
</script>

<template>
	<DataList
		:state="state"
		:rows="state.devis.value"
		title="Devis"
		noun="devis"
		search-label="Rechercher un devis"
		search-placeholder="Numéro, client, article, demande, ticket"
		:columns="DEVIS_COLUMNS"
		locked-column="name"
		:default-columns="DEFAULT_DEVIS_COLUMNS"
		list-id="devis"
		:views="DEVIS_VIEWS"
		:counts="state.response.value?.counts"
		default-sort-label="Les plus récents"
		:sort-text="devisSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-rows="fetchRows"
		:selected="selected"
		:load-error="optionsError"
		:doctype="DEVIS_DOCTYPE"
		:export-fields="fields"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
	>
		<template #filters="{ conditions, update, canSave }">
			<FilterBuilder :model-value="conditions" :fields="fields" :doctype="DEVIS_DOCTYPE" :can-save="canSave" @update:model-value="update" />
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
				<span v-else-if="column.key === 'chiffrage'" class="devis-progress" :title="row.lignes ? `${row.chiffrees} ligne(s) chiffrée(s) sur ${row.lignes}` : 'Aucune ligne'">
					<span class="devis-progress-bar" aria-hidden="true"><span :class="ratio(row) === 100 ? 'is-full' : ''" :style="{ width: `${ratio(row)}%` }"></span></span>
					<span class="tabular-nums">{{ chiffrageText(row) || '—' }}</span>
				</span>
				<span v-else-if="column.key === 'total'" class="list-col-end tabular-nums" :class="!row.total && 'text-ink-gray-6'">{{ row.total ? moneyText(row.total) : '—' }}</span>
				<span v-else-if="column.key === 'total_ttc'" class="list-col-end tabular-nums" :class="!row.total_ttc && 'text-ink-gray-6'">{{ row.total_ttc ? moneyText(row.total_ttc) : '—' }}</span>
				<span v-else-if="column.key === 'status'" class="flex min-w-0 items-center gap-1">
					<span v-if="devisStage(row)" class="list-tag" :class="devisStage(row)!.tone">{{ devisStage(row)!.label }}</span>
					<StatusPill v-else :status="row.status" />
				</span>
				<span v-else-if="column.key === 'commande'" class="tabular-nums" :class="!row.commande && 'text-ink-gray-6'">{{ commandeText(row) || '—' }}</span>
				<span v-else-if="column.key === 'urgence'"><span class="urgence" :class="`urgence-${row.urgence}`">{{ row.urgence }}</span></span>
				<span v-else-if="column.key === 'valable'" class="tabular-nums">{{ formatDay(row.valable) || '—' }}</span>
				<span v-else-if="column.key === 'demande'" class="tabular-nums">{{ row.demande || '—' }}</span>
				<span v-else-if="column.key === 'type'">{{ devisTypeLabel(row.type) }}</span>
				<span v-else-if="column.key === 'ticket'" class="tabular-nums">{{ row.ticket || '—' }}</span>
				<span v-else-if="column.key === 'livraison'" class="tabular-nums">{{ formatDay(row.livraison) || '—' }}</span>
				<span v-else-if="column.key === 'commercial'" class="truncate" :title="row.commercial || undefined">{{ row.commercial || '—' }}</span>
				<TagCell v-else-if="column.key === 'tags'" :tags="row.tags" :max="1" />
				<span v-else-if="column.key === 'date'" class="tabular-nums">{{ formatDay(row.date) || '—' }}</span>
				<span v-else-if="column.key === 'creation'" class="tabular-nums">{{ formatDay(row.creation) || '—' }}</span>
				<span v-else-if="column.key === 'modified'" class="tabular-nums">{{ formatDay(row.modified) || '—' }}</span>
				<span v-else-if="column.key === 'cree_par'" class="truncate" :title="row.cree_par || undefined">{{ row.cree_par || '—' }}</span>
				<span v-else :class="column.end && 'list-col-end tabular-nums'" :title="String(column.text(row))">{{ fieldCellText(column, row) }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<a class="app-menu-item" role="menuitem" :href="deskUrl(DEVIS_DOCTYPE, row.name)" target="_blank" rel="noopener noreferrer">Ouvrir sur le Desk</a>
			<RouterLink v-if="row.demande && canSeeDemande" class="app-menu-item" role="menuitem" :to="{ name: 'Demande', params: { id: row.demande } }">Voir la demande</RouterLink>
			<RouterLink v-if="row.ticket" class="app-menu-item" role="menuitem" :to="{ name: 'Ticket', params: { id: row.ticket } }">Voir le ticket</RouterLink>
			<RouterLink v-if="canSeeClient" class="app-menu-item" role="menuitem" :to="{ name: 'Client', params: { id: row.client } }">Voir le client</RouterLink>
		</template>

		<template #drawer><slot name="drawer"></slot></template>
	</DataList>
</template>
