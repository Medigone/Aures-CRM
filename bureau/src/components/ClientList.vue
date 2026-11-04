<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideArrowDown from '~icons/lucide/arrow-down'
import LucideArrowUp from '~icons/lucide/arrow-up'
import LucideArrowUpDown from '~icons/lucide/arrow-up-down'
import LucideCheck from '~icons/lucide/check'
import LucideColumns3 from '~icons/lucide/columns-3'
import LucideDownload from '~icons/lucide/download'
import LucideListFilter from '~icons/lucide/list-filter'
import LucidePlus from '~icons/lucide/plus'
import LucideRefreshCw from '~icons/lucide/refresh-cw'
import LucideX from '~icons/lucide/x'
import ListPager from '@shared/components/ListPager.vue'
import ListState from '@shared/components/ListState.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import ClientDialog from './ClientDialog.vue'
import FilterBuilder from './FilterBuilder.vue'
import { getClientOptions, getClients } from '@/lib/api'
import { CLIENT_COLUMNS, CLIENT_FILTER_FIELDS, CLIENT_VIEWS, clientConditionLabel, clientFilterChoices, clientSortText, DEFAULT_CLIENT_COLUMNS, formatAmount, visibleClientColumns, type ClientOptions } from '@/lib/clients'
import { formatDay } from '@/lib/display'
import { isComplete } from '@/lib/filters'
import { gridTemplate, minListWidth, nextSort, ticketsToCsv } from '@/lib/list'
import type { ClientsState } from '@/lib/useClients'
import { PAGE_SIZES } from '@/lib/useServerList'

const props = defineProps<{ state: ClientsState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string] }>()

const list = ref<HTMLElement | null>(null)
const options = ref<ClientOptions | null>(null)
const optionsError = ref('')
const filtersOpen = ref(false)
const COLUMNS_KEY = 'bureau-clients-colonnes'

// Colonnes affichées : le choix reste sur cet appareil.
function savedColumns() {
	try {
		const saved = JSON.parse(localStorage.getItem(COLUMNS_KEY) || 'null')
		return Array.isArray(saved) ? (saved as string[]) : DEFAULT_CLIENT_COLUMNS
	} catch {
		return DEFAULT_CLIENT_COLUMNS
	}
}
const columnKeys = ref<string[]>(savedColumns())
const columns = computed(() => visibleClientColumns(columnKeys.value))
const rowStyle = computed(() => ({ minWidth: `${minListWidth(columns.value)}px` }))
const colsStyle = computed(() => ({ gridTemplateColumns: gridTemplate(columns.value) }))
function toggleColumn(key: string) {
	columnKeys.value = columnKeys.value.includes(key) ? columnKeys.value.filter((item) => item !== key) : [...columnKeys.value, key]
	try {
		localStorage.setItem(COLUMNS_KEY, JSON.stringify(columnKeys.value))
	} catch {
		// Stockage indisponible : le choix vaut pour cette session.
	}
}

const menu = ref<'sort' | 'columns' | null>(null)
function onPointerDown(event: PointerEvent) {
	if (menu.value && !(event.target as HTMLElement).closest?.('.list-menu')) menu.value = null
}
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') menu.value = null
}

const activeConditions = computed(() => props.state.conditions.value.filter(isComplete))
const filtersLabel = computed(() => (activeConditions.value.length ? `Filtres (${activeConditions.value.length})` : 'Filtres'))
const searching = computed(() => Boolean(props.state.search.value.trim() || activeConditions.value.length))
function clearSearch() {
	props.state.search.value = ''
	props.state.conditions.value = []
}
function removeCondition(id: number) {
	props.state.conditions.value = props.state.conditions.value.filter((condition) => condition.id !== id)
}
const views = computed(() => CLIENT_VIEWS.map((item) => ({ ...item, count: props.state.response.value?.counts[item.key] ?? 0 })))
const END_COLUMNS = new Set(['creance', 'tickets'])

function setSort(key: string) {
	props.state.sort.value = nextSort(props.state.sort.value, key)
}
function arrow(key: string) {
	const sort = props.state.sort.value
	return sort?.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : ''
}
function sortLabel(key: string, label: string) {
	const sort = props.state.sort.value
	return sort?.key === key ? `${label}, tri ${sort.dir === 'asc' ? 'croissant' : 'décroissant'}` : `Trier par ${label}`
}

// La ligne ouverte reste visible. Les rechargements en arrière-plan ne bougent pas la liste.
let revealed = false
async function revealSelected() {
	await nextTick()
	list.value?.querySelector('[aria-current="true"]')?.scrollIntoView?.({ block: 'nearest' })
}
watch(() => props.selected, revealSelected)
watch(props.state.response, () => {
	if (!revealed) {
		revealed = true
		revealSelected()
	}
})
watch([props.state.view, props.state.page], () => list.value?.scrollTo?.({ top: 0 }))

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
	await nextTick()
	list.value?.querySelector('.list-row-created')?.scrollIntoView?.({ block: 'nearest' })
}
function openCreated() {
	const name = created.value
	dismissCreated()
	if (name) emit('open', name)
}

