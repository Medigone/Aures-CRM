import { onBeforeUnmount, ref } from 'vue'

/**
 * Dictée vocale (Web Speech API) : disponible sur Chrome Android, en ligne seulement.
 * Chaque phrase reconnue (après une pause) est passée à `onText` ; sans prise en charge, `supported` vaut false.
 */
export function useDictation(onText: (text: string) => void) {
	const w = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }
	const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition
	const supported = Boolean(Recognition)
	const listening = ref(false)
	const error = ref('')
	/** Début de la dictée en cours (ms), pour afficher sa durée. */
	const startedAt = ref<number | null>(null)
	let recognition: any = null

	function stop() {
		recognition?.stop()
		recognition = null
		listening.value = false
		startedAt.value = null
	}

	function start() {
		if (!Recognition) return
		error.value = ''
		recognition = new Recognition()
		recognition.lang = 'fr-FR'
		recognition.continuous = true
		recognition.interimResults = false
		recognition.onresult = (event: any) => {
			for (let i = event.resultIndex; i < event.results.length; i++) {
				if (event.results[i].isFinal) onText(String(event.results[i][0].transcript || '').trim())
			}
		}
		recognition.onerror = (event: any) => {
			error.value = event?.error === 'not-allowed' ? 'Micro refusé : autorisez-le dans le navigateur.' : 'Dictée interrompue.'
			listening.value = false
			startedAt.value = null
		}
		recognition.onend = () => {
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
	return { supported, listening, error, startedAt, toggle, stop }
}
