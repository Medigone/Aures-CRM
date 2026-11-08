/** Chargement d'un tracé, commun à l'aperçu et à la fiche. */
import { getTrace } from './api'
import type { TraceDetail } from './traces'
import { useRecord } from './useRecord'

export function useTrace(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<TraceDetail>(id, getTrace, changed)
	return { trace: record, ...rest }
}
