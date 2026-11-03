/** Appels Frappe de la PWA : jeton CSRF rechargeable, erreurs normalisées. */

declare global {
	interface Window {
		csrf_token?: string
		user?: string | null
	}
}

export class ApiError extends Error {
	status: number
	offline: boolean
	constructor(message: string, status = 0, offline = false) {
		super(message)
		this.status = status
		this.offline = offline
	}
}

/** Délai au-delà duquel une requête est abandonnée : un réseau dégradé ne bloque pas la synchro. */
export const REQUEST_TIMEOUT_MS = 30 * 1000
/** L'envoi d'un lot de saisies peut être plus long (signatures, recalculs). */
export const PUSH_TIMEOUT_MS = 90 * 1000

const MOBILE = 'aurescrm.api.commercial_mobile'

function serverMessage(body: any): string | null {
	try {
		if (body?._server_messages) {
			const messages = JSON.parse(body._server_messages)
			const first = JSON.parse(messages[0])
			return (first.message || '').replace(/<[^>]+>/g, '')
		}
	} catch {
		/* message non structuré */
	}
	return body?.exception ? String(body.exception).split(':').slice(1).join(':').trim() : null
}

export async function call<T = any>(
	method: string,
	params: Record<string, unknown> = {},
	post = false,
	timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
	let response: Response
	const controller = typeof AbortController === 'undefined' ? null : new AbortController()
	const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
	try {
		if (post) {
			response = await fetch(`/api/method/${method}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					'X-Frappe-CSRF-Token': window.csrf_token || '',
				},
				body: JSON.stringify(params),
				credentials: 'same-origin',
				signal: controller?.signal,
			})
		} else {
			const query = new URLSearchParams()
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== null) {
					query.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
				}
			}
			response = await fetch(`/api/method/${method}?${query.toString()}`, {
				headers: { Accept: 'application/json' },
				credentials: 'same-origin',
				// Les données du commercial ne restent pas dans le cache HTTP du navigateur.
				cache: 'no-store',
				signal: controller?.signal,
			})
		}
	} catch {
		// Coupure ou délai dépassé : traité comme une absence de réseau, la saisie reste en file.
		throw new ApiError('Pas de connexion réseau.', 0, true)
	} finally {
		if (timer) clearTimeout(timer)
	}
	const body = await response.json().catch(() => ({}))
	if (!response.ok) {
		throw new ApiError(serverMessage(body) || `Erreur serveur (${response.status}).`, response.status)
	}
	return body.message as T
}

export const mobileApi = <T = any>(method: string, params?: Record<string, unknown>, post = false, timeoutMs?: number) =>
	call<T>(`${MOBILE}.${method}`, params, post, timeoutMs)

/** Recharge le jeton CSRF (application rouverte depuis le cache hors-ligne). */
export async function refreshBoot() {
	const boot = await call<{ csrf_token: string; user: string | null }>('aurescrm.www.commercial.get_commercial_boot')
	window.csrf_token = boot.csrf_token
	window.user = boot.user
	return boot
}

export function isAuthError(error: unknown) {
	return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

export const HOME_PATH = '/commercial'
export const LOGIN_PATH = '/commercial/connexion'

/** Retour après connexion : une page de la PWA seulement, jamais une adresse d'un autre site. */
export function safeRedirect(target: string | null | undefined) {
	const value = (target || '').trim()
	if (!/^\/commercial(?:[/?#]|$)/.test(value) || value.startsWith(LOGIN_PATH)) return HOME_PATH
	return value
}

/** Page de connexion de la PWA, avec la page où revenir ensuite. */
export function loginUrl(redirect: string = HOME_PATH) {
	const target = safeRedirect(redirect)
	return target === HOME_PATH ? LOGIN_PATH : `${LOGIN_PATH}?redirect-to=${encodeURIComponent(target)}`
}

/** Connexion Frappe (même méthode que la page /login du site). */
export const login = (usr: string, pwd: string) => call<string>('login', { usr, pwd }, true)

/** Envoi du lien de réinitialisation : réponse identique que le compte existe ou non. */
export const resetPassword = (user: string) => call('frappe.core.doctype.user.user.reset_password', { user }, true)

/** Déconnexion Frappe (la session du Desk est la même). */
export const logout = () => call('logout', {}, true)
