/**
 * Données de la PWA commerciale : un instantané gardé dans IndexedDB, rechargé page par page
 * depuis `aurescrm.api.commercial_mobile`. L'application s'ouvre et se consulte sans réseau ;
 * la synchro reprend dès que le réseau revient.
 *
 * Lot 1 : lecture seule (clients, contacts, articles, visites, RDV, appels). La file des saisies
 * hors-ligne (moteur de MediConnect Field) arrive avec la saisie des visites.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, isAuthError, loginUrl, logout as apiLogout, mobileApi } from '@/lib/api'
import { idbClear, idbGet, idbSet } from '@/lib/idb'
import { toServerDateTime } from '@/lib/format'
import type { Appel, Article, ArticleHistory, Bundle, Client, Contact, RendezVous, SyncMeta, Visite } from '@/types'

export const SYNC_PAGE_LENGTH = 500
/** Synchro automatique tant que l'application est ouverte. */
const AUTO_SYNC_MS = 5 * 60 * 1000
const BUNDLE_KEY = 'bundle'
const historyKey = (article: string) => `history:${article}`

/** Une liste de l'instantané, page après page ; une ligne déplacée entre deux pages n'apparaît qu'une fois. */
export async function pullSection<T>(section: string, keyOf: (row: T) => string): Promise<T[]> {
	const rows = new Map<string, T>()
	let start = 0
	for (;;) {
		const page = await mobileApi<T[]>('get_sync_page', { section, start, page_length: SYNC_PAGE_LENGTH })
		for (const row of page) {
			const key = keyOf(row)
			if (!rows.has(key)) rows.set(key, row)
		}
		start += page.length
		if (page.length < SYNC_PAGE_LENGTH) return [...rows.values()]
	}
}

/** Instantané complet, assemblé avant d'être gardé : si une page échoue, le précédent reste en place. */
export async function pullSnapshot(): Promise<Bundle> {
	const meta = await mobileApi<SyncMeta>('get_sync_bundle')
	const byName = (row: { name: string }) => row.name
	const clients = await pullSection<Client>('clients', byName)
	const contacts = await pullSection<Contact>('contacts', (c) => c.cle)
	const articles = await pullSection<Article>('articles', byName)
	const visites = await pullSection<Visite>('visites', byName)
	const rdv = await pullSection<RendezVous>('rdv', byName)
	const appels = await pullSection<Appel>('appels', byName)
	return { ...meta, clients, contacts, articles, visites, rdv, appels, synced_at: toServerDateTime() }
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string | null | undefined) {
	const groups = new Map<string, T[]>()
	for (const row of rows) {
		const key = keyOf(row)
		if (!key) continue
		const list = groups.get(key)
		if (list) list.push(row)
		else groups.set(key, [row])
	}
	return groups
}

export const useCommercialStore = defineStore('commercial', () => {
	const bundle = ref<Bundle | null>(null)
	const loaded = ref(false)
	const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
	const syncing = ref(false)
	const syncError = ref<string | null>(null)
	const storageError = ref(false)
	const histories = ref<Record<string, ArticleHistory>>({})

	const clients = computed(() => bundle.value?.clients ?? [])
	const articles = computed(() => bundle.value?.articles ?? [])
	const visites = computed(() => bundle.value?.visites ?? [])
	const rdv = computed(() => bundle.value?.rdv ?? [])
	const appels = computed(() => bundle.value?.appels ?? [])
	const user = computed(() => bundle.value?.user ?? null)
	const references = computed(() => bundle.value?.references ?? null)

	const clientsByName = computed(() => new Map(clients.value.map((c) => [c.name, c])))
	const articlesByName = computed(() => new Map(articles.value.map((a) => [a.name, a])))
	const articlesByClient = computed(() => groupBy(articles.value, (a) => a.client))
	const contactsByClient = computed(() => groupBy(bundle.value?.contacts ?? [], (c) => c.client))
	const visitesByClient = computed(() => groupBy(visites.value, (v) => v.client))
	const rdvByClient = computed(() => groupBy(rdv.value, (r) => r.client))
	const appelsByClient = computed(() => groupBy(appels.value, (a) => a.client))

	async function load() {
		try {
			bundle.value = (await idbGet<Bundle>(BUNDLE_KEY)) ?? null
		} catch {
			storageError.value = true
		}
		loaded.value = true
	}

	async function persist() {
		if (!bundle.value) return
		try {
			await idbSet(BUNDLE_KEY, bundle.value)
			storageError.value = false
		} catch {
			storageError.value = true
		}
	}

	async function handleAuthError() {
		// Session terminée ou autre compte : rien d'un commercial ne reste sur l'appareil.
		await idbClear().catch(() => {})
		navigator.serviceWorker?.controller?.postMessage('clear-caches')
		window.location.href = loginUrl()
	}

	async function sync() {
		if (syncing.value) return
		if (!online.value) {
			syncError.value = null
			return
		}
		syncing.value = true
		try {
			const next = await pullSnapshot()
			if (bundle.value && bundle.value.user.name !== next.user.name) {
				// Un autre compte s'est connecté sur cet appareil : on repart d'une base vide.
				histories.value = {}
				await idbClear().catch(() => {})
			}
			bundle.value = next
			await persist()
			syncError.value = null
		} catch (error) {
			if (isAuthError(error)) return handleAuthError()
			syncError.value = error instanceof ApiError && error.offline ? null : (error as Error).message
		} finally {
			syncing.value = false
		}
	}

	let started = false
	function start() {
		if (started) return
		started = true
		window.addEventListener('online', () => {
			online.value = true
			sync()
		})
		window.addEventListener('offline', () => {
			online.value = false
		})
		setInterval(() => {
			if (document.visibilityState === 'visible') sync()
		}, AUTO_SYNC_MS)
	}

	async function init() {
		await load()
		start()
		await sync()
	}

	/** Historique gardé de l'article (dernier consulté), sans appel réseau. */
	async function cachedHistory(article: string) {
		if (histories.value[article]) return histories.value[article]
		const saved = await idbGet<ArticleHistory>(historyKey(article)).catch(() => undefined)
		if (saved) histories.value[article] = saved
		return saved ?? null
	}

	/** Historique à jour (en ligne) ; hors-ligne, la dernière version consultée. */
	async function fetchHistory(article: string) {
		const cached = await cachedHistory(article)
		if (!online.value) return cached
		try {
			const fresh = await mobileApi<ArticleHistory>('get_article_history', { item: article })
			histories.value[article] = fresh
			idbSet(historyKey(article), fresh).catch(() => {})
			return fresh
		} catch (error) {
			if (isAuthError(error)) {
				await handleAuthError()
				return null
			}
			if (cached) return cached
			throw error
		}
	}

	async function logout() {
		try {
			await apiLogout()
		} catch {
			/* hors-ligne : la session expirera côté serveur */
		}
		await idbClear().catch(() => {})
		navigator.serviceWorker?.controller?.postMessage('clear-caches')
		window.location.href = loginUrl()
	}

	return {
		bundle,
		loaded,
		online,
		syncing,
		syncError,
		storageError,
		clients,
		articles,
		visites,
		rdv,
		appels,
		user,
		references,
		clientsByName,
		articlesByName,
		articlesByClient,
		contactsByClient,
		visitesByClient,
		rdvByClient,
		appelsByClient,
		init,
		sync,
		cachedHistory,
		fetchHistory,
		logout,
	}
})
