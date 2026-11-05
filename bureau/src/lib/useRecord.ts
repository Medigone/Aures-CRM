/** Chargement et écritures d'un document, communs à l'aperçu et à la fiche. */
import { computed, ref, watch, type Ref } from 'vue'

export function useRecord<Detail>(id: () => string, fetch: (name: string) => Promise<Detail>, changed: () => void = () => {}) {
	const record = ref(null) as Ref<Detail | null>
	const error = ref('')
	const notFound = ref(false)
	const actionError = ref('')
	const notice = ref('')
	const infoMessage = ref('')
	// Ce qui arrive par le temps réel informe ; le reste confirme une action de l'utilisateur.
	const noticeTone = computed(() => (notice.value && notice.value === infoMessage.value ? 'info' : 'success'))
	const busy = ref(false)

	let lastRequest = 0
	async function load() {
		const request = ++lastRequest
		error.value = ''
		notFound.value = false
		try {
			const response = await fetch(id())
			if (request === lastRequest) record.value = response
		} catch (e) {
			if (request !== lastRequest) return
			const status = (e as { status?: number }).status
			// Rechargement en arrière-plan raté : on garde ce qui est affiché.
			if (record.value && status !== 404) return
			record.value = null
			if (status === 404) notFound.value = true
			else error.value = (e as Error).message
		}
	}
	watch(
		id,
		() => {
			record.value = null
			actionError.value = ''
			notice.value = ''
			load()
		},
		{ immediate: true },
	)

	/** Une écriture à la fois. Le refus peut venir d'un changement fait ailleurs : l'écran repart du serveur. */
	async function perform(action: () => Promise<Detail>) {
		if (busy.value) return false
		busy.value = true
		actionError.value = ''
		notice.value = ''
		const request = ++lastRequest
		try {
			const response = await action()
			if (request === lastRequest) record.value = response
			changed()
			return true
		} catch (e) {
			actionError.value = (e as Error).message
			await load()
			return false
		} finally {
			busy.value = false
		}
	}

	/** Changement arrivé par le temps réel. Pendant une écriture, c'est sa réponse qui fera foi. */
	function refresh(message = '') {
		if (busy.value) return
		if (message) {
			infoMessage.value = message
			notice.value = message
		}
		load()
	}

	return { record, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh }
}
