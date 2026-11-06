<script setup lang="ts" generic="Row extends { name: string; modified: string }">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots, watch, type CSSProperties, type Ref } from 'vue'
import LucideArrowDown from '~icons/lucide/arrow-down'
import LucideArrowUp from '~icons/lucide/arrow-up'
import LucideArrowUpDown from '~icons/lucide/arrow-up-down'
import LucideCheck from '~icons/lucide/check'
import LucideColumns3 from '~icons/lucide/columns-3'
import LucideDownload from '~icons/lucide/download'
import LucideEllipsisVertical from '~icons/lucide/ellipsis-vertical'
import LucideListFilter from '~icons/lucide/list-filter'
import LucidePlus from '~icons/lucide/plus'
import LucideRefreshCw from '~icons/lucide/refresh-cw'
import LucideSearch from '~icons/lucide/search'
import LucideX from '~icons/lucide/x'
import ListPager from '@shared/components/ListPager.vue'
import ListState from '@shared/components/ListState.vue'
import AppToast from './AppToast.vue'
import BulkBar from './BulkBar.vue'
import ExportDialog from './ExportDialog.vue'
import { rangeToggle } from '@/lib/bulk'
import { saveCsv, type ExportQuery } from '@/lib/exports'
import { isComplete, type Condition } from '@/lib/filters'
import { gridTemplate, minListWidth, nextSort, type Column, type Sort } from '@/lib/list'
import { useBulk } from '@/lib/useBulk'
import { PAGE_SIZES } from '@/lib/useServerList'

export interface ListView {
	key: string
	label: string
}

/** Gabarit de toutes les listes du poste : barre d'outils, filtres, plateau de lignes et pied. */
const props = defineProps<{
	state: {
		view: Ref<string>
		search: Ref<string>
		conditions: Ref<Condition[]>
		sort: Ref<Sort | null>
		page: Ref<number>
		pageSize: Ref<number>
		response: Ref<unknown>
		total: Ref<number>
		loading: Ref<boolean>
		error: Ref<string>
		load: () => unknown
		goToPage: (page: number) => unknown
		setPageSize: (size: number) => unknown
	}
	rows: Row[]
	title: string
	/** Nom d'une ligne au singulier, pour les messages : « ticket ». */
	noun: string
	searchLabel: string
	searchPlaceholder: string
	createLabel: string
	columns: Column<Row>[]
	visibleOf: (keys: string[]) => Column<Row>[]
	defaultColumns: string[]
	columnsKey: string
	views: ListView[]
	counts?: Record<string, number>
	defaultSortLabel: string
	sortText: string
	conditionLabel: (condition: Condition) => string
	fetchRows: (query: ExportQuery, start: number, pageLength: number) => Promise<{ rows: Row[]; total: number }>
	selected?: string
	created?: string
	loadError?: string
	/** DocType des lignes : le déclarer ajoute les cases à cocher et les actions groupées. Il doit figurer dans `bureau_bulk.BULK_DOCTYPES`. */
	bulkDoctype?: string
}>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string]; create: []; changed: [] }>()
const checked = defineModel<Set<string>>('checked', { default: () => new Set<string>() })
const slots = useSlots()
const hasRowMenu = computed(() => Boolean(slots.rowMenu))

const list = ref<HTMLElement | null>(null)
const filtersOpen = ref(false)
const defaultView = computed(() => props.views[0].key)

// Colonnes affichées : le choix reste sur cet appareil.
function savedColumns() {
	try {
		const saved = JSON.parse(localStorage.getItem(props.columnsKey) || 'null')
		return Array.isArray(saved) ? (saved as string[]) : props.defaultColumns
	} catch {
		return props.defaultColumns
	}
}
const columnKeys = ref<string[]>(savedColumns())
const shown = computed(() => props.visibleOf(columnKeys.value))
const innerStyle = computed(() => ({ minWidth: `${minListWidth(shown.value)}px` }))
const colsStyle = computed(() => ({ gridTemplateColumns: gridTemplate(shown.value) }))
function toggleColumn(key: string) {
	columnKeys.value = columnKeys.value.includes(key) ? columnKeys.value.filter((item) => item !== key) : [...columnKeys.value, key]
	try {
		localStorage.setItem(props.columnsKey, JSON.stringify(columnKeys.value))
	} catch {
		// Stockage indisponible : le choix vaut pour cette session.
	}
}
const sortColumns = computed(() => props.columns.filter((column) => column.sortable))

