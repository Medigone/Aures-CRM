import { ref } from 'vue'
import { fileUrl } from '@/lib/text'

/**
 * Fichiers gardés sur l'appareil pour les montrer hors ligne (Cache Storage) : BAT, fiches techniques,
 * tracés, maquettes. Un fichier ouvert « Garder hors-ligne » y reste ; la synchro y ajoute le dernier BAT
 * des articles des clients de la semaine.
 * Bornes : 25 Mo par fichier, 200 Mo en tout (les moins récemment ouverts partent d'abord).
 * Le cache `commercial-contents` survit aux mises à jour de l'application (sw.js) et part à la déconnexion.
 */
export const CONTENT_CACHE = 'commercial-contents'
const INDEX_KEY = 'commercial-contents-index'
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024
export const MAX_PREFETCH_FILES = 30

type Entry = { size: number; at: number }
type Index = Record<string, Entry>

function readIndex(): Index {
	try {
		return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}') as Index
	} catch {
		return {}
	}
}
function writeIndex(index: Index) {
	try {
		localStorage.setItem(INDEX_KEY, JSON.stringify(index))
	} catch {
		/* stockage indisponible : le cache reste lisible, l'index se reconstruit */
	}
	cachedUrls.value = new Set(Object.keys(index))
}

/** URLs disponibles hors ligne (réactif, pour les badges et les boutons). */
export const cachedUrls = ref<Set<string>>(new Set(Object.keys(readIndex())))

const supported = () => typeof caches !== 'undefined'

/** Fichier en cache, en URL locale (à révoquer par l'appelant) ; null s'il n'y est pas. */
export async function cachedObjectUrl(url: string): Promise<string | null> {
	if (!supported()) return null
	try {
		const cache = await caches.open(CONTENT_CACHE)
		const response = await cache.match(url)
		if (!response) return null
		const index = readIndex()
		if (index[url]) {
			index[url].at = Date.now()
			writeIndex(index)
		}
		return URL.createObjectURL(await response.blob())
	} catch {
		return null
	}
}

/** Télécharge et garde un fichier ; faux s'il est trop lourd, introuvable ou si le cache refuse. */
export async function cacheFile(url: string): Promise<boolean> {
	if (!supported()) return false
	if (readIndex()[url]) return true
	try {
		const response = await fetch(url, { credentials: 'same-origin' })
		if (!response.ok || response.redirected) return false
		const blob = await response.blob()
		if (!blob.size || blob.size > MAX_FILE_BYTES) return false
		const cache = await caches.open(CONTENT_CACHE)
		await cache.put(url, new Response(blob, { headers: { 'Content-Type': blob.type || response.headers.get('Content-Type') || 'application/octet-stream' } }))
		const index = readIndex()
		index[url] = { size: blob.size, at: Date.now() }
		writeIndex(index)
		await evict()
		return true
	} catch {
		return false
	}
}

/** Entrées à retirer : les plus anciennes au-delà du plafond. */
export function evictionPlan(index: Index, maxBytes: number): string[] {
	const removed: string[] = []
	let total = Object.values(index).reduce((sum, entry) => sum + entry.size, 0)
	for (const [url, entry] of Object.entries(index).sort((a, b) => a[1].at - b[1].at)) {
		if (total <= maxBytes) break
		removed.push(url)
		total -= entry.size
	}
	return removed
}

export async function evict() {
	if (!supported()) return
	const index = readIndex()
	const removed = evictionPlan(index, MAX_TOTAL_BYTES)
	if (!removed.length) return
	try {
		const cache = await caches.open(CONTENT_CACHE)
		await Promise.all(removed.map((url) => cache.delete(url)))
	} catch {
		/* cache indisponible */
	}
	for (const url of removed) delete index[url]
	writeIndex(index)
}

/** Déconnexion : le cache lui-même part avec les autres caches `commercial-*`. */
export function clearContentIndex() {
	try {
		localStorage.removeItem(INDEX_KEY)
	} catch {
		/* rien à effacer */
	}
	cachedUrls.value = new Set()
}

type BatFiles = { article: string; client: string; modified: string; image: string | null; fichier_valide: string | null }

/**
 * Fichiers à précharger : le dernier BAT (image puis fichier validé) de chaque article des clients
 * de la semaine, du BAT le plus récent au plus ancien, dans la limite de `maxFiles`.
 */
export function prefetchPlan(bats: BatFiles[], clients: Set<string>, maxFiles = MAX_PREFETCH_FILES): string[] {
	const latest = new Map<string, BatFiles>()
	for (const bat of bats) {
		if (!clients.has(bat.client)) continue
		const current = latest.get(bat.article)
		if (!current || bat.modified > current.modified) latest.set(bat.article, bat)
	}
	const plan: string[] = []
	for (const bat of [...latest.values()].sort((a, b) => b.modified.localeCompare(a.modified))) {
		for (const path of [bat.image, bat.fichier_valide]) {
			const url = fileUrl(path)
			if (!url || plan.includes(url)) continue
			if (plan.length >= maxFiles) return plan
			plan.push(url)
		}
	}
	return plan
}

let prefetching = false
/** Préchargement en arrière-plan (en ligne, hors mode économie de données). */
export async function prefetchFiles(urls: string[]) {
	const connection = (navigator as unknown as { connection?: { saveData?: boolean } }).connection
	if (prefetching || !supported() || !navigator.onLine || connection?.saveData) return
	prefetching = true
	try {
		for (const url of urls) {
			if (!navigator.onLine) break
			await cacheFile(url)
		}
	} finally {
		prefetching = false
	}
}
