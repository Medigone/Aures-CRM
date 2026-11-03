/**
 * Notifications push de la PWA : abonnement de l'appareil, préférences, présence et ouverture au clic.
 *
 * Repris de MediConnect Field (terrain/src/lib/push.ts) : il n'utilise que `fetch`.
 *
 * - La permission ne se demande que sur un geste de l'utilisateur (bouton « Activer »).
 * - L'app visible signale sa présence toutes les 60 s : le serveur ne pousse pas ce qu'elle affiche déjà.
 * - À chaque ouverture, l'abonnement est renvoyé au serveur s'il a changé (le service worker ne peut pas
 *   le faire lui-même : il n'a pas de jeton CSRF).
 */
import { reactive } from 'vue'
import type { Router } from 'vue-router'

export const APP = 'commercial' as const
const SCOPE = `/${APP}`
const API = 'aurescrm.api.push'
const PRESENCE_MS = 60 * 1000
const STORAGE_INVITE = `aures-push-invite-${APP}`

export type PushSupport = 'ok' | 'unsupported' | 'ios-install' | 'denied'

export interface PushCategory {
	id: string
	label: string
	actif: boolean
}

interface PushStatus {
	enabled: boolean
	public_key: string | null
	devices: number
	this_device: boolean
	preferences: PushCategory[]
}

export const pushState = reactive({
	/** Réglage du site (Paramètres Push) */
	enabled: false,
	/** Cet appareil reçoit les notifications */
	subscribed: false,
	/** Appareils abonnés pour ce compte (tous confondus) */
	devices: 0,
	preferences: [] as PushCategory[],
	support: 'unsupported' as PushSupport,
	loaded: false,
	busy: false,
})

let publicKey: string | null = null
let presenceTimer: ReturnType<typeof setInterval> | null = null

declare global {
	interface Window {
		csrf_token?: string
	}
}

