/**
 * Temps réel : ce que le Desk modifie (ticket pris en charge, devis validé, BAT, production…) arrive sur
 * l'appareil sans attendre la synchro. Le serveur (aurescrm/commercial_events.py) n'envoie que des
 * identifiants aux commerciaux concernés ; l'appareil recharge alors son instantané.
 */
import { io, type Socket } from 'socket.io-client'

declare global {
	interface Window {
		site_name?: string
		socketio_port?: number | string
	}
}

export const COMMERCIAL_EVENT = 'aures_commercial_update'

export interface CommercialEvent {
	doctype?: string
	name?: string
	by?: string | null
	deleted?: number
}

/** Un changement fait par ce compte depuis cet appareil est déjà affiché : seuls ceux des autres comptent. */
export function isForeignChange(event: CommercialEvent, me?: string | null) {
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

/** Connexion Socket.IO alignée sur Frappe (namespace = site, proxy nginx en production). */
export function connectRealtime(onEvent: (event: CommercialEvent) => void, onReconnect: () => void): Socket | null {
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
	})
	socket.on('connect', () => {
		if (!disconnected) return
		disconnected = false
		onReconnect()
	})
	socket.on(COMMERCIAL_EVENT, onEvent)
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
}
