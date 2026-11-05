/** Chargement et écritures d'un client, communs à l'aperçu et à la fiche. */
import { getClient } from './api'
import type { ClientDetail } from './clients'
import { useRecord } from './useRecord'

export function useClient(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<ClientDetail>(id, getClient, changed)
	return { client: record, ...rest }
}
