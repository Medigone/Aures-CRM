/** Service worker : enregistrement et mise à jour proposée (jamais imposée en pleine saisie). */
import { ref } from 'vue'

/** Une nouvelle version est installée et attend l'accord de l'utilisateur. */
export const updateReady = ref(false)

let waiting: ServiceWorker | null = null

function track(worker: ServiceWorker | null) {
	if (!worker) return
	const check = () => {
		// `installed` alors qu'une version contrôle déjà la page : c'est une mise à jour.
		if (worker.state === 'installed' && navigator.serviceWorker.controller) {
			waiting = worker
			updateReady.value = true
		}
	}
	check()
	worker.addEventListener('statechange', check)
}

/** Une application laissée ouverte toute la journée vérifie quand même les nouvelles versions. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

export function registerServiceWorker() {
	if (!('serviceWorker' in navigator)) return
	// Premier lancement : la page n'est pas encore contrôlée, la prise de contrôle n'est pas une mise à jour.
	const hadController = Boolean(navigator.serviceWorker.controller)
	navigator.serviceWorker
		.register('/commercial/sw.js', { scope: '/commercial' })
		.then((registration) => {
			track(registration.waiting)
			registration.addEventListener('updatefound', () => track(registration.installing))
			const check = () => {
				if (navigator.onLine) registration.update().catch(() => {})
			}
			setInterval(check, UPDATE_CHECK_MS)
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') check()
			})
		})
		.catch(() => {
			/* sans service worker, l'application reste utilisable en ligne */
		})
	let reloading = false
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloading || !hadController) return
		reloading = true
		window.location.reload()
	})
}

/** Les saisies sont dans IndexedDB : recharger sur la nouvelle version ne perd rien. */
export function applyUpdate() {
	if (waiting) waiting.postMessage('skip-waiting')
	else window.location.reload()
}
