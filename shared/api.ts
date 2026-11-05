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

let sessionExpiredHandler: (() => void) | null = null

/** Action à mener quand un appel est refusé parce que la session n'existe plus. */
export function onSessionExpired(handler: () => void) {
	sessionExpiredHandler = handler
}

/**
 * Frappe ne pose `session_expired` que sur la première réponse après l'expiration, puis retire ses cookies.
 * Les appels suivants, dans cet onglet ou un autre, se reconnaissent à l'absence du cookie `user_id`.
 */
function checkSession(status: number, body: any) {
	if (status !== 401 && status !== 403) return
	const user = document.cookie.match(/(?:^|;\s*)user_id=([^;]*)/)?.[1]
	if (!body?.session_expired && user && user !== 'Guest') return
	// Une seule fois : plusieurs appels partis en même temps échouent ensemble.
	const handler = sessionExpiredHandler
	sessionExpiredHandler = null
	handler?.()
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
		checkSession(response.status, body)
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
	if (!response.ok) {
		checkSession(response.status, body)
		throw new ApiError(serverMessage(body) || `Envoi refusé (${response.status}).`, response.status)
	}
	return body.message
}

export interface UploadedFile {
	name: string
	file_name: string
	file_url: string
}

const UPLOAD_TIMEOUT_MS = 15 * 60 * 1000

/** Comme `uploadFile`, avec l'avancement et l'annulation : `fetch` ne sait pas suivre un envoi. */
export function sendFile(file: File, doctype: string, docname: string, options: { onProgress?: (loaded: number) => void; signal?: AbortSignal } = {}) {
	return new Promise<UploadedFile>((resolve, reject) => {
		const form = new FormData()
		form.append('file', file, file.name)
		form.append('doctype', doctype)
		form.append('docname', docname)
		form.append('is_private', '1')
		const request = new XMLHttpRequest()
		const failed = () => reject(new ApiError("L'envoi du fichier a échoué : vérifiez votre connexion.", 0, true))
		request.open('POST', '/api/method/upload_file')
		request.timeout = UPLOAD_TIMEOUT_MS
		request.setRequestHeader('Accept', 'application/json')
		request.setRequestHeader('X-Frappe-CSRF-Token', window.csrf_token || '')
		request.upload.onprogress = (event) => {
			// L'en-tête du formulaire compte dans `loaded` : la barre ne dépasse jamais la taille du fichier.
			if (event.lengthComputable) options.onProgress?.(Math.min(file.size, event.loaded))
		}
		request.onerror = failed
		request.ontimeout = failed
		request.onabort = () => reject(new ApiError("L'envoi a été annulé.", 0))
		request.onload = () => {
			let body: Record<string, any> = {}
			try {
				body = JSON.parse(request.responseText)
			} catch {
				// Une réponse illisible vient d'un intermédiaire, comme nginx quand le fichier dépasse sa limite.
			}
			if (request.status >= 200 && request.status < 300) {
				resolve(body.message as UploadedFile)
				return
			}
			try {
				checkSession(request.status, body)
			} catch (e) {
				reject(e)
				return
			}
			const tooLarge = request.status === 413 ? 'Le serveur refuse ce fichier : il est trop lourd.' : ''
			reject(new ApiError(tooLarge || serverMessage(body) || `Envoi refusé (${request.status}).`, request.status))
		}
		if (options.signal?.aborted) {
			reject(new ApiError("L'envoi a été annulé.", 0))
			return
		}
		options.signal?.addEventListener('abort', () => request.abort())
		request.send(form)
	})
}

const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024
let maxFileSize: Promise<number> | null = null

/** Taille maximale d'un fichier selon le serveur, demandée une seule fois. */
export function getMaxFileSize() {
	maxFileSize ??= call<number>('frappe.core.api.file.get_max_file_size')
		.then((value) => Number(value) || DEFAULT_MAX_FILE_SIZE)
		.catch(() => DEFAULT_MAX_FILE_SIZE)
	return maxFileSize
}

export function isAuthError(error: unknown) {
	return error instanceof ApiError && (error.status === 401 || error.status === 403)
}
