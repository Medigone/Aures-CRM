/** État d'une liste paginée côté serveur. Il survit à l'ouverture d'une fiche, qui s'en sert pour aller à la ligne voisine. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { Condition } from './filters'
import { isComplete } from './filters'
import type { Sort } from './list'

// Au retour sur l'onglet, la liste est rechargée : le Desk a pu la modifier.
const MIN_FOCUS_INTERVAL = 30_000

export const PAGE_SIZES = [20, 100, 500] as const
export const DEFAULT_PAGE_SIZE = 20

export interface ListPaging {
	start?: number
	pageLength?: number
	sort?: string
	direction?: 'asc' | 'desc'
}

export interface ListResponse {
	total: number
	start: number
	names: string[]
}

function savedPageSize(key: string) {
	try {
		const saved = Number(localStorage.getItem(key))
		return (PAGE_SIZES as readonly number[]).includes(saved) ? saved : DEFAULT_PAGE_SIZE
	} catch {
		return DEFAULT_PAGE_SIZE
	}
}

export function useServerList<Response extends ListResponse, View extends string>(options: {
	view: View
	page?: number
	pageSizeKey: string
	fetch: (view: View, conditions: Condition[], search: string, paging: ListPaging) => Promise<Response>
}) {
	const view = ref(options.view) as Ref<View>
	const search = ref('')
	const conditions = ref<Condition[]>([])
	const sort = ref<Sort | null>(null)
	const page = ref(options.page ?? 0)
	const pageSize = ref(savedPageSize(options.pageSizeKey))
	const response = ref(null) as Ref<Response | null>
	const loading = ref(false)
	const error = ref('')
	const names = computed(() => response.value?.names ?? [])
	const total = computed(() => response.value?.total ?? 0)

	// Une seule réponse compte : celle de la dernière demande.
	let lastRequest = 0
	async function load() {
		const request = ++lastRequest
		loading.value = true
		error.value = ''
		try {
			const result = await options.fetch(view.value, conditions.value, search.value, {
				start: page.value * pageSize.value,
				pageLength: pageSize.value,
				sort: sort.value?.key,
				direction: sort.value?.dir,
			})
			if (request !== lastRequest) return
			response.value = result
			// La page demandée a pu disparaître : le serveur renvoie la dernière qui existe.
			page.value = Math.floor(result.start / pageSize.value)
		} catch (e) {
			if (request === lastRequest) error.value = (e as Error).message
		} finally {
			if (request === lastRequest) loading.value = false
		}
	}
	// Saisie : on attend la fin de la frappe. Les filtres incomplets ne changent pas le résultat.
	let timer: ReturnType<typeof setTimeout> | null = null
	function loadSoon() {
		if (timer) clearTimeout(timer)
		timer = setTimeout(load, 250)
	}
	function firstPage() {
		page.value = 0
	}
	// La vue active reprise à l'ouverture ne compte pas comme un changement : la page de l'adresse reste valable.
	let restoring = false
	function restore(layout: { view?: string; sort: Sort | null; conditions: Condition[] }) {
		restoring = true
		if (layout.view !== undefined) view.value = layout.view as View
		sort.value = layout.sort
		conditions.value = layout.conditions
		nextTick(() => {
			restoring = false
		})
	}
	watch(view, () => {
		if (restoring) return
		firstPage()
		load()
	})
	watch(sort, () => {
		if (restoring) return
		firstPage()
		load()
	})
	watch(search, () => {
		firstPage()
		loadSoon()
	})
	const signature = computed(() => JSON.stringify(conditions.value.filter(isComplete).map(({ doctype, field, op, value }) => [doctype, field, op, value])))
	watch(signature, () => {
		if (restoring) return
		firstPage()
		loadSoon()
	})

	function goToPage(next: number) {
		page.value = Math.max(next, 0)
		return load()
	}
	function setPageSize(size: number) {
		pageSize.value = size
		try {
			localStorage.setItem(options.pageSizeKey, String(size))
		} catch {
			// Stockage indisponible : le choix vaut pour cette session.
		}
		goToPage(0)
	}
	/** Amène à la page de la ligne donnée, quand on y arrive depuis une fiche ou l'aperçu. */
	function reveal(name: string) {
		const index = names.value.indexOf(name)
		if (index < 0) return
		const target = Math.floor(index / pageSize.value)
		return target === page.value ? undefined : goToPage(target)
	}

	let lastFocusLoad = Date.now()
	function onFocus() {
		if (Date.now() - lastFocusLoad < MIN_FOCUS_INTERVAL) return
		lastFocusLoad = Date.now()
		load()
	}
	onMounted(() => {
		window.addEventListener('focus', onFocus)
		load()
	})
	onBeforeUnmount(() => {
		window.removeEventListener('focus', onFocus)
		if (timer) clearTimeout(timer)
	})

	return { view, search, conditions, sort, page, pageSize, response, names, total, loading, error, load, goToPage, setPageSize, reveal, restore }
}
