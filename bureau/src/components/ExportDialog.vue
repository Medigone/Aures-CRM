<script setup lang="ts" generic="Row">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { exportXlsx } from '@/lib/api'
import { countText, EVERYTHING, exportFileName, exportTable, querySignature, saveCsv, saveXlsx, type ExportFormat, type ExportQuery } from '@/lib/exports'
import { isComplete, type Condition } from '@/lib/filters'
import type { Column } from '@/lib/list'
import { PAGE_SIZES } from '@/lib/useServerList'

/** Utilitaire d'export : le format, puis tout ou une sélection, avec le nombre de lignes tenu à jour. Les filtres posés ici ne touchent pas à la liste. */
const props = defineProps<{
	title: string
	noun: string
	views: { key: string; label: string }[]
	columns: Column<Row>[]
	/** Vue, filtres et recherche de la liste au moment d'ouvrir. */
	initial: ExportQuery
	filtered: boolean
	fetchRows: (query: ExportQuery, start: number, pageLength: number) => Promise<{ rows: Row[]; total: number }>
}>()
const emit = defineEmits<{ close: []; done: [message: string] }>()

const format = ref<ExportFormat>('xlsx')
const scope = ref<'all' | 'filtered'>(props.filtered ? 'filtered' : 'all')
const view = ref(props.initial.view)
// Un filtre resté sans valeur dans la liste ne filtre rien : il n'encombre pas la fenêtre.
const conditions = ref<Condition[]>(props.initial.conditions.filter(isComplete).map((condition) => ({ ...condition })))
const search = ref(props.initial.search.trim())

const query = computed<ExportQuery>(() => (scope.value === 'all' ? EVERYTHING : { view: view.value, conditions: conditions.value, search: search.value }))
const count = ref<number | null>(null)
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
	if (busy.value || !count.value) return
	busy.value = true
	error.value = ''
	try {
		const rows: Row[] = []
		const pageLength = Math.max(...PAGE_SIZES)
		const asked = { ...query.value }
		for (let start = 0; ; start += pageLength) {
			const response = await props.fetchRows(asked, start, pageLength)
			rows.push(...response.rows)
			if (rows.length >= response.total || !response.rows.length) break
		}
		const name = exportFileName(props.noun, format.value)
		if (format.value === 'csv') saveCsv(rows, props.columns, name)
		else {
			const { headers, cells } = exportTable(rows, props.columns)
			saveXlsx(await exportXlsx(props.title, headers, cells), name)
		}
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
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<span class="field-label mb-0">Format</span>
				<div class="seg self-start" role="group" aria-label="Format du fichier">
					<button type="button" :aria-pressed="format === 'xlsx'" @click="format = 'xlsx'">Excel (.xlsx)</button>
					<button type="button" :aria-pressed="format === 'csv'" @click="format = 'csv'">CSV (.csv)</button>
				</div>
			</div>

			<fieldset class="flex flex-col gap-1.5">
				<legend class="field-label mb-1">Lignes à exporter</legend>
				<label class="export-choice"><input v-model="scope" type="radio" name="export-scope" value="all" /> Tout exporter</label>
				<label class="export-choice"><input v-model="scope" type="radio" name="export-scope" value="filtered" /> Appliquer des filtres</label>
			</fieldset>

			<div v-if="scope === 'filtered'" class="flex flex-col gap-2">
				<label class="flex flex-col gap-1">
					<span class="field-label mb-0">Afficher</span>
					<select v-model="view" class="field-input" aria-label="Vue à exporter">
						<option v-for="item in views" :key="item.key" :value="item.key">{{ item.label }}</option>
					</select>
				</label>
				<slot name="filters" :conditions="conditions" :update="(value: Condition[]) => (conditions = value)"></slot>
				<button v-if="search" type="button" class="filter-chip self-start" :aria-label="`Retirer la recherche ${search}`" @click="search = ''">Recherche : {{ search }} ×</button>
			</div>

			<p class="text-sm text-ink-gray-6">Le fichier reprend les {{ columns.length }} colonnes affichées dans la liste.</p>
			<p v-if="countError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">Le nombre de lignes n'a pas pu être calculé : {{ countError }}</p>
			<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		</div>

		<template #hint>
			<span class="flex-auto text-sm font-medium text-ink-gray-9" role="status">{{ count === null ? (countError ? '' : 'Calcul du nombre de lignes…') : countText(count, noun) }}</span>
		</template>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy || !count" @click="submit">{{ busy ? 'Export…' : 'Exporter' }}</button>
		</template>
	</FormDialog>
</template>
