/**
 * Temps réel des applications Aures : connexion Socket.IO alignée sur Frappe et regroupement des rafales.
 * Les messages ne portent que des identifiants ; l'application recharge ensuite ses données par l'API.
 */
import { io, type Socket } from 'socket.io-client'
import { ref } from 'vue'

declare global {
	interface Window {
		site_name?: string
		socketio_port?: number | string
	}
}

export interface RealtimeEvent {
	doctype?: string
	name?: string
	by?: string | null
	deleted?: number
}

/** Un changement fait par ce compte depuis cet appareil est déjà affiché : seuls ceux des autres comptent. */
export function isForeignChange(event: RealtimeEvent, me?: string | null) {
	return Boolean(event?.doctype) && (!me || event.by !== me)
}

/**
 * Regroupe les rafales : premier rechargement `delayMs` après l'événement, puis au plus un par `minIntervalMs`.
 * Renvoie la fonction à appeler à chaque événement.
 */
export function throttledReload(reload: () => void, { delayMs = 3000, minIntervalMs = 10000, now = () => Date.now() } = {}) {
	let timer: ReturnType<typeof setTimeout> | null = null
	// Aucun rechargement encore : le premier attend seulement `delayMs`.
	let last = Number.NEGATIVE_INFINITY
	return () => {
		if (timer) return
		const wait = Math.max(delayMs, last + minIntervalMs - now())
		timer = setTimeout(() => {
			timer = null
			last = now()
			reload()
		}, wait)
	}
}

let socket: Socket | null = null

/** Vrai tant que les changements faits ailleurs arrivent seuls. */
export const realtimeConnected = ref(false)

/** Connexion Socket.IO alignée sur Frappe (namespace = site, proxy nginx en production). */
export function connectRealtime<T extends RealtimeEvent>(eventName: string, onEvent: (event: T) => void, onReconnect: () => void): Socket | null {
	if (socket) return socket
	if (typeof window === 'undefined' || !window.user) return null
	const host = window.location.hostname
	const siteName = window.site_name || host
	const portSuffix = window.location.port ? `:${window.socketio_port ?? 9000}` : ''
	const protocol = portSuffix ? 'http' : 'https'
	socket = io(`${protocol}://${host}${portSuffix}/${siteName}`, { withCredentials: true, reconnectionDelayMax: 30_000 })
	let disconnected = false
	socket.on('disconnect', () => {
		disconnected = true
		realtimeConnected.value = false
	})
	socket.on('connect', () => {
		realtimeConnected.value = true
		if (!disconnected) return
		disconnected = false
		onReconnect()
	})
	socket.on(eventName, onEvent)
	// Au retour de veille ou du réseau, reconnexion immédiate (sans attendre le délai de reprise).
	const relancer = () => {
		if (document.visibilityState === 'visible' && socket && !socket.connected) socket.connect()
	}
	document.addEventListener('visibilitychange', relancer)
	window.addEventListener('online', relancer)
	window.addEventListener('pageshow', relancer)
	return socket
}

export function closeRealtime() {
	socket?.disconnect()
	socket = null
	realtimeConnected.value = false
}
