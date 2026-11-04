/** État de la liste des clients. */
import { computed } from 'vue'
import { getClients } from './api'
import type { ClientsResponse, ClientView } from './clients'
import { useServerList } from './useServerList'

export function useClients(initial: { view?: ClientView; page?: number } = {}) {
	const list = useServerList<ClientsResponse, ClientView>({ view: initial.view ?? 'all', page: initial.page, pageSizeKey: 'bureau-clients-par-page', fetch: getClients })
	const clients = computed(() => list.response.value?.clients ?? [])
	return { ...list, clients }
}

export type ClientsState = ReturnType<typeof useClients>
