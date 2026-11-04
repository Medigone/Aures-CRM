/** État de la liste des tickets. */
import { computed } from 'vue'
import { getQueue } from './api'
import { useServerList } from './useServerList'
import type { QueueResponse, QueueView } from '@/types'

export { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './useServerList'

export function useQueue(initial: { view?: QueueView; page?: number } = {}) {
	const list = useServerList<QueueResponse, QueueView>({ view: initial.view ?? 'todo', page: initial.page, pageSizeKey: 'bureau-tickets-par-page', fetch: getQueue })
	const tickets = computed(() => list.response.value?.tickets ?? [])
	return { ...list, queue: list.response, tickets }
}

export type QueueState = ReturnType<typeof useQueue>
