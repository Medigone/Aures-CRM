<script setup lang="ts" generic="Row extends { name: string }">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import ExportColumns from './ExportColumns.vue'
import { exportXlsx, getExportValues } from '@/lib/api'
import { countText, EVERYTHING, exportColumnOptions, exportColumns, exportFileName, exportTable, LINES_PER_REQUEST, listColumnKeys, querySignature, saveCsv, saveExportColumns, savedExportColumns, saveXlsx, type ExportFormat, type ExportQuery } from '@/lib/exports'
import { isComplete, type Condition, type FilterField } from '@/lib/filters'
import type { Column } from '@/lib/list'
import { PAGE_SIZES } from '@/lib/useServerList'

/** Utilitaire d'export : le format, puis tout ou une sélection, avec le nombre de lignes tenu à jour. Les filtres posés ici ne touchent pas à la liste. */
const props = defineProps<{
	title: string
	noun: string
	/** DocType des lignes : les champs choisis s'y lisent. */
	doctype: string
	views: { key: string; label: string }[]
	/** Toutes les colonnes de la liste, et celles qu'elle affiche, cochées au départ. */
	allColumns: Column<Row>[]
	columns: Column<Row>[]
	fields: FilterField[]
	/** Vue, filtres et recherche de la liste au moment d'ouvrir. */
	initial: ExportQuery
	filtered: boolean
	/** Lignes cochées dans la liste : « Lignes cochées » est proposé tant qu'il y en a. */
	picked: Row[]
	/** Ouverte depuis la barre des lignes cochées. */
	fromPicked: boolean
	conditionLabel: (condition: Condition) => string
	fetchRows: (query: ExportQuery, start: number, pageLength: number) => Promise<{ rows: Row[]; total: number }>
}>()
const emit = defineEmits<{ close: []; done: [message: string] }>()

const format = ref<ExportFormat>('xlsx')
const options = computed(() => exportColumnOptions(props.allColumns, props.fields))
// Le dernier choix de cette liste, sinon les colonnes qu'elle affiche.
const selected = ref(savedExportColumns(props.doctype) ?? listColumnKeys(props.columns))
const known = computed(() => new Set(options.value.map((option) => option.key)))
const fileColumns = computed(() => selected.value.filter((key) => known.value.has(key)))
const listKeys = computed(() => listColumnKeys(props.columns))
const scope = ref<'all' | 'filtered' | 'picked'>(props.fromPicked ? 'picked' : props.filtered ? 'filtered' : 'all')
const view = ref(props.initial.view)
// Un filtre resté sans valeur dans la liste ne filtre rien : il n'encombre pas la fenêtre.
const conditions = ref<Condition[]>(props.initial.conditions.filter(isComplete).map((condition) => ({ ...condition })))
const search = ref(props.initial.search.trim())
const activeConditions = computed(() => conditions.value.filter(isComplete))
const viewName = computed(() => (view.value === props.views[0]?.key ? '' : (props.views.find((item) => item.key === view.value)?.label ?? '')))
// Sans filtre repris de la liste, le panneau s'ouvre tout de suite : il n'y a rien d'autre à faire dans ce mode.
const editing = ref(!props.filtered)

const query = computed<ExportQuery>(() => (scope.value === 'all' ? EVERYTHING : { view: view.value, conditions: conditions.value, search: search.value }))
const count = ref<number | null>(null)
const lineCount = computed(() => (scope.value === 'picked' ? props.picked.length : count.value))
const countError = ref('')
const error = ref('')
const busy = ref(false)

// Une seule réponse compte, celle des derniers filtres.
let lastRequest = 0
let timer: ReturnType<typeof setTimeout> | null = null
async function refreshCount() {
	const request = ++lastRequest
	try {
		const { total } = await props.fetchRows(query.value, 0, 1)
		if (request !== lastRequest) return
		count.value = total
		countError.value = ''
	} catch (e) {
		if (request !== lastRequest) return
		count.value = null
		countError.value = (e as Error).message
	}
}
watch(
	() => querySignature(query.value),
	() => {
		count.value = null
		lastRequest++
		if (timer) clearTimeout(timer)
		timer = setTimeout(refreshCount, 250)
	},
)
refreshCount()
onBeforeUnmount(() => {
	if (timer) clearTimeout(timer)
	lastRequest++
})

