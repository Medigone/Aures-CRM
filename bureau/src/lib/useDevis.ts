/** Chargement d'un devis et ses écritures, communs à l'aperçu et à la fiche. */
import { cancelDevis, createDevisCommande, getDevis, markDevisLost, updateDevis, validateDevis } from './api'
import type { DevisDetail } from './devis'
import { useRecord } from './useRecord'

export function useDevis(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<DevisDetail>(id, getDevis, changed)
	/** Commande créée par la dernière action, pour le lien du toast. */
	let lastCommande = ''

	async function run(action: (devis: DevisDetail) => Promise<DevisDetail>, message: string) {
		const value = record.value
		if (!value) return false
		const done = await rest.perform(() => action(value))
		if (done) rest.notice.value = message
		return done
	}
	return {
		devis: record,
		...rest,
		setPrice: (line: string, price: number) => run((devis) => updateDevis(devis, { prix: { [line]: price } }), 'Prix enregistré.'),
		setValidity: (date: string) => run((devis) => updateDevis(devis, { valable: date }), 'Validité enregistrée.'),
		validate: () => run(validateDevis, 'Devis validé. Le commercial est prévenu.'),
		order: async () => {
			const done = await run(async (devis) => {
				const result = await createDevisCommande(devis)
				lastCommande = result.commande
				return result.devis
			}, '')
			return done ? lastCommande : ''
		},
		lose: (values: { raison: string; concurrent: string; precisions: string }) => run((devis) => markDevisLost(devis, values), 'Devis marqué perdu.'),
		cancel: () => run(cancelDevis, 'Devis annulé.'),
	}
}
