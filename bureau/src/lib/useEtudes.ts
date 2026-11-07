/** État de la liste des études de faisabilité. */
import { computed } from 'vue'
import { getEtudes } from './api'
import type { EtudesResponse, EtudeView } from './etudes'
import { useServerList } from './useServerList'

export function useEtudes(initial: { view: EtudeView; page?: number }) {
	const list = useServerList<EtudesResponse, EtudeView>({ view: initial.view, page: initial.page, pageSizeKey: 'bureau-etudes-par-page', fetch: getEtudes })
	const etudes = computed(() => list.response.value?.etudes ?? [])
	return { ...list, etudes }
}

export type EtudesState = ReturnType<typeof useEtudes>
