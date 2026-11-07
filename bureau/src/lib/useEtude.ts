/** Chargement et écritures d'une étude, communs à l'aperçu et à la fiche. */
import { computed } from 'vue'
import { getEtude, setEtudeAssignee } from './api'
import type { EtudeDetail } from './etudes'
import { useRecord } from './useRecord'

export function useEtude(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<EtudeDetail>(id, getEtude, changed)
	const assigneeOptions = computed(() => {
		const options = [...(record.value?.assignees ?? [])]
		const add = (value?: string | null, label?: string | null) => {
			if (value && !options.some((option) => option.value === value)) options.push({ value, label: label || value })
		}
		add(record.value?.assigne_a, record.value?.assigne_a_nom)
		return options
	})
	function assign(user: string) {
		const value = record.value
		if (value && user && user !== value.assigne_a) rest.perform(() => setEtudeAssignee(value, user))
	}
	return { etude: record, assigneeOptions, assign, ...rest }
}
