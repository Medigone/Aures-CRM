/** Vue active d'une liste. La session suit l'état de la liste : elle survit à l'ouverture d'une fiche, comme les filtres. */
import { computed, ref, type Ref } from 'vue'
import { deleteListView, getListViews, saveListView, setDefaultListView, type SavedListView } from './api'
import type { Condition } from './filters'
import type { Sort } from './list'
import { cleanLayout, layoutSignature, moveColumnBefore, readActiveView, readStandardColumns, resizeColumn, withColumnKeys, writeActiveView, writeStandardColumns, type ColumnSetting, type ListLayout } from './listViews'

export interface ListViewsState {
	view: Ref<string>
	conditions: Ref<Condition[]>
	sort: Ref<Sort | null>
	response: Ref<unknown>
	loading: Ref<boolean>
	load: () => unknown
	restore: (layout: { view?: string; sort: Sort | null; conditions: Condition[] }) => void
}

export interface ListViewsOptions {
	state: ListViewsState
	doctype: string
	columnsKey: string
	defaultColumns: string[]
	locked: string
	defaultView: string
	sortable: string[]
	views: string[]
}

const withIds = (conditions: Omit<Condition, 'id'>[]) => conditions.map((condition, index) => ({ ...condition, id: index + 1 }))

function droppedNotice(count: number) {
	return count ? `${count === 1 ? 'Une colonne ou un filtre de cette vue porte' : `${count} colonnes ou filtres de cette vue portent`} sur un champ indisponible : ${count === 1 ? 'il est ignoré' : 'ils sont ignorés'}.` : ''
}

