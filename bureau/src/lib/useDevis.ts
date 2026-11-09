/** Chargement d'un devis pour l'aperçu. */
import { getDevis } from './api'
import type { DevisDetail } from './devis'
import { useRecord } from './useRecord'

export function useDevis(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<DevisDetail>(id, getDevis, changed)
	return { devis: record, ...rest }
}