async function api<T>(method: string, params: Record<string, unknown> = {}, post = false): Promise<T> {
	let response: Response
	if (post) {
		response = await fetch(`/api/method/${API}.${method}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-Frappe-CSRF-Token': window.csrf_token || '',
			},
			body: JSON.stringify(params),
			credentials: 'same-origin',
		})
	} else {
		const query = new URLSearchParams()
		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null) query.set(key, String(value))
		}
		response = await fetch(`/api/method/${API}.${method}?${query}`, {
			headers: { Accept: 'application/json' },
			credentials: 'same-origin',
			cache: 'no-store',
		})
	}
	const body = await response.json().catch(() => ({}))
	if (!response.ok) {
		let message = 'Action impossible pour le moment.'
		try {
			message = JSON.parse(JSON.parse(body._server_messages)[0]).message || message
		} catch {
			/* message non structuré */
		}
		throw new Error(message.replace(/<[^>]+>/g, ''))
	}
	return body.message as T
}

function isLoggedIn() {
	const match = document.cookie.match(/(?:^|;\s*)user_id=([^;]*)/)
	const user = match ? decodeURIComponent(match[1]) : ''
	return Boolean(user) && user !== 'Guest'
}

function isIos() {
	const ua = navigator.userAgent
	return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export function isStandalone() {
	return (
		window.matchMedia?.('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	)
}

function detectSupport(): PushSupport {
	const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
	// Sur iPhone, le push n'existe que pour une app ajoutée à l'écran d'accueil (iOS 16.4+).
	if (isIos() && !isStandalone()) return 'ios-install'
	if (!capable) return 'unsupported'
	if (Notification.permission === 'denied') return 'denied'
	return 'ok'
}

function keyToBytes(base64: string) {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4)
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
	return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
	if (!('serviceWorker' in navigator)) return null
	return (await navigator.serviceWorker.getRegistration(SCOPE)) ?? null
}

/**
 * Une version du service worker en attente de l'accord de l'utilisateur ne reçoit pas les push : c'est
 * l'ancienne, active, qui les reçoit, et celle d'avant les notifications ne les affiche pas. Un appareil
 * abonné passe donc tout de suite à la nouvelle version (la page se recharge, rien de saisi n'est perdu).
 */
function activerVersionEnAttente(reg: ServiceWorkerRegistration | null) {
	if (reg?.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage('skip-waiting')
}

let versionVerifiee = false

async function currentSubscription() {
	const reg = await registration()
	return reg?.pushManager ? reg.pushManager.getSubscription() : null
}

function applyStatus(status: PushStatus) {
	pushState.enabled = status.enabled
	pushState.devices = status.devices
	pushState.subscribed = status.this_device
	pushState.preferences = status.preferences
	publicKey = status.public_key
}

/** Relit l'état serveur et resynchronise l'abonnement de cet appareil s'il a changé. */
export async function refreshPush() {
	pushState.support = detectSupport()
	const sub = pushState.support === 'ok' ? await currentSubscription().catch(() => null) : null
	const status = await api<PushStatus>('get_status', { application: APP, endpoint: sub?.endpoint })
	applyStatus(status)
	if (!versionVerifiee && sub && Notification.permission === 'granted') {
		// Au lancement seulement : jamais de rechargement quand l'app revient au premier plan.
		versionVerifiee = true
		activerVersionEnAttente(await registration().catch(() => null))
	}
	if (status.enabled && sub && !status.this_device && Notification.permission === 'granted') {
		// Abonnement renouvelé par le navigateur, ou appareil passé d'un compte à l'autre.
		await api('subscribe', { application: APP, subscription: sub.toJSON() }, true)
		pushState.subscribed = true
		pushState.devices += 1
	}
	pushState.loaded = true
	syncPresence()
}

export async function enablePush() {
	if (pushState.busy) return
	pushState.busy = true
	try {
		if (!publicKey) await refreshPush()
		if (!pushState.enabled || !publicKey) throw new Error('Les notifications ne sont pas activées sur le CRM.')
		const permission = await Notification.requestPermission()
		if (permission !== 'granted') {
			pushState.support = detectSupport()
			throw new Error(
				permission === 'denied'
					? 'Les notifications sont bloquées pour Aures Commercial dans les réglages du téléphone.'
					: 'Autorisation non accordée.',
			)
		}
		const reg = (await registration()) ?? (await navigator.serviceWorker.ready)
		let sub = await reg.pushManager.getSubscription()
		if (!sub) {
			sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) })
		}
		await api('subscribe', { application: APP, subscription: sub.toJSON() }, true)
		dismissPushInvite()
		await refreshPush()
		activerVersionEnAttente(reg)
	} finally {
		pushState.busy = false
	}
}

export async function disablePush() {
	if (pushState.busy) return
	pushState.busy = true
	try {
		const sub = await currentSubscription()
		if (sub) {
			await api('unsubscribe', { endpoint: sub.endpoint }, true)
			await sub.unsubscribe().catch(() => false)
		}
		await refreshPush()
	} finally {
		pushState.busy = false
	}
}

export async function sendTestPush() {
	return api<{ delivered: number; devices: number }>('send_test', { application: APP }, true)
}

export async function savePushPreferences(actives: string[]) {
	pushState.preferences = await api<PushCategory[]>('set_preferences', { application: APP, actives }, true)
}

// ---------------------------------------------------------------------------
// Présence : pas de push pendant que l'app est à l'écran
// ---------------------------------------------------------------------------
function sendPresence(visible: boolean) {
	api('presence', { application: APP, visible: visible ? 1 : 0 }, true).catch(() => {})
}

function syncPresence() {
	const actif = pushState.enabled && pushState.devices > 0 && document.visibilityState === 'visible'
	if (actif && !presenceTimer) {
		sendPresence(true)
		presenceTimer = setInterval(() => sendPresence(true), PRESENCE_MS)
	} else if (!actif && presenceTimer) {
		clearInterval(presenceTimer)
		presenceTimer = null
		sendPresence(false)
	}
}

// ---------------------------------------------------------------------------
// Invitation douce (une fois, dans l'app installée)
// ---------------------------------------------------------------------------
export function shouldInvitePush() {
	if (!pushState.loaded || !pushState.enabled || pushState.subscribed) return false
	if (pushState.support !== 'ok' || Notification.permission !== 'default' || !isStandalone()) return false
	try {
		return localStorage.getItem(STORAGE_INVITE) !== '1'
	} catch {
		return false
	}
}

export function dismissPushInvite() {
	try {
		localStorage.setItem(STORAGE_INVITE, '1')
	} catch {
		/* stockage indisponible : l'invitation reviendra */
	}
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------
/** Au démarrage de l'app : clic sur une notification → routeur, état serveur, présence. */
export function initPush(router: Router) {
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.addEventListener('message', (event) => {
			if (event.data?.type !== 'push-navigate') return
			const url = new URL(event.data.url, window.location.origin)
			const path = url.pathname.startsWith(SCOPE) ? url.pathname.slice(SCOPE.length) || '/' : url.pathname
			router.push(path + url.search).catch(() => {})
		})
	}
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible' && pushState.loaded) refreshPush().catch(() => {})
		else syncPresence()
	})
	if (isLoggedIn()) refreshPush().catch(() => {})
}
