<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import { getCommandesList, getCommandesOptions } from '@/lib/api'
import { clientTone } from '@/lib/articles'
import { bonText, COMMANDE_DOCTYPE, COMMANDE_VIEWS, commandeColumns, commandeSortText, DEFAULT_COMMANDE_COLUMNS, isLate, moneyText, percentText, type CommandeOptions, type CommandeRow, type CommandeView } from '@/lib/commandes'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import type { ExportQuery } from '@/lib/exports'
import { describeCondition, type Condition } from '@/lib/filters'
import { fieldCellText } from '@/lib/listViews'
import type { CommandesListState } from '@/lib/useCommandesList'

const props = defineProps<{ state: CommandesListState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string]; changed: [] }>()

// Pas de création ici : une commande part toujours d'un devis validé.
const options = ref<CommandeOptions | null>(null)
const optionsError = ref('')
const fields = computed(() => options.value?.filter_fields ?? [])
const labelOf = (condition: Condition) => describeCondition(condition, fields.value)
// Tant que les options n'ont pas répondu, les montants restent cachés.
const columns = computed(() => commandeColumns(Boolean(options.value?.montants)))
const defaults = computed(() => DEFAULT_COMMANDE_COLUMNS.filter((key) => columns.value.some((column) => column.key === key)))
const canSeeDevis = canRead('Quotation')
const canSeeDemande = canRead('Demande Faisabilite')
const canSeeClient = canRead('Customer')

async function fetchRows(query: ExportQuery, start: number, pageLength: number) {
	const state = props.state
	const response = await getCommandesList(query.view as CommandeView, query.conditions, query.search, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.commandes as CommandeRow[], total: response.total }
}

const share = (row: CommandeRow, key: string) => (key === 'facture' ? row.facture : row.livre)
const amount = (row: CommandeRow, key: string) => (key === 'total' ? row.total : row.total_ttc)