// Menus de la barre d'outils et de la ligne.
const menu = ref<'sort' | 'columns' | null>(null)
const rowMenu = ref<{ row: Row; style: CSSProperties } | null>(null)
function closeMenus() {
	menu.value = null
	rowMenu.value = null
}
function onPointerDown(event: PointerEvent) {
	if (!(event.target as HTMLElement).closest?.('.list-menu')) closeMenus()
}
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') closeMenus()
}
const ROW_MENU_HEIGHT = 170
/** Position fixe : la zone de défilement de la liste couperait un menu ordinaire. */
function toggleRowMenu(row: Row, event: MouseEvent) {
	if (rowMenu.value?.row.name === row.name) {
		rowMenu.value = null
		return
	}
	menu.value = null
	const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
	const below = box.bottom + ROW_MENU_HEIGHT < window.innerHeight
	rowMenu.value = {
		row,
		style: {
			position: 'fixed',
			left: 'auto',
			right: `${window.innerWidth - box.right}px`,
			top: below ? `${box.bottom + 4}px` : 'auto',
			bottom: below ? 'auto' : `${window.innerHeight - box.top + 4}px`,
		},
	}
}

// Filtres : la vue en est un, proposé en premier.
const activeConditions = computed(() => props.state.conditions.value.filter(isComplete))
const viewFiltered = computed(() => props.state.view.value !== defaultView.value)
const viewLabel = computed(() => props.views.find((view) => view.key === props.state.view.value)?.label ?? '')
const filterCount = computed(() => activeConditions.value.length + (viewFiltered.value ? 1 : 0))
const searching = computed(() => Boolean(props.state.search.value.trim() || activeConditions.value.length))
function viewOption(view: ListView) {
	const count = props.counts?.[view.key]
	return count === undefined ? view.label : `${view.label} (${count})`
}
function clearSearch() {
	props.state.search.value = ''
	props.state.conditions.value = []
}
function clearFilters() {
	props.state.conditions.value = []
	props.state.view.value = defaultView.value
}
function removeCondition(id: number) {
	props.state.conditions.value = props.state.conditions.value.filter((condition) => condition.id !== id)
}

// Tri.
const sortColumn = computed(() => props.columns.find((column) => column.key === props.state.sort.value?.key))
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

// Sélection : seules les lignes visibles comptent, une action ne touche jamais une ligne cachée.
const selectable = computed(() => Boolean(props.bulkDoctype))
const picked = computed(() => props.rows.filter((row) => checked.value.has(row.name)))
const pickedCount = computed(() => picked.value.length)
const allPicked = computed(() => props.rows.length > 0 && pickedCount.value === props.rows.length)
let anchor: string | null = null
let shiftHeld = false
function clearPicked() {
	checked.value = new Set()
	anchor = null
}
/** Bascule une ligne ; avec Shift, tout l'intervalle depuis la dernière ligne cochée, comme sur le Desk. */
function toggle(name: string) {
	const from = shiftHeld ? anchor : null
	shiftHeld = false
	checked.value = rangeToggle(props.rows.map((row) => row.name), checked.value, from, name)
	anchor = name
}
function toggleAll() {
	checked.value = new Set(allPicked.value ? [] : props.rows.map((row) => row.name))
}
/** Ctrl + clic sur la ligne coche au lieu d'ouvrir l'aperçu. */
function onRowClick(name: string, event: MouseEvent) {
	if (selectable.value && (event.ctrlKey || event.metaKey)) toggle(name)
	else emit('pick', name)
}
const bulk = useBulk({ clear: clearPicked, changed: () => emit('changed') })
function onDeleted(names: string[]) {
	if (props.selected && names.includes(props.selected)) emit('pick')
}

