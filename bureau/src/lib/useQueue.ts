/** État de la liste : il survit à l'ouverture d'une fiche, qui s'en sert pour aller au ticket voisin. */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getQueue } from './api'
import type { Condition } from './filters'
import { isComplete } from './filters'
import { sortTickets, type Sort } from './list'
import type { QueueResponse, QueueView } from '@/types'

// Au retour sur l'onglet, la liste est rechargée : le Desk a pu la modifier.
const MIN_FOCUS_INTERVAL = 30_000

export function useQueue() {
	const view = ref<QueueView>('todo')
	const search = ref('')
	const conditions = ref<Condition[]>([])
	const sort = ref<Sort | null>(null)
	const queue = ref<QueueResponse | null>(null)
	const loading = ref(false)
	const error = ref('')
	const tickets = computed(() => sortTickets(queue.value?.tickets ?? [], sort.value))

	// Une seule réponse compte : celle de la dernière demande.
	let lastRequest = 0
	async function load() {
		const request = ++lastRequest
		loading.value = true
		error.value = ''
		try {
			const response = await getQueue(view.value, conditions.value, search.value)
			if (request === lastRequest) queue.value = response
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
	watch(view, load)
	watch(search, loadSoon)
	const signature = computed(() => JSON.stringify(conditions.value.filter(isComplete).map(({ field, op, value }) => [field, op, value.trim()])))
	watch(signature, loadSoon)

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

	return { view, search, conditions, sort, queue, tickets, loading, error, load }
}

export type QueueState = ReturnType<typeof useQueue>
