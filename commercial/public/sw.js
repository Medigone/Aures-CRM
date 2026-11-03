/* Aures Commercial : service worker de la PWA commerciale (portée /commercial).
 *
 * - pages /commercial : réseau d'abord, coquille en cache si hors-ligne ;
 * - assets du build (noms hachés) : cache d'abord ;
 * - images et assets Frappe (noms stables) : cache, puis mise à jour en arrière-plan ;
 * - API : jamais mises en cache ; l'application garde ses données dans IndexedDB ;
 * - fichiers des contenus (`commercial-contents`) : gardés par l'application pour présenter hors
 *   ligne, conservés d'une version à l'autre, effacés à la déconnexion.
 *
 * VERSION est injectée par Frappe au service (empreinte du build) : un nouveau build
 * installe un nouveau service worker, qui attend que l'utilisateur accepte la mise à
 * jour (message « skip-waiting ») puis supprime les caches de l'ancien.
 */
const VERSION = '__BUILD_VERSION__'
const SHELL_CACHE = `commercial-shell-${VERSION}`
const ASSET_CACHE = `commercial-assets-${VERSION}`
const CONTENT_CACHE = 'commercial-contents'
const SHELL_KEY = '/commercial'
const LOGIN_PATH = '/commercial/connexion'
const HASHED_PREFIXES = ['/assets/aurescrm/commercial/']
const STABLE_PREFIXES = ['/assets/aurescrm/images/', '/assets/frappe/']

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith('commercial-') && key !== SHELL_CACHE && key !== ASSET_CACHE && key !== CONTENT_CACHE)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	)
})

async function networkFirstShell(request) {
	const cache = await caches.open(SHELL_CACHE)
	try {
		const response = await fetch(request)
		// La page de connexion est servie sans session : elle ne remplace jamais la coquille connectée.
		if (response.ok && !response.redirected && new URL(request.url).pathname !== LOGIN_PATH) {
			cache.put(SHELL_KEY, response.clone())
		}
		// Serveur en erreur : la coquille en cache permet de continuer hors réseau. Une redirection
		// (session terminée → connexion) est servie telle quelle.
		if (response.status >= 500) {
			const cached = await cache.match(SHELL_KEY)
			if (cached) return cached
		}
		return response
	} catch (error) {
		const cached = await cache.match(SHELL_KEY)
		if (cached) return cached
		throw error
	}
}

async function cacheFirst(request) {
	const cache = await caches.open(ASSET_CACHE)
	const cached = await cache.match(request)
	if (cached) return cached
	const response = await fetch(request)
	if (response.ok) cache.put(request, response.clone())
	return response
}

async function staleWhileRevalidate(event) {
	const cache = await caches.open(ASSET_CACHE)
	const cached = await cache.match(event.request)
	const refresh = fetch(event.request)
		.then((response) => {
			if (response.ok) cache.put(event.request, response.clone())
			return response
		})
		.catch(() => cached)
	if (cached) {
		event.waitUntil(refresh)
		return cached
	}
	return refresh
}

self.addEventListener('fetch', (event) => {
	const request = event.request
	if (request.method !== 'GET') return
	const url = new URL(request.url)
	if (url.origin !== self.location.origin) return

	if (request.mode === 'navigate' && (url.pathname === '/commercial' || url.pathname.startsWith('/commercial/'))) {
		event.respondWith(networkFirstShell(request))
		return
	}
	if (HASHED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
		event.respondWith(cacheFirst(request))
		return
	}
	if (STABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
		event.respondWith(staleWhileRevalidate(event))
	}
})

self.addEventListener('message', (event) => {
	if (event.data === 'skip-waiting') {
		self.skipWaiting()
	}
	if (event.data === 'clear-caches') {
		event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('commercial-')).map((k) => caches.delete(k)))))
	}
})

/* Notifications push : le serveur n'envoie qu'un titre, une phrase courte, l'URL à ouvrir et un `tag`
 * (une seule notification par sujet, la nouvelle remplace l'ancienne). Chaque push doit afficher une
 * notification : le navigateur retire la permission à un service worker qui en reçoit sans rien montrer. */
const PUSH_ICON = '/assets/aurescrm/images/commercial-icon-192.png'

self.addEventListener('push', (event) => {
	let data = {}
	try {
		data = event.data ? event.data.json() : {}
	} catch {
		data = { body: event.data ? event.data.text() : '' }
	}
	const options = {
		body: data.body || '',
		icon: PUSH_ICON,
		data: { url: data.url || SHELL_KEY },
		lang: 'fr',
	}
	if (data.tag) {
		options.tag = data.tag
		options.renotify = true
	}
	event.waitUntil(self.registration.showNotification(data.title || 'Aures Commercial', options))
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	let url = new URL((event.notification.data && event.notification.data.url) || SHELL_KEY, self.location.origin)
	// Une notification n'ouvre que l'application : jamais une adresse d'un autre site.
	if (url.origin !== self.location.origin) url = new URL(SHELL_KEY, self.location.origin)
	url = url.href
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
			const ouverte = windows.find((client) => new URL(client.url).pathname.startsWith(SHELL_KEY))
			if (ouverte) {
				// L'application ouverte navigue elle-même (routeur), sans recharger la page.
				ouverte.postMessage({ type: 'push-navigate', url })
				return ouverte.focus()
			}
			return self.clients.openWindow(url)
		}),
	)
})

// Le navigateur a renouvelé l'abonnement : on se réabonne avec la même clé ; l'application
// renvoie l'abonnement au serveur à sa prochaine ouverture (le service worker n'a pas de jeton CSRF).
self.addEventListener('pushsubscriptionchange', (event) => {
	const options = event.oldSubscription && event.oldSubscription.options
	if (!options || !options.applicationServerKey) return
	event.waitUntil(
		self.registration.pushManager
			.subscribe({ userVisibleOnly: true, applicationServerKey: options.applicationServerKey })
			.catch(() => {}),
	)
})