// La ligne ouverte reste visible. Les rechargements en arrière-plan ne bougent pas la liste.
let revealed = false
async function revealSelected() {
	await nextTick()
	const row = list.value?.querySelector<HTMLElement>('[aria-current="true"]')
	row?.scrollIntoView?.({ block: 'nearest' })
	// Le focus suit la ligne ouverte : Entrée ne rouvre pas l'ancienne après un passage au clavier.
	if (document.activeElement?.closest('.list-row-main')) row?.focus({ preventScroll: true })
}
watch(() => props.selected, revealSelected)
watch(props.state.response, () => {
	if (!revealed) {
		revealed = true
		revealSelected()
	}
})
// Changer de vue ou de page vide la sélection, et ramène en haut, ou sur la ligne ouverte une fois la page chargée.
watch([props.state.view, props.state.page], () => {
	revealed = false
	list.value?.scrollTo?.({ top: 0 })
	if (selectable.value) clearPicked()
})
// Une recherche, un filtre ou un tri aussi : une ligne sortie de la vue ne doit pas revenir cochée.
watch([props.state.search, props.state.conditions, props.state.sort, props.state.pageSize], () => {
	if (selectable.value) clearPicked()
})
// Une ligne disparue après un rechargement (supprimée, sortie de la vue) ne reste pas dans la sélection.
watch(
	() => props.rows,
	(rows) => {
		if (!checked.value.size) return
		const names = new Set(rows.map((row) => row.name))
		const kept = [...checked.value].filter((name) => names.has(name))
		if (kept.length !== checked.value.size) checked.value = new Set(kept)
	},
)
async function revealCreated() {
	await nextTick()
	list.value?.querySelector('.list-row-created')?.scrollIntoView?.({ block: 'nearest' })
}
defineExpose({ revealCreated })

/** Export des lignes cochées, sans passer par la fenêtre : elles sont déjà choisies. */
function downloadSelection(rows: Row[], suffix: string) {
	saveCsv(rows, shown.value, `${props.noun}s-${suffix}.csv`)
}

// Export : une fenêtre dédiée, ouverte sur la vue, les filtres et la recherche de la liste.
const exportOpen = ref(false)
const exported = ref('')
const exportFiltered = computed(() => viewFiltered.value || activeConditions.value.length > 0 || Boolean(props.state.search.value.trim()))

