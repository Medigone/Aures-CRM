/** Appels Frappe des applications Aures : jeton CSRF, erreurs normalisées. */

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
				// Les données métier ne restent pas dans le cache HTTP du navigateur.
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

/** Joint un fichier privé à un document, par l'API de fichiers de Frappe. */
export async function uploadFile(file: File, doctype: string, docname: string, timeoutMs = 120 * 1000) {
	const form = new FormData()
	form.append('file', file, file.name)
	form.append('doctype', doctype)
	form.append('docname', docname)
	form.append('is_private', '1')
	const controller = typeof AbortController === 'undefined' ? null : new AbortController()
	const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
	let response: Response
	try {
		response = await fetch('/api/method/upload_file', {
			method: 'POST',
			headers: { Accept: 'application/json', 'X-Frappe-CSRF-Token': window.csrf_token || '' },
			body: form,
			credentials: 'same-origin',
			signal: controller?.signal,
		})
	} catch {
		throw new ApiError("L'envoi du fichier a échoué : vérifiez votre connexion.", 0, true)
	} finally {
		if (timer) clearTimeout(timer)
	}
	const body = await response.json().catch(() => ({}))
	if (!response.ok) throw new ApiError(serverMessage(body) || `Envoi refusé (${response.status}).`, response.status)
	return body.message
}

export function isAuthError(error: unknown) {
	return error instanceof ApiError && (error.status === 401 || error.status === 403)
}
