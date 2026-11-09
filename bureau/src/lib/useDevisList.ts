/** État de la liste des devis. */
import { computed } from 'vue'
import { getDevisList } from './api'
import type { DevisResponse, DevisView } from './devis'
import { useServerList } from './useServerList'

export function useDevisList(initial: { view?: DevisView; page?: number } = {}) {
	const list = useServerList<DevisResponse, DevisView>({ view: initial.view ?? 'all', page: initial.page, pageSizeKey: 'bureau-devis-par-page', fetch: getDevisList })
	const devis = computed(() => list.response.value?.devis ?? [])
	return { ...list, devis }
}

export type DevisListState = ReturnType<typeof useDevisList>