onMounted(() => {
	document.addEventListener('pointerdown', onPointerDown)
	document.addEventListener('keydown', onKeydown)
	list.value?.addEventListener('scroll', closeMenus, { passive: true })
})
onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onPointerDown)
	document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
	<section :aria-label="`Liste des ${noun}s`" class="bureau-list">
		<div class="page-head">
			<h1 class="page-title">{{ title }}</h1>
		</div>

		<div class="bureau-toolbar">
			<label class="bureau-search">
				<LucideSearch class="h-3.5 w-3.5" aria-hidden="true" />
				<input v-model="state.search.value" class="field-input" type="search" :aria-label="searchLabel" :placeholder="searchPlaceholder" />
			</label>
			<span class="flex-auto"></span>
			<button type="button" class="btn-secondary shrink-0" :class="{ 'btn-on': filterCount > 0 }" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
				<LucideListFilter class="h-3.5 w-3.5" aria-hidden="true" />
				Filtres
				<span v-if="filterCount" class="btn-count">{{ filterCount }}</span>
			</button>
			<div class="list-menu relative flex-none">
				<button type="button" class="btn-secondary" :class="sortColumn && 'btn-on'" aria-haspopup="menu" :aria-expanded="menu === 'sort'" @click="menu = menu === 'sort' ? null : 'sort'">
					<template v-if="sortColumn">
						<LucideArrowUp v-if="state.sort.value?.dir === 'asc'" class="h-3.5 w-3.5" aria-hidden="true" />
						<LucideArrowDown v-else class="h-3.5 w-3.5" aria-hidden="true" />
						{{ sortColumn.label }}
					</template>
					<template v-else>
						<LucideArrowUpDown class="h-3.5 w-3.5" aria-hidden="true" />
						Trier
					</template>
				</button>
				<div v-if="menu === 'sort'" class="app-menu app-menu-right" role="menu">
					<button v-for="column in sortColumns" :key="column.key" type="button" class="app-menu-item" role="menuitem" @click="setSort(column.key)">
						<span class="flex-auto" :class="state.sort.value?.key === column.key && 'font-semibold text-ink-gray-9'">{{ column.label }}</span>
						<LucideArrowUp v-if="state.sort.value?.key === column.key && state.sort.value.dir === 'asc'" class="h-3.5 w-3.5" aria-label="croissant" />
						<LucideArrowDown v-else-if="state.sort.value?.key === column.key" class="h-3.5 w-3.5" aria-label="décroissant" />
					</button>
					<div class="app-menu-sep"></div>
					<button type="button" class="app-menu-item" role="menuitem" :disabled="!state.sort.value" @click="state.sort.value = null; menu = null">{{ defaultSortLabel }}</button>
				</div>
			</div>
			<div class="list-menu relative flex-none">
				<button type="button" class="icon-btn" aria-label="Choisir les colonnes" title="Colonnes" aria-haspopup="menu" :aria-expanded="menu === 'columns'" @click="menu = menu === 'columns' ? null : 'columns'">
					<LucideColumns3 class="h-4 w-4" aria-hidden="true" />
				</button>
				<div v-if="menu === 'columns'" class="app-menu app-menu-right" role="menu">
					<p class="app-menu-title">Colonnes affichées</p>
					<button v-for="column in columns" :key="column.key" type="button" class="app-menu-item" role="menuitemcheckbox" :aria-checked="shown.includes(column)" :disabled="column.key === 'client'" @click="toggleColumn(column.key)">
						<LucideCheck class="h-3.5 w-3.5" :class="!shown.includes(column) && 'invisible'" aria-hidden="true" />
						{{ column.label }}
					</button>
				</div>
			</div>
			<button type="button" class="btn-secondary" @click="exportOpen = true">
				<LucideDownload class="h-3.5 w-3.5" aria-hidden="true" />
				Exporter
			</button>
			<button type="button" class="icon-btn" aria-label="Actualiser la liste" title="Actualiser" :disabled="state.loading.value" @click="state.load()">
				<LucideRefreshCw class="h-4 w-4" :class="state.loading.value && 'animate-spin'" aria-hidden="true" />
			</button>
			<button type="button" class="btn-primary" @click="emit('create')">
				<LucidePlus class="h-3.5 w-3.5" aria-hidden="true" />
				{{ createLabel }}
			</button>

			<div v-if="filtersOpen" class="bureau-popover" role="group" aria-label="Filtres combinés">
				<label class="flex flex-col gap-1">
					<span class="field-label mb-0">Afficher</span>
					<select v-model="state.view.value" class="field-input" aria-label="Afficher">
						<option v-for="view in views" :key="view.key" :value="view.key">{{ viewOption(view) }}</option>
					</select>
				</label>
				<slot name="filters" :conditions="state.conditions.value" :update="(value: Condition[]) => (state.conditions.value = value)"></slot>
				<button type="button" class="btn-primary self-end" @click="filtersOpen = false">Fermer</button>
			</div>
		</div>

		<div v-if="filterCount" class="flex flex-none flex-wrap items-center gap-1.5">
			<button v-if="viewFiltered" type="button" class="filter-chip" :aria-label="`Retirer le filtre ${viewLabel}`" @click="state.view.value = defaultView">
				{{ viewLabel }}
				<LucideX class="h-3 w-3" aria-hidden="true" />
			</button>
			<button v-for="condition in activeConditions" :key="condition.id" type="button" class="filter-chip" :aria-label="`Retirer le filtre ${conditionLabel(condition)}`" @click="removeCondition(condition.id)">
				{{ conditionLabel(condition) }}
				<LucideX class="h-3 w-3" aria-hidden="true" />
			</button>
			<button type="button" class="px-1 text-sm text-link" @click="clearFilters">Tout effacer</button>
		</div>

		<p v-if="state.error.value || loadError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5 text-sm">
			{{ state.error.value || loadError }}
			<button v-if="state.error.value" type="button" class="ml-1 font-semibold underline" @click="state.load()">Réessayer</button>
		</p>

		<div class="bureau-list-area">
			<div class="bureau-list-card">
				<div ref="list" class="bureau-list-scroll">
					<div :style="innerStyle">
						<div class="list-head" :class="!selectable && 'list-no-check'">
							<label v-if="selectable" class="list-check">
								<input type="checkbox" :aria-label="`Sélectionner tous les ${noun}s de la page`" :checked="allPicked" :indeterminate="pickedCount > 0 && !allPicked" :disabled="!rows.length" @change="toggleAll" />
							</label>
							<div class="list-cols" :style="colsStyle">
								<!-- La première colonne, toujours affichée, porte le nombre de lignes de la vue. -->
								<template v-for="(column, position) in shown" :key="column.key">
									<button v-if="column.sortable" type="button" :class="column.end && 'list-col-end'" :aria-label="`${sortLabel(column.key, column.label)}${position === 0 && state.response.value ? `, ${state.total.value} ${noun}s` : ''}`" @click="setSort(column.key)">
										{{ column.label }}
										<span v-if="position === 0 && state.response.value" class="page-count font-normal">{{ state.total.value }}</span>
										<span aria-hidden="true">{{ arrow(column.key) }}</span>
									</button>
									<span v-else class="list-head-plain gap-1">
										{{ column.label }}
										<span v-if="position === 0 && state.response.value" class="page-count font-normal">{{ state.total.value }}</span>
									</span>
								</template>
							</div>
							<span v-if="hasRowMenu" class="list-more"></span>
						</div>

						<div class="list-tray">
							<template v-if="!state.response.value && !state.error.value">
								<div v-for="index in 8" :key="index" class="list-row" :class="!selectable && 'list-no-check'" aria-hidden="true">
									<span v-if="selectable" class="list-check"></span>
									<div class="list-cols" :style="colsStyle">
										<span v-for="(column, position) in shown" :key="column.key" class="skeleton" :style="{ width: position === 0 ? '70%' : `${40 + ((index * 13 + position * 17) % 45)}%` }"></span>
									</div>
									<span v-if="hasRowMenu" class="list-more"></span>
								</div>
								<p class="sr-only" role="status">Chargement de la liste…</p>
							</template>
							<ListState v-else-if="!state.response.value" title="Rien à afficher pour le moment" text="Réessayez dans un instant. Vos filtres sont conservés." />
							<ListState v-else-if="!rows.length && searching" title="Aucun résultat" :text="`Aucun ${noun} ne correspond à la recherche et aux filtres.`">
								<button type="button" class="btn-secondary" @click="clearSearch">Effacer la recherche et les filtres</button>
							</ListState>
							<ListState v-else-if="!rows.length" dieline title="Rien dans cette vue" :text="`Les ${noun}s apparaîtront ici dès qu'ils correspondront à cette vue.`" />

							<div v-for="row in rows" :key="row.name" class="list-row" :class="{ 'list-no-check': !selectable, 'list-row-on list-row-created': row.name === created, 'list-row-on': row.name === selected, 'list-row-checked': checked.has(row.name) }">
								<label v-if="selectable" class="list-check">
									<input type="checkbox" :aria-label="`Sélectionner le ${noun} ${row.name}`" :checked="checked.has(row.name)" @click="shiftHeld = $event.shiftKey" @change="toggle(row.name)" />
								</label>
								<button type="button" class="list-cols list-row-main" :style="colsStyle" :aria-current="row.name === selected ? 'true' : undefined" @click="onRowClick(row.name, $event)" @dblclick="emit('open', row.name)">
									<slot name="cells" :row="row" :columns="shown"></slot>
								</button>
								<div v-if="hasRowMenu" class="list-more list-menu">
									<button type="button" class="list-more-btn" :aria-label="`Actions : ${row.name}`" aria-haspopup="menu" :aria-expanded="rowMenu?.row.name === row.name" @click="toggleRowMenu(row, $event)">
										<LucideEllipsisVertical class="h-3.5 w-3.5" aria-hidden="true" />
									</button>
									<div v-if="rowMenu?.row.name === row.name" class="app-menu" role="menu" :style="rowMenu.style" @click="rowMenu = null">
										<slot name="rowMenu" :row="row" :bulk="bulk"></slot>
									</div>
								</div>
							</div>
						</div>
					</div>
					<!-- La barre flottante ne doit pas cacher les dernières lignes. -->
					<div v-if="selectable && pickedCount" class="h-[72px]" aria-hidden="true"></div>
				</div>
				<ListPager :total="state.total.value" :page="state.page.value" :page-size="state.pageSize.value" :sizes="PAGE_SIZES" :sort-label="sortText" :disabled="state.loading.value" @update:page="state.goToPage" @update:page-size="state.setPageSize" />
			</div>

			<BulkBar v-if="bulkDoctype" :doctype="bulkDoctype" :noun="noun" :picked="picked" :bulk="bulk" @clear="clearPicked" @export="downloadSelection(picked, 'selection')" @deleted="onDeleted">
				<template v-if="$slots.bulkActions" #default><slot name="bulkActions" :picked="picked" :bulk="bulk"></slot></template>
			</BulkBar>
			<slot name="drawer"></slot>
		</div>

		<ExportDialog
			v-if="exportOpen"
			:title="title"
			:noun="noun"
			:views="views"
			:columns="shown"
			:initial="{ view: state.view.value, conditions: state.conditions.value, search: state.search.value }"
			:filtered="exportFiltered"
			:fetch-rows="fetchRows"
			@close="exportOpen = false"
			@done="exported = $event; exportOpen = false"
		>
			<template #filters="slotProps"><slot name="filters" v-bind="slotProps"></slot></template>
		</ExportDialog>
		<AppToast :message="exported" @close="exported = ''" />
		<slot></slot>
	</section>
</template>
