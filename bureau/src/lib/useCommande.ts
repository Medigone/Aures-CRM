/** Chargement d'une commande et ses écritures, communs à l'aperçu et à la fiche. */
import { cancelCommande, deleteCommande, getCommande, setCommandeScan, updateCommande, validateCommande } from './api'
import type { CommandeDetail } from './commandes'
import { useRecord } from './useRecord'

export function useCommande(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<CommandeDetail>(id, getCommande, changed)

	async function run(action: (commande: CommandeDetail) => Promise<CommandeDetail>, message: string) {
		const value = record.value
		if (!value) return false
		const done = await rest.perform(() => action(value))
		if (done && message) rest.notice.value = message
		return done
	}
	/** Un brouillon supprimé n'a plus de fiche : la page repart vers le devis ou la liste. */
	async function remove() {
		const value = record.value
		if (!value || rest.busy.value) return null
		rest.busy.value = true
		rest.actionError.value = ''
		try {
			const result = await deleteCommande(value)
			changed()
			return result
		} catch (e) {
			rest.actionError.value = (e as Error).message
			return null
		} finally {
			rest.busy.value = false
		}
	}
	return {
		commande: record,
		...rest,
		setBon: (values: { bon_commande?: string; date_bon?: string }) => run((commande) => updateCommande(commande, values), 'Bon de commande enregistré.'),
		setScan: (fileUrl: string) => run((commande) => setCommandeScan(commande, fileUrl), 'Bon de commande scanné joint.'),
		validate: () => run(validateCommande, 'Commande validée. Le dossier de fabrication est créé et le commercial prévenu.'),
		cancel: (motif: string) => run((commande) => cancelCommande(commande, motif), 'Commande annulée. Le devis peut recevoir une nouvelle commande.'),
		remove,
	}
}
