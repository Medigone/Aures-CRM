/** État de la liste des demandes de faisabilité. */
import { computed } from 'vue'
import { getDemandes } from './api'
import type { DemandesResponse, DemandeView } from './demandes'
import { useServerList } from './useServerList'

export function useDemandes(initial: { view?: DemandeView; page?: number } = {}) {
	const list = useServerList<DemandesResponse, DemandeView>({ view: initial.view ?? 'all', page: initial.page, pageSizeKey: 'bureau-demandes-par-page', fetch: getDemandes })
	const demandes = computed(() => list.response.value?.demandes ?? [])
	return { ...list, demandes }
}

export type DemandesState = ReturnType<typeof useDemandes>
