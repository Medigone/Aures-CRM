import { ApiError, call, isAuthError, REQUEST_TIMEOUT_MS } from '@shared/api'

export { ApiError, call, isAuthError, REQUEST_TIMEOUT_MS }

/** L'envoi d'un lot de saisies peut être plus long (signatures, recalculs). */
export const PUSH_TIMEOUT_MS = 90 * 1000

const MOBILE = 'aurescrm.api.commercial_mobile'

export const mobileApi = <T = any>(method: string, params?: Record<string, unknown>, post = false, timeoutMs?: number) =>
	call<T>(`${MOBILE}.${method}`, params, post, timeoutMs)

/** Recharge le jeton CSRF (application rouverte depuis le cache hors-ligne). */
export async function refreshBoot() {
	const boot = await call<{ csrf_token: string; user: string | null }>('aurescrm.www.commercial.get_commercial_boot')
	window.csrf_token = boot.csrf_token
	window.user = boot.user
	return boot
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
