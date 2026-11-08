/** État de la liste des impositions. */
import { computed } from 'vue'
import { getImpositions } from './api'
import type { ImpositionsResponse, ImpositionView } from './impositions'
import { useServerList } from './useServerList'

export function useImpositions(initial: { view: ImpositionView; page?: number }) {
	const list = useServerList<ImpositionsResponse, ImpositionView>({ view: initial.view, page: initial.page, pageSizeKey: 'bureau-impositions-par-page', fetch: getImpositions })
	const impositions = computed(() => list.response.value?.impositions ?? [])
	return { ...list, impositions }
}

export type ImpositionsState = ReturnType<typeof useImpositions>
