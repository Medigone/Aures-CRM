/** Chargement et écritures d'une demande, communs à l'aperçu et à la fiche. */
import { getDemande } from './api'
import type { DemandeDetail } from './demandes'
import { useRecord } from './useRecord'

export function useDemande(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<DemandeDetail>(id, getDemande, changed)
	return { demande: record, ...rest }
}
