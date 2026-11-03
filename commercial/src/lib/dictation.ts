import { onBeforeUnmount, ref } from 'vue'

/**
 * Dictée vocale (Web Speech API) : disponible sur Chrome Android, en ligne seulement.
 * Chaque phrase reconnue (après une pause) est passée à `onText` ; la phrase en cours de reconnaissance est dans `interim`.
 * Sans prise en charge, `supported` vaut false.
 */
function recognitionClass() {
	const w = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }
	return w.SpeechRecognition || w.webkitSpeechRecognition
}

/** La dictée est-elle possible sur ce navigateur ? */
export const dictationSupported = () => Boolean(recognitionClass())

export function useDictation(onText: (text: string) => void) {
	const Recognition = recognitionClass()
	const supported = Boolean(Recognition)
	const listening = ref(false)
	const error = ref('')
	const interim = ref('')
	/** Début de la dictée en cours (ms), pour afficher sa durée. */
	const startedAt = ref<number | null>(null)
	let recognition: any = null

	function stop() {
		recognition?.stop()
		recognition = null
		interim.value = ''
		listening.value = false
		startedAt.value = null
	}

	function start() {
		if (!Recognition) return
		error.value = ''
		recognition = new Recognition()
		recognition.lang = 'fr-FR'
		recognition.continuous = true
		recognition.interimResults = true
		recognition.onresult = (event: any) => {
			let pending = ''
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const text = String(event.results[i][0].transcript || '')
				if (event.results[i].isFinal) onText(text.trim())
				else pending += text
			}
			interim.value = pending.trim()
		}
		recognition.onerror = (event: any) => {
			// Silence prolongé : pas une erreur, la reconnaissance se termine simplement.
			if (event?.error === 'no-speech' || event?.error === 'aborted') return
			error.value =
				event?.error === 'not-allowed'
					? 'Micro refusé : autorisez-le dans le navigateur.'
					: event?.error === 'network'
						? 'Dictée indisponible hors connexion : saisissez au clavier.'
						: 'Dictée interrompue.'
			listening.value = false
			startedAt.value = null
		}
		recognition.onend = () => {
			interim.value = ''
			listening.value = false
			startedAt.value = null
		}
		try {
			recognition.start()
			listening.value = true
			startedAt.value = Date.now()
		} catch {
			listening.value = false
		}
	}

	const toggle = () => (listening.value ? stop() : start())
	onBeforeUnmount(stop)
	return { supported, listening, error, interim, startedAt, start, toggle, stop }
}
