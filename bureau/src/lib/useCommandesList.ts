/** État de la liste des commandes. */
import { computed } from 'vue'
import { getCommandesList } from './api'
import type { CommandesResponse, CommandeView } from './commandes'
import { useServerList } from './useServerList'

export function useCommandesList(initial: { view?: CommandeView; page?: number } = {}) {
	const list = useServerList<CommandesResponse, CommandeView>({ view: initial.view ?? 'all', page: initial.page, pageSizeKey: 'bureau-commandes-par-page', fetch: getCommandesList })
	const commandes = computed(() => list.response.value?.commandes ?? [])
	return { ...list, commandes }
}

export type CommandesListState = ReturnType<typeof useCommandesList>