onMounted(async () => {
	try {
		options.value = await getCommandesOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
</script>

<template>
	<!-- Les colonnes dépendent du droit sur les montants : la liste attend de le connaître. -->
	<p v-if="!options && !optionsError" class="py-8 text-center text-ink-gray-6">Chargement des commandes…</p>
	<DataList
		v-else
		:state="state"
		:rows="state.commandes.value"
		title="Commandes"
		noun="commande"
		search-label="Rechercher une commande"
		search-placeholder="Numéro, client, bon de commande, article, devis"
		:columns="columns"
		locked-column="name"
		:default-columns="defaults"
		list-id="commandes"
		:views="COMMANDE_VIEWS"
		:counts="state.response.value?.counts"
		default-sort-label="Les plus récentes"
		:sort-text="commandeSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-rows="fetchRows"
		:selected="selected"
		:load-error="optionsError"
		:doctype="COMMANDE_DOCTYPE"
		:export-fields="fields"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
	>
		<template #filters="{ conditions, update, canSave }">
			<FilterBuilder :model-value="conditions" :fields="fields" :doctype="COMMANDE_DOCTYPE" :can-save="canSave" @update:model-value="update" />
		</template>

		<template #cells="{ row, columns: shown }">
			<template v-for="column in shown" :key="column.key">
				<span v-if="column.key === 'name'" class="list-client tabular-nums" :title="row.name">{{ row.name }}</span>
				<span v-else-if="column.key === 'client_label'" class="flex min-w-0 items-center gap-1.5" :title="row.client_label">
					<span class="list-mono flex-none" :class="clientTone(row.client_label)" aria-hidden="true">{{ row.client_label.charAt(0) }}</span>
					<span class="truncate">{{ row.client_label }}</span>
				</span>
				<span v-else-if="column.key === 'articles'" class="flex min-w-0 items-baseline gap-1.5" :title="row.articles || undefined">
					<span class="truncate">{{ row.articles || '—' }}</span>
					<span v-if="row.articles_count > 1" class="flex-none text-xs text-ink-gray-6">+{{ row.articles_count - 1 }}</span>
				</span>
				<span v-else-if="column.key === 'bon_commande'" class="truncate tabular-nums" :class="!row.bon_commande && 'text-ink-gray-6'" :title="bonText(row) || undefined">{{ bonText(row) || (row.status === 'Draft' ? 'À saisir' : '—') }}</span>
				<span v-else-if="column.key === 'status'" class="flex min-w-0 items-center gap-1"><StatusPill :status="row.status" /></span>
				<span v-else-if="column.key === 'livraison'" class="tabular-nums" :class="isLate(row) && 'font-semibold text-tone-red'" :title="isLate(row) ? 'Livraison en retard' : undefined">{{ formatDay(row.livraison) || '—' }}</span>
				<span v-else-if="column.key === 'fabrication'" class="truncate" :class="!row.fabrication && 'text-ink-gray-6'" :title="row.dossier || undefined">{{ row.fabrication || '—' }}</span>
				<span v-else-if="column.key === 'livre' || column.key === 'facture'" class="devis-progress" :title="`${percentText(share(row, column.key))} ${column.key === 'livre' ? 'livré' : 'facturé'}`">
					<span class="devis-progress-bar" aria-hidden="true"><span :class="share(row, column.key) >= 100 ? 'is-full' : ''" :style="{ width: `${Math.min(100, share(row, column.key))}%` }"></span></span>
					<span class="tabular-nums">{{ percentText(share(row, column.key)) }}</span>
				</span>
				<span v-else-if="column.key === 'total' || column.key === 'total_ttc'" class="list-col-end tabular-nums" :class="!amount(row, column.key) && 'text-ink-gray-6'">{{ amount(row, column.key) ? moneyText(amount(row, column.key)) : '—' }}</span>
				<span v-else-if="column.key === 'urgence'"><span class="urgence" :class="`urgence-${row.urgence}`">{{ row.urgence }}</span></span>
				<TagCell v-else-if="column.key === 'tags'" :tags="row.tags" :max="1" />
				<span v-else-if="column.key === 'devis'" class="tabular-nums">{{ row.devis || '—' }}</span>
				<span v-else-if="column.key === 'demande'" class="tabular-nums">{{ row.demande || '—' }}</span>
				<span v-else-if="column.key === 'commercial'" class="truncate" :title="row.commercial || undefined">{{ row.commercial || '—' }}</span>
				<span v-else-if="column.key === 'cree_par'" class="truncate" :title="row.cree_par || undefined">{{ row.cree_par || '—' }}</span>
				<span v-else-if="column.key === 'date_bon'" class="tabular-nums">{{ formatDay(row.date_bon) || '—' }}</span>
				<span v-else-if="column.key === 'date'" class="tabular-nums">{{ formatDay(row.date) || '—' }}</span>
				<span v-else-if="column.key === 'creation'" class="tabular-nums">{{ formatDay(row.creation) || '—' }}</span>
				<span v-else-if="column.key === 'modified'" class="tabular-nums">{{ formatDay(row.modified) || '—' }}</span>
				<span v-else :class="column.end && 'list-col-end tabular-nums'" :title="String(column.text(row))">{{ fieldCellText(column, row) }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<a class="app-menu-item" role="menuitem" :href="deskUrl(COMMANDE_DOCTYPE, row.name)" target="_blank" rel="noopener noreferrer">Ouvrir sur le Desk</a>
			<RouterLink v-if="row.devis && canSeeDevis" class="app-menu-item" role="menuitem" :to="{ name: 'DevisFiche', params: { id: row.devis } }">Voir le devis</RouterLink>
			<RouterLink v-if="row.demande && canSeeDemande" class="app-menu-item" role="menuitem" :to="{ name: 'Demande', params: { id: row.demande } }">Voir la demande</RouterLink>
			<RouterLink v-if="row.ticket" class="app-menu-item" role="menuitem" :to="{ name: 'Ticket', params: { id: row.ticket } }">Voir le ticket</RouterLink>
			<RouterLink v-if="canSeeClient" class="app-menu-item" role="menuitem" :to="{ name: 'Client', params: { id: row.client } }">Voir le client</RouterLink>
		</template>

		<template #drawer><slot name="drawer"></slot></template>
	</DataList>
</template>