async function submit() {
	if (busy.value || !lineCount.value || !fileColumns.value.length) return
	busy.value = true
	error.value = ''
	try {
		const rows: Row[] = scope.value === 'picked' ? [...props.picked] : []
		const pageLength = Math.max(...PAGE_SIZES)
		const asked = { ...query.value }
		for (let start = 0; scope.value !== 'picked'; start += pageLength) {
			const response = await props.fetchRows(asked, start, pageLength)
			rows.push(...response.rows)
			if (rows.length >= response.total || !response.rows.length) break
		}
		const chosen = fileColumns.value.flatMap((key) => options.value.find((option) => option.key === key)?.field ?? [])
		const values: Record<string, Record<string, string | number>> = {}
		if (chosen.length) {
			const names = rows.map((row) => row.name)
			const fields = chosen.map(({ doctype, field }) => ({ doctype, field }))
			for (let start = 0; start < names.length; start += LINES_PER_REQUEST) Object.assign(values, await getExportValues(props.doctype, names.slice(start, start + LINES_PER_REQUEST), fields))
		}
		const columns = exportColumns(fileColumns.value, props.allColumns, options.value, values)
		const name = exportFileName(props.noun, format.value)
		if (format.value === 'csv') saveCsv(rows, columns, name)
		else {
			const { headers, cells } = exportTable(rows, columns)
			saveXlsx(await exportXlsx(props.title, headers, cells), name)
		}
		saveExportColumns(props.doctype, fileColumns.value)
		emit('done', `${countText(rows.length, props.noun).replace('sera exporté', 'exporté').replace('seront exportés', 'exportés')}.`)
	} catch (e) {
		error.value = `L'export a échoué : ${(e as Error).message}`
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog class="export-dialog" :title="`Exporter les ${noun}s`" :dirty="false" :busy="busy" @close="emit('close')" @submit="submit">
		<div class="flex flex-col gap-3">
			<div class="flex flex-wrap items-center gap-x-7 gap-y-2">
				<div class="flex items-center gap-2">
					<span class="field-label mb-0">Format</span>
					<div class="seg" role="group" aria-label="Format du fichier">
						<button type="button" :aria-pressed="format === 'xlsx'" @click="format = 'xlsx'">Excel (.xlsx)</button>
						<button type="button" :aria-pressed="format === 'csv'" @click="format = 'csv'">CSV (.csv)</button>
					</div>
				</div>
				<fieldset class="flex flex-wrap items-center gap-x-3 gap-y-1">
					<legend class="field-label float-left mb-0 mr-2">Lignes</legend>
					<label class="export-choice"><input v-model="scope" type="radio" name="export-scope" value="all" /> Tout exporter</label>
					<label class="export-choice"><input v-model="scope" type="radio" name="export-scope" value="filtered" /> Appliquer des filtres</label>
					<label v-if="picked.length" class="export-choice"><input v-model="scope" type="radio" name="export-scope" value="picked" /> Lignes cochées ({{ picked.length }})</label>
				</fieldset>
			</div>

			<div v-if="scope === 'filtered'" class="flex flex-col gap-2 rounded-control bg-surface-gray-1 px-2.5 py-2">
				<div class="flex flex-wrap items-center gap-1.5">
					<button v-if="viewName" type="button" class="filter-chip" :aria-label="`Retirer la vue ${viewName}`" @click="view = views[0].key">{{ viewName }} ×</button>
					<button v-for="condition in activeConditions" :key="condition.id" type="button" class="filter-chip" :aria-label="`Retirer le filtre ${conditionLabel(condition)}`" @click="conditions = conditions.filter((item) => item.id !== condition.id)">{{ conditionLabel(condition) }} ×</button>
					<button v-if="search" type="button" class="filter-chip" :aria-label="`Retirer la recherche ${search}`" @click="search = ''">Recherche : {{ search }} ×</button>
					<span v-if="!viewName && !activeConditions.length && !search" class="text-ink-gray-6">Aucun filtre pour l'instant.</span>
					<button type="button" class="btn-secondary ml-auto" :aria-expanded="editing" @click="editing = !editing">{{ editing ? 'Masquer les filtres' : 'Modifier les filtres' }}</button>
				</div>
				<div v-if="editing" class="export-filters">
					<label class="flex flex-col gap-1">
						<span class="field-label mb-0">Afficher</span>
						<select v-model="view" class="field-input" aria-label="Vue à exporter">
							<option v-for="item in views" :key="item.key" :value="item.key">{{ item.label }}</option>
						</select>
					</label>
					<slot name="filters" :conditions="conditions" :update="(value: Condition[]) => (conditions = value)" :can-save="false"></slot>
				</div>
			</div>

			<ExportColumns v-model="selected" :options="options" :list-columns="listKeys" />

			<p v-if="countError && scope !== 'picked'" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">Le nombre de lignes n'a pas pu être calculé : {{ countError }}</p>
			<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		</div>

		<template #hint>
			<span class="flex-auto text-sm font-medium text-ink-gray-9" role="status">
				<template v-if="!fileColumns.length">Choisissez au moins une colonne</template>
				<template v-else-if="lineCount === null">{{ countError ? '' : 'Calcul du nombre de lignes…' }}</template>
				<template v-else>{{ countText(lineCount, noun) }} <span class="font-normal text-ink-gray-6">· {{ fileColumns.length }} colonne{{ fileColumns.length > 1 ? 's' : '' }}</span></template>
			</span>
		</template>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy || !lineCount || !fileColumns.length" @click="submit">{{ busy ? 'Export…' : 'Exporter' }}</button>
		</template>
	</FormDialog>
</template>
