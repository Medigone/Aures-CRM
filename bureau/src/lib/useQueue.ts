/** État de la liste : il survit à l'ouverture d'une fiche, qui s'en sert pour aller au ticket voisin. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getQueue } from './api'
import type { Condition } from './filters'
import { isComplete } from './filters'
import type { Sort } from './list'
import type { QueueResponse, QueueView } from '@/types'

// Au retour sur l'onglet, la liste est rechargée : le Desk a pu la modifier.
const MIN_FOCUS_INTERVAL = 30_000

export const PAGE_SIZES = [20, 100, 500] as const
export const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_KEY = 'bureau-tickets-par-page'

function savedPageSize() {
	try {
		const saved = Number(localStorage.getItem(PAGE_SIZE_KEY))
		return (PAGE_SIZES as readonly number[]).includes(saved) ? saved : DEFAULT_PAGE_SIZE
	} catch {
		return DEFAULT_PAGE_SIZE
	}
}

export function useQueue(initial: { view?: QueueView; page?: number } = {}) {
	const view = ref<QueueView>(initial.view ?? 'todo')
	const search = ref('')
	const conditions = ref<Condition[]>([])
	const sort = ref<Sort | null>(null)
	const page = ref(initial.page ?? 0)
	const pageSize = ref(savedPageSize())
	const queue = ref<QueueResponse | null>(null)
	const loading = ref(false)
	const error = ref('')
	const tickets = computed(() => queue.value?.tickets ?? [])
	const names = computed(() => queue.value?.names ?? [])
	const total = computed(() => queue.value?.total ?? 0)

	// Une seule réponse compte : celle de la dernière demande.
	let lastRequest = 0
	async function load() {
		const request = ++lastRequest
		loading.value = true
		error.value = ''
		try {
			const response = await getQueue(view.value, conditions.value, search.value, {
				start: page.value * pageSize.value,
				pageLength: pageSize.value,
				sort: sort.value?.key,
				direction: sort.value?.dir,
			})
			if (request !== lastRequest) return
			queue.value = response
			// La page demandée a pu disparaître : le serveur renvoie la dernière qui existe.
			page.value = Math.floor(response.start / pageSize.value)
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
	watch(view, () => {
		firstPage()
		load()
	})
	watch(sort, () => {
		firstPage()
		load()
	})
	watch(search, () => {
		firstPage()
		loadSoon()
	})
	const signature = computed(() => JSON.stringify(conditions.value.filter(isComplete).map(({ field, op, value }) => [field, op, value])))
	watch(signature, () => {
		firstPage()
		loadSoon()
	})

	function goToPage(next: number) {
		page.value = Math.max(next, 0)
		load()
	}
	function setPageSize(size: number) {
		pageSize.value = size
		try {
			localStorage.setItem(PAGE_SIZE_KEY, String(size))
		} catch {
			// Stockage indisponible : le choix vaut pour cette session.
		}
		goToPage(0)
	}
	/** Amène à la page du ticket donné, quand on y arrive depuis une fiche ou l'aperçu. */
	function reveal(name: string) {
		const index = names.value.indexOf(name)
		if (index < 0) return
		const target = Math.floor(index / pageSize.value)
		if (target !== page.value) goToPage(target)
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

	return { view, search, conditions, sort, page, pageSize, queue, tickets, names, total, loading, error, load, goToPage, setPageSize, reveal }
}

export type QueueState = ReturnType<typeof useQueue>
