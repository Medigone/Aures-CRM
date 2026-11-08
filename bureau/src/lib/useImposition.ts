/** Chargement d'une imposition et choix de l'idéale, communs à l'aperçu et à la fiche. */
import { getImposition, setImpositionAuto, setImpositionIdeale } from './api'
import type { ImpositionDetail } from './impositions'
import { useRecord } from './useRecord'

export function useImposition(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<ImpositionDetail>(id, getImposition, changed)
	async function makeIdeale() {
		const value = record.value
		if (value && (await rest.perform(() => setImpositionIdeale(value)))) rest.notice.value = "Imposition idéale choisie : le calcul automatique ne la remplacera pas."
	}
	async function backToAuto() {
		const value = record.value
		if (value && (await rest.perform(() => setImpositionAuto(value)))) rest.notice.value = "L'idéale revient au calcul : le moins de chutes."
	}
	return { imposition: record, makeIdeale, backToAuto, ...rest }
}
