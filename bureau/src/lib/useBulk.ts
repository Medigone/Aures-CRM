/** Déroulement d'une action groupée : avancement, résumé, et ce qui n'a pas été traité. */
import { onBeforeUnmount, ref } from 'vue'
import { runInBatches, type BulkOutcome } from './bulk'
import { bulkSummary } from './list'
import type { BulkResult } from '@/types'

export function useBulk(hooks: { clear: () => void; changed: () => void }) {
	const busy = ref(false)
	const progress = ref<{ sent: number; total: number } | null>(null)
	const message = ref('')
	const skipped = ref<BulkResult['skipped']>([])
	/** La demande entière a été refusée : la sélection reste en place. */
	const error = ref('')
	/** Un lot a échoué en cours de route : le reste n'est pas parti. */
	const interrupted = ref('')
	let timer: ReturnType<typeof setTimeout> | null = null

	function dismiss() {
		if (timer) clearTimeout(timer)
		message.value = ''
		skipped.value = []
		interrupted.value = ''
	}

	async function run<Item>(items: Item[], send: (batch: Item[]) => Promise<BulkResult>, one: string, many: string, keepPicked = false): Promise<BulkOutcome | null> {
		if (busy.value || !items.length) return null
		busy.value = true
		error.value = ''
		dismiss()
		progress.value = { sent: 0, total: items.length }
		try {
			const outcome = await runInBatches(items, send, (sent) => {
				progress.value = { sent, total: items.length }
			})
			if (outcome.error && !outcome.done.length && !outcome.skipped.length) {
				error.value = outcome.error
				return outcome
			}
			const unsent = outcome.unsent ? `${outcome.unsent} non envoyé${outcome.unsent > 1 ? 's' : ''}` : ''
			message.value = [bulkSummary(outcome, one, many), unsent].filter(Boolean).join(' · ')
			skipped.value = outcome.skipped
			interrupted.value = outcome.error
			if (!keepPicked) hooks.clear()
			// Un succès complet s'efface seul ; ce qui n'a pas été traité reste jusqu'à ce qu'on l'ait lu.
			if (!outcome.skipped.length && !outcome.error) timer = setTimeout(dismiss, 6000)
			return outcome
		} finally {
			busy.value = false
			progress.value = null
			hooks.changed()
		}
	}

	onBeforeUnmount(() => {
		if (timer) clearTimeout(timer)
	})

	return { busy, progress, message, skipped, error, interrupted, dismiss, run }
}

export type BulkState = ReturnType<typeof useBulk>