// Export : toute la vue, page après page, avec les colonnes affichées.
const exporting = ref(false)
const exportError = ref('')
async function exportView() {
	if (exporting.value) return
	exporting.value = true
	exportError.value = ''
	const state = props.state
	try {
		const rows = []
		const pageLength = Math.max(...PAGE_SIZES)
		for (let start = 0; ; start += pageLength) {
			const response = await getClients(state.view.value, state.conditions.value, state.search.value, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
			rows.push(...response.clients)
			if (rows.length >= response.total || !response.clients.length) break
		}
		const url = URL.createObjectURL(new Blob([ticketsToCsv(rows, columns.value)], { type: 'text/csv;charset=utf-8' }))
		const link = document.createElement('a')
		link.href = url
		link.download = `clients-${state.view.value}.csv`
		link.click()
		URL.revokeObjectURL(url)
	} catch (e) {
		exportError.value = `L'export a échoué : ${(e as Error).message}`
	} finally {
		exporting.value = false
	}
}

onMounted(async () => {
	document.addEventListener('pointerdown', onPointerDown)
	document.addEventListener('keydown', onKeydown)
	try {
		options.value = await getClientOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onPointerDown)
	document.removeEventListener('keydown', onKeydown)
	if (createdTimer) clearTimeout(createdTimer)
})
</script>

<template>
	<section aria-label="Liste des clients" class="bureau-list">
		<div class="page-head">
			<h1 class="page-title">Clients</h1>
			<span class="page-count">{{ state.response.value ? state.total.value : '' }}</span>
			<span class="flex-auto"></span>
			<button type="button" class="btn-secondary" :disabled="exporting || !state.total.value" @click="exportView">
				<LucideDownload class="h-3.5 w-3.5" aria-hidden="true" />
				{{ exporting ? 'Export…' : 'Exporter' }}
			</button>
			<button type="button" class="btn-primary" @click="creating = true">
				<LucidePlus class="h-3.5 w-3.5" aria-hidden="true" />
				Nouveau prospect
			</button>
		</div>

		<div class="bureau-toolbar">
			<div class="views">
				<button v-for="item in views" :key="item.key" type="button" class="view" :aria-pressed="state.view.value === item.key" :aria-label="`${item.label} : ${item.count}`" @click="state.view.value = item.key">
					<span>{{ item.label }}</span>
					<span class="view-count">{{ item.count }}</span>
				</button>
			</div>
			<span class="flex-auto"></span>
			<input v-model="state.search.value" class="field-input bureau-search" type="search" aria-label="Rechercher un client" placeholder="Nom, code, wilaya, contact" />
			<button type="button" class="btn-secondary shrink-0" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
				<LucideListFilter class="h-3.5 w-3.5" aria-hidden="true" />
				{{ filtersLabel }}
			</button>
			<div class="list-menu relative flex-none">
				<button type="button" class="btn-secondary" aria-haspopup="menu" :aria-expanded="menu === 'sort'" @click="menu = menu === 'sort' ? null : 'sort'">
					<LucideArrowUpDown class="h-3.5 w-3.5" aria-hidden="true" />
					Trier
				</button>
				<div v-if="menu === 'sort'" class="app-menu app-menu-right" role="menu">
					<button v-for="column in CLIENT_COLUMNS" :key="column.key" type="button" class="app-menu-item" role="menuitem" @click="setSort(column.key)">
						<span class="flex-auto" :class="state.sort.value?.key === column.key && 'font-semibold text-ink-gray-9'">{{ column.label }}</span>
						<LucideArrowUp v-if="state.sort.value?.key === column.key && state.sort.value.dir === 'asc'" class="h-3.5 w-3.5" aria-label="croissant" />
						<LucideArrowDown v-else-if="state.sort.value?.key === column.key" class="h-3.5 w-3.5" aria-label="décroissant" />
					</button>
					<div class="app-menu-sep"></div>
					<button type="button" class="app-menu-item" role="menuitem" :disabled="!state.sort.value" @click="state.sort.value = null; menu = null">Ordre par nom</button>
				</div>
			</div>
			<div class="list-menu relative flex-none">
				<button type="button" class="icon-btn" aria-label="Choisir les colonnes" title="Colonnes" aria-haspopup="menu" :aria-expanded="menu === 'columns'" @click="menu = menu === 'columns' ? null : 'columns'">
					<LucideColumns3 class="h-4 w-4" aria-hidden="true" />
				</button>
				<div v-if="menu === 'columns'" class="app-menu app-menu-right" role="menu">
					<p class="app-menu-title">Colonnes affichées</p>
					<button v-for="column in CLIENT_COLUMNS" :key="column.key" type="button" class="app-menu-item" role="menuitemcheckbox" :aria-checked="columns.includes(column)" :disabled="column.key === 'client'" @click="toggleColumn(column.key)">
						<LucideCheck class="h-3.5 w-3.5" :class="!columns.includes(column) && 'invisible'" aria-hidden="true" />
						{{ column.label }}
					</button>
				</div>
			</div>
			<button type="button" class="icon-btn" aria-label="Actualiser la liste" :disabled="state.loading.value" @click="state.load()">
				<LucideRefreshCw class="h-4 w-4" :class="state.loading.value && 'animate-spin'" aria-hidden="true" />
			</button>

			<div v-if="filtersOpen" class="bureau-popover" role="group" aria-label="Filtres combinés">
				<FilterBuilder v-model="state.conditions.value" :fields="CLIENT_FILTER_FIELDS" first-field="status" :choices-of="(field) => clientFilterChoices(field, options)" />
				<button type="button" class="btn-primary self-end" @click="filtersOpen = false">Fermer</button>
			</div>
		</div>

		<div v-if="activeConditions.length" class="flex flex-none flex-wrap items-center gap-1.5">
			<button v-for="condition in activeConditions" :key="condition.id" type="button" class="filter-chip" :aria-label="`Retirer le filtre ${clientConditionLabel(condition, options)}`" @click="removeCondition(condition.id)">
				{{ clientConditionLabel(condition, options) }}
				<LucideX class="h-3 w-3" aria-hidden="true" />
			</button>
			<button type="button" class="min-h-[var(--ctl)] px-1 text-sm font-medium text-accent hover:underline" @click="state.conditions.value = []">Tout effacer</button>
		</div>

		<p v-if="state.error.value || optionsError || exportError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5 text-sm">
			{{ state.error.value || optionsError || exportError }}
			<button v-if="state.error.value" type="button" class="ml-1 font-semibold underline" @click="state.load()">Réessayer</button>
		</p>

		<div class="bureau-list-area">
			<div class="bureau-list-card">
				<div ref="list" class="bureau-list-scroll">
					<div class="list-head list-no-check" :style="rowStyle">
						<div class="list-cols" :style="colsStyle">
							<button v-for="column in columns" :key="column.key" type="button" :class="END_COLUMNS.has(column.key) && 'list-col-end'" :aria-label="sortLabel(column.key, column.label)" @click="setSort(column.key)">
								{{ column.label }} <span aria-hidden="true">{{ arrow(column.key) }}</span>
							</button>
						</div>
					</div>

					<template v-if="!state.response.value && !state.error.value">
						<div v-for="index in 8" :key="index" class="list-row list-no-check" :style="rowStyle" aria-hidden="true">
							<div class="list-cols" :style="colsStyle">
								<span v-for="(column, position) in columns" :key="column.key" class="skeleton" :style="{ width: position === 0 ? '70%' : `${40 + ((index * 13 + position * 17) % 45)}%` }"></span>
							</div>
						</div>
						<p class="sr-only" role="status">Chargement de la liste…</p>
					</template>
					<ListState v-else-if="!state.response.value" title="Rien à afficher pour le moment" text="Réessayez dans un instant. Vos filtres sont conservés." />
					<ListState v-else-if="!state.clients.value.length && searching" title="Aucun résultat" text="Aucun client ne correspond à la recherche et aux filtres.">
						<button type="button" class="btn-secondary" @click="clearSearch">Effacer la recherche et les filtres</button>
					</ListState>
					<ListState v-else-if="!state.clients.value.length" dieline title="Rien dans cette vue" text="Les clients apparaîtront ici dès qu'ils correspondront à cette vue." />

					<div v-for="row in state.clients.value" :key="row.name" class="list-row list-no-check" :class="{ 'list-row-on list-row-created': row.name === created, 'list-row-on': row.name === selected }" :style="rowStyle">
						<button type="button" class="list-cols list-row-main" :style="colsStyle" :aria-current="row.name === selected ? 'true' : undefined" @click="emit('pick', row.name)" @dblclick="emit('open', row.name)">
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
						</button>
					</div>
				</div>
				<ListPager :total="state.total.value" :page="state.page.value" :page-size="state.pageSize.value" :sizes="PAGE_SIZES" :sort-label="clientSortText(state.sort.value)" :disabled="state.loading.value" @update:page="state.goToPage" @update:page-size="state.setPageSize" />
			</div>

			<slot name="drawer"></slot>
		</div>

		<ClientDialog v-if="creating" @close="creating = false" @created="onCreated" />
		<div v-if="created" class="toast-action" role="status">
			<span>Prospect créé.</span>
			<button type="button" @click="openCreated">Ouvrir la fiche</button>
		</div>
	</section>
</template>