function createSession(options: ListViewsOptions) {
	const { state, doctype, columnsKey, defaultColumns, locked, defaultView } = options
	const list = { locked, sortable: options.sortable, views: options.views, defaultView, defaultColumns }
	const standard = cleanLayout({ view: defaultView }, list)

	const views = ref<SavedListView[]>([])
	const canShare = ref(false)
	const defaultName = ref<string | null>(null)
	const loaded = ref(false)
	const loadError = ref('')
	const actionError = ref('')
	const notice = ref('')
	const busy = ref(false)
	const activeName = ref<string | null>(null)
	const activeLabel = ref('')
	const baseline = ref<ListLayout>(standard)
	const columns = ref<ColumnSetting[]>([])

	const current = computed<ListLayout>(() => ({ columns: columns.value, sort: state.sort.value, view: state.view.value, conditions: state.conditions.value }))
	const modified = computed(() => layoutSignature(current.value) !== layoutSignature(baseline.value))
	const activeView = computed(() => views.value.find((view) => view.name === activeName.value) ?? null)
	const label = computed(() => (activeName.value ? activeView.value?.label || activeLabel.value : 'Vue standard'))
	const canOverwrite = computed(() => Boolean(activeName.value && activeView.value?.can_edit))
	const mine = computed(() => views.value.filter((view) => !view.is_global))
	const shared = computed(() => views.value.filter((view) => view.is_global))

	function setColumns(next: ColumnSetting[]) {
		columns.value = next
		if (!activeName.value) writeStandardColumns(columnsKey, next)
	}
	function remember(view: SavedListView | null, config?: ListLayout) {
		writeActiveView(columnsKey, view ? { name: view.name, label: view.label, config } : {})
	}

	function apply(view: SavedListView | null, { keepView = false } = {}) {
		const layout = view ? cleanLayout(view.config, list) : { ...standard, columns: cleanLayout({ columns: readStandardColumns(columnsKey, defaultColumns) }, list).columns }
		actionError.value = ''
		notice.value = view ? droppedNotice(view.dropped) : ''
		activeName.value = view?.name ?? null
		activeLabel.value = view?.label ?? ''
		baseline.value = view ? layout : standard
		columns.value = layout.columns
		if (JSON.stringify(state.sort.value) !== JSON.stringify(layout.sort)) state.sort.value = layout.sort
		if (!keepView) state.view.value = layout.view
		state.conditions.value = withIds(layout.conditions)
		remember(view, layout)
	}

	/** Annule les retouches : la vue revient à ce qui est enregistré, et la Vue standard aux colonnes d'origine. */
	function reset() {
		if (!activeName.value) writeStandardColumns(columnsKey, standard.columns)
		apply(activeView.value)
	}

	// Ouverture : la copie de cet appareil s'applique sans attendre le serveur et sans recharger la liste.
	const stored = readActiveView(columnsKey)
	if (stored?.name && stored.config) {
		const layout = cleanLayout(stored.config, list)
		activeName.value = stored.name
		activeLabel.value = stored.label ?? ''
		baseline.value = layout
		columns.value = layout.columns
		const started = Boolean(state.response.value || state.loading.value)
		// Une adresse avec `?vue=` l'emporte sur le choix « Afficher » de la vue.
		state.restore({ view: state.view.value === defaultView ? layout.view : undefined, sort: layout.sort, conditions: withIds(layout.conditions) })
		if (started) state.load()
	} else {
		columns.value = cleanLayout({ columns: readStandardColumns(columnsKey, defaultColumns) }, list).columns
	}
	const openedOn = layoutSignature(current.value)

	async function fetchViews() {
		const response = await getListViews(doctype)
		views.value = response.views
		canShare.value = response.can_share
		defaultName.value = response.default
		loaded.value = true
		loadError.value = ''
		return response
	}

	async function open() {
		try {
			const response = await fetchViews()
			const byDefault = response.views.find((view) => view.name === response.default) ?? null
			if (activeName.value) {
				const found = activeView.value
				if (!found) {
					apply(byDefault)
					return
				}
				const fresh = cleanLayout(found.config, list)
				activeLabel.value = found.label
				if (layoutSignature(fresh) !== layoutSignature(baseline.value)) {
					if (modified.value) baseline.value = fresh
					else apply(found, { keepView: state.view.value !== fresh.view && state.view.value !== defaultView })
				} else notice.value = droppedNotice(found.dropped)
				remember(found, fresh)
			} else if (!stored && byDefault && layoutSignature(current.value) === openedOn) {
				apply(byDefault, { keepView: state.view.value !== defaultView })
			}
		} catch (e) {
			loadError.value = `Les vues n'ont pas pu être chargées : ${(e as Error).message}`
		}
	}
	void open()

	/** Enregistre la disposition affichée sous un nouveau nom. L'erreur remonte à la fenêtre, qui reste ouverte. */
	async function saveAs(name: string, isGlobal: boolean, makeDefault: boolean) {
		busy.value = true
		try {
			const fromStandard = !activeName.value
			const layout = current.value
			const created = await saveListView(doctype, name, layout, isGlobal)
			if (makeDefault) await setDefaultListView(doctype, created)
			if (fromStandard) writeStandardColumns(columnsKey, standard.columns)
			activeName.value = created
			activeLabel.value = name.trim()
			baseline.value = cleanLayout(layout, list)
			await fetchViews()
			remember(activeView.value, baseline.value)
			notice.value = ''
		} finally {
			busy.value = false
		}
	}

	async function run(action: () => Promise<unknown>, failure: string) {
		busy.value = true
		actionError.value = ''
		try {
			await action()
			return true
		} catch (e) {
			actionError.value = `${failure} : ${(e as Error).message}`
			return false
		} finally {
			busy.value = false
		}
	}

	const overwrite = () =>
		run(async () => {
			const view = activeView.value
			if (!view) return
			const layout = current.value
			await saveListView(doctype, view.label, layout, view.is_global, view.name)
			baseline.value = cleanLayout(layout, list)
			await fetchViews()
			remember(activeView.value, baseline.value)
		}, "La vue n'a pas pu être enregistrée")

	const rename = (view: SavedListView, name: string) =>
		run(async () => {
			await saveListView(doctype, name, view.config, view.is_global, view.name)
			await fetchViews()
			if (view.name === activeName.value) {
				activeLabel.value = name.trim()
				remember(activeView.value, baseline.value)
			}
		}, "La vue n'a pas pu être renommée")

	const remove = (view: SavedListView) =>
		run(async () => {
			await deleteListView(view.name)
			await fetchViews()
			if (view.name === activeName.value) apply(null)
		}, "La vue n'a pas pu être supprimée")

	/** L'étoile décide aussi de la prochaine ouverture sur cet appareil. */
	const toggleDefault = (view: SavedListView) =>
		run(async () => {
			const next = defaultName.value === view.name ? null : view.name
			await setDefaultListView(doctype, next)
			defaultName.value = next
			if (next) remember(view, cleanLayout(view.config, list))
		}, "La vue par défaut n'a pas pu être enregistrée")

	return {
		columns,
		views,
		mine,
		shared,
		canShare,
		defaultName,
		loaded,
		loadError,
		actionError,
		notice,
		busy,
		activeName,
		activeView,
		label,
		modified,
		canOverwrite,
		current,
		apply,
		reset,
		saveAs,
		overwrite,
		rename,
		remove,
		toggleDefault,
		setColumnKeys: (keys: string[]) => setColumns(withColumnKeys(columns.value, keys, locked)),
		setColumns,
		moveColumn: (key: string, target: string) => setColumns(moveColumnBefore(columns.value, key, target, locked)),
		resize: (key: string, width?: number) => setColumns(resizeColumn(columns.value, key, width)),
	}
}

export type ListViewsSession = ReturnType<typeof createSession>

const sessions = new WeakMap<ListViewsState, ListViewsSession>()

export function useListViews(options: ListViewsOptions) {
	let session = sessions.get(options.state)
	if (!session) {
		session = createSession(options)
		sessions.set(options.state, session)
	}
	return session
}
