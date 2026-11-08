/** État de la liste des tracés. */
import { computed } from 'vue'
import { getTraces } from './api'
import type { TracesResponse, TraceView } from './traces'
import { useServerList } from './useServerList'

export function useTraces(initial: { view: TraceView; page?: number }) {
	const list = useServerList<TracesResponse, TraceView>({ view: initial.view, page: initial.page, pageSizeKey: 'bureau-traces-par-page', fetch: getTraces })
	const traces = computed(() => list.response.value?.traces ?? [])
	return { ...list, traces }
}

export type TracesState = ReturnType<typeof useTraces>
