/** Actions groupées : envoi par lots et sélection d'un intervalle. */
import type { BulkResult } from '@/types'

/** Lignes par requête : assez court pour montrer l'avancement et rester dans le délai d'une requête. */
export const BATCH_SIZE = 50

export interface BulkOutcome extends BulkResult {
	/** Lignes jamais envoyées, parce qu'un lot a échoué avant elles. */
	unsent: number
	error: string
}

/** Envoie les lignes lot après lot. Un lot en erreur arrête la suite : ce qui est déjà fait reste compté. */
export async function runInBatches<Item>(items: Item[], send: (batch: Item[]) => Promise<BulkResult>, onProgress?: (sent: number) => void, size = BATCH_SIZE): Promise<BulkOutcome> {
	const outcome: BulkOutcome = { done: [], skipped: [], unsent: 0, error: '' }
	for (let start = 0; start < items.length; start += size) {
		try {
			const result = await send(items.slice(start, start + size))
			outcome.done.push(...result.done)
			outcome.skipped.push(...result.skipped)
		} catch (e) {
			outcome.error = (e as Error).message
			outcome.unsent = items.length - start
			break
		}
		onProgress?.(Math.min(start + size, items.length))
	}
	return outcome
}

/** Shift + clic : toutes les lignes entre le dernier clic et celui-ci prennent le nouvel état de la ligne cliquée. */
export function rangeToggle(names: string[], picked: Set<string>, anchor: string | null, target: string): Set<string> {
	const next = new Set(picked)
	const on = !picked.has(target)
	const from = anchor === null ? -1 : names.indexOf(anchor)
	const to = names.indexOf(target)
	const range = from < 0 || to < 0 ? [target] : names.slice(Math.min(from, to), Math.max(from, to) + 1)
	for (const name of range) {
		if (on) next.add(name)
		else next.delete(name)
	}
	return next
}
