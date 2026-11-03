/**
 * Données de la PWA commerciale.
 *
 * - `server` : le dernier instantané reçu (aurescrm.api.commercial_mobile), gardé dans IndexedDB ;
 * - `outbox` : les saisies faites sur l'appareil, pas encore confirmées par le serveur ;
 * - `bundle` : ce que l'application affiche, l'instantané avec les saisies en attente rejouées par-dessus.
 *
 * La synchro envoie d'abord la file (actions idempotentes, journal serveur `Mutation Commercial`),
 * puis recharge l'instantané. Une action refusée (validation, droits) ou qui échoue trop souvent passe
 * dans `failed` : le commercial la réessaie ou l'abandonne depuis la page Synchronisation.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, call, isAuthError, loginUrl, logout as apiLogout, mobileApi, PUSH_TIMEOUT_MS, refreshBoot } from '@/lib/api'
import { idbClear, idbDelete, idbGet, idbSet } from '@/lib/idb'
import { addDays, toServerDateTime, uid, weekStart } from '@/lib/format'
import { applyMutation, CREATES, localKey, MAX_ATTEMPTS, retryDelayMs, type Mutation, type MutationType } from '@/lib/mutations'
import { clearContentIndex, prefetchFiles, prefetchPlan } from '@/lib/contentCache'
import { connectRealtime, isForeignChange, throttledReload } from '@/lib/realtime'
import type {
	Appel,
	Article,
	ArticleHistory,
	Bat,
	Bundle,
	Client,
	Commande,
	Contact,
	Creance,
	CreanceDetail,
	Devis,
	Reclamation,
	RendezVous,
	SyncMeta,
	Ticket,
	TicketCycle,
	Visite,
} from '@/types'

export const SYNC_PAGE_LENGTH = 500
/** Synchro automatique tant que l'application est ouverte. */
const AUTO_SYNC_MS = 5 * 60 * 1000
const PUSH_BATCH = 50
const BUNDLE_KEY = 'bundle'
const STATE_KEY = 'state'
/** Consultations en ligne gardées sur l'appareil : historique d'article, cycle de ticket, détail de créance. */
const ONLINE = {
	history: { method: 'aurescrm.api.commercial_mobile.get_article_history', param: 'item' },
	cycle: { method: 'aurescrm.api.commercial_affaires.get_ticket_cycle', param: 'ticket' },
	creance: { method: 'aurescrm.api.commercial_affaires.get_creance_detail', param: 'creance' },
} as const
type OnlineKind = keyof typeof ONLINE
const PUSH_METHOD = 'aurescrm.api.commercial_mobile.push_mutations'

type PushResult = { id: string; ok: boolean; retry: boolean; result: { doctype?: string; name?: string } | null; error: string | null }

/** État des saisies, gardé à part de l'instantané (petit, réécrit à chaque saisie). */
type OutboxState = {
	/** Compte qui a fait les saisies : elles ne partent jamais sous un autre compte. */
	owner: string | null
	outbox: Mutation[]
	failed: Mutation[]
	/** Clé locale → nom serveur, pour suivre une fiche ouverte avant sa création serveur. */
	aliases: Record<string, string>
	/** Actions acceptées par le serveur mais pas encore dans l'instantané (rechargé juste après). */
	applied?: Mutation[]
}

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
	const creances = await pullSection<Creance>('creances', byName)
	const tickets = await pullSection<Ticket>('tickets', byName)
	const devis = await pullSection<Devis>('devis', byName)
	const commandes = await pullSection<Commande>('commandes', byName)
	const reclamations = await pullSection<Reclamation>('reclamations', byName)
	const bats = await pullSection<Bat>('bats', byName)
	return {
		...meta,
		clients,
		contacts,
		articles,
		visites,
		rdv,
		appels,
		creances,
		tickets,
		devis,
		commandes,
		reclamations,
		bats,
		synced_at: toServerDateTime(),
	}
}

/** Un document créé sur l'appareil, accepté par le serveur, prend son nom serveur (et ses liens `client` suivent). */
function renameLocal(view: Bundle, local: string, name: string): Bundle {
	const next: Record<string, unknown> = { ...view }
	for (const [key, value] of Object.entries(view)) {
		if (!Array.isArray(value)) continue
		const rows = value as { name?: string; client?: string }[]
		if (!rows.some((row) => row && (row.name === local || row.client === local))) continue
		next[key] = rows.map((row) =>
			row && (row.name === local || row.client === local)
				? { ...row, ...(row.name === local ? { name } : {}), ...(row.client === local ? { client: name } : {}) }
				: row,
		)
	}
	return next as Bundle
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
	const server = ref<Bundle | null>(null)
	const outbox = ref<Mutation[]>([])
	const failed = ref<Mutation[]>([])
	const owner = ref<string | null>(null)
	const aliases = ref<Record<string, string>>({})
	const applied = ref<Mutation[]>([])
	const loaded = ref(false)
	const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
	const syncing = ref(false)
	const syncError = ref<string | null>(null)
	const storageError = ref(false)
	/** Saisies d'un autre compte sur cet appareil : elles ne partent pas sous la session actuelle. */
	const foreignOutbox = ref(false)
	/** Dernières consultations en ligne, par `<sorte>:<nom>`. */
	const consulted = ref<Record<string, unknown>>({})

	const user = computed(() => server.value?.user ?? null)

	/**
	 * Une action qui vise un document créé sur l'appareil (`<champ>_ref`) vise son nom serveur dès que la
	 * création est confirmée : l'instantané rechargé contient la ligne serveur, plus la ligne locale.
	 */
	function withAliases(mutation: Mutation): Mutation {
		let payload = mutation.payload
		for (const [field, value] of Object.entries(mutation.payload)) {
			if (!field.endsWith('_ref') || typeof value !== 'string') continue
			const alias = aliases.value[localKey(value)]
			if (!alias) continue
			const { [field]: _ref, ...rest } = payload
			payload = { ...rest, [field.slice(0, -4)]: alias }
		}
		return payload === mutation.payload ? mutation : { ...mutation, payload }
	}
	/**
	 * Instantané + saisies en attente (et en échec, tant qu'elles ne sont pas abandonnées) + saisies acceptées
	 * que l'instantané ne contient pas encore : sans elles, un document créé disparaîtrait entre l'envoi et le
	 * rechargement (page vide). Une création acceptée prend aussitôt son nom serveur.
	 */
	const bundle = computed<Bundle | null>(() => {
		if (!server.value) return null
		const who = { name: owner.value || server.value.user.name, full_name: server.value.user.full_name }
		let view = server.value
		const pending = [...applied.value, ...failed.value, ...outbox.value].sort((a, b) => a.created_at.localeCompare(b.created_at))
		for (const mutation of pending) {
			view = applyMutation(view, withAliases(mutation), who)
			const alias = CREATES.includes(mutation.type) ? aliases.value[localKey(mutation.id)] : undefined
			if (alias) view = renameLocal(view, localKey(mutation.id), alias)
		}
		return view
	})

	const clients = computed(() => bundle.value?.clients ?? [])
	const articles = computed(() => bundle.value?.articles ?? [])
	const visites = computed(() => bundle.value?.visites ?? [])
	const rdv = computed(() => bundle.value?.rdv ?? [])
	const appels = computed(() => bundle.value?.appels ?? [])
	const creances = computed(() => bundle.value?.creances ?? [])
	const tickets = computed(() => bundle.value?.tickets ?? [])
	const devis = computed(() => bundle.value?.devis ?? [])
	const commandes = computed(() => bundle.value?.commandes ?? [])
	const reclamations = computed(() => bundle.value?.reclamations ?? [])
	const bats = computed(() => bundle.value?.bats ?? [])
	const references = computed(() => bundle.value?.references ?? null)

	const clientsByName = computed(() => new Map(clients.value.map((c) => [c.name, c])))
	const articlesByName = computed(() => new Map(articles.value.map((a) => [a.name, a])))
	const visitesByName = computed(() => new Map(visites.value.map((v) => [v.name, v])))
	const rdvByName = computed(() => new Map(rdv.value.map((r) => [r.name, r])))
	const appelsByName = computed(() => new Map(appels.value.map((a) => [a.name, a])))
	const articlesByClient = computed(() => groupBy(articles.value, (a) => a.client))
	const contactsByClient = computed(() => groupBy(bundle.value?.contacts ?? [], (c) => c.client))
	const visitesByClient = computed(() => groupBy(visites.value, (v) => v.client))
	const rdvByClient = computed(() => groupBy(rdv.value, (r) => r.client))
	const appelsByClient = computed(() => groupBy(appels.value, (a) => a.client))
	const creancesByClient = computed(() => groupBy(creances.value, (c) => c.client))
	const ticketsByName = computed(() => new Map(tickets.value.map((t) => [t.name, t])))
	const devisByName = computed(() => new Map(devis.value.map((d) => [d.name, d])))
	const commandesByName = computed(() => new Map(commandes.value.map((c) => [c.name, c])))
	const reclamationsByName = computed(() => new Map(reclamations.value.map((r) => [r.name, r])))
	const ticketsByClient = computed(() => groupBy(tickets.value, (t) => t.client))
	const devisByClient = computed(() => groupBy(devis.value, (d) => d.client))
	const commandesByClient = computed(() => groupBy(commandes.value, (c) => c.client))
	const reclamationsByClient = computed(() => groupBy(reclamations.value, (r) => r.client))
	const batsByArticle = computed(() => groupBy(bats.value, (b) => b.article))
	const pendingCount = computed(() => outbox.value.length)

	// -----------------------------------------------------------------------
	// Persistance
	// -----------------------------------------------------------------------
	async function load() {
		try {
			server.value = (await idbGet<Bundle>(BUNDLE_KEY)) ?? null
			const state = await idbGet<OutboxState>(STATE_KEY)
			if (state) {
				owner.value = state.owner
				outbox.value = state.outbox ?? []
				failed.value = state.failed ?? []
				aliases.value = state.aliases ?? {}
				applied.value = state.applied ?? []
			}
		} catch {
			storageError.value = true
		}
		loaded.value = true
	}

	let writes: Promise<unknown> = Promise.resolve()
	/** Écritures sérialisées : une saisie rapide ne réécrit jamais un état plus récent par un plus ancien. */
	function queueWrite(key: string, value: () => unknown) {
		writes = writes
			.then(() => idbSet(key, value()))
			.then(() => (storageError.value = false))
			.catch(() => (storageError.value = true))
		return writes
	}
	const persistState = () =>
		queueWrite(STATE_KEY, () => ({ owner: owner.value, outbox: outbox.value, failed: failed.value, aliases: aliases.value, applied: applied.value }) satisfies OutboxState)
	const persistServer = () => queueWrite(BUNDLE_KEY, () => server.value)

	// -----------------------------------------------------------------------
	// Saisies
	// -----------------------------------------------------------------------
	let pushTimer: ReturnType<typeof setTimeout> | null = null

	/** Met une action en file ; elle s'affiche tout de suite et part dès que possible. Renvoie son id. */
	function enqueue(type: MutationType, payload: Record<string, any>, target = '') {
		const id = uid()
		if (!owner.value || (!outbox.value.length && !failed.value.length)) owner.value = server.value?.user.name ?? window.user ?? null
		outbox.value = [
			...outbox.value,
			{ id, type, payload: { ...payload, created_at: toServerDateTime() }, target: target || localKey(id), created_at: toServerDateTime(), attempts: 0, next_at: null },
		]
		persistState()
		if (pushTimer) clearTimeout(pushTimer)
		pushTimer = setTimeout(() => sync(), 300)
		return id
	}

	/** Clé suivie par une fiche : une clé locale devient le nom serveur une fois la création confirmée. */
	function resolveKey(key: string) {
		return aliases.value[key] ?? key
	}

	function retryFailed(id: string) {
		const mutation = failed.value.find((m) => m.id === id)
		if (!mutation) return
		failed.value = failed.value.filter((m) => m.id !== id)
		outbox.value = [...outbox.value, { ...mutation, attempts: 0, next_at: null, error: null }].sort((a, b) => a.created_at.localeCompare(b.created_at))
		persistState()
		sync()
	}

	function discardFailed(id: string) {
		failed.value = failed.value.filter((m) => m.id !== id)
		persistState()
	}

	/** Envoie les actions dues, dans l'ordre de saisie. Faux si le réseau a lâché. */
	async function pushOutbox(): Promise<boolean> {
		const now = Date.now()
		const due = outbox.value.filter((m) => !m.next_at || m.next_at <= now)
		for (let i = 0; i < due.length; i += PUSH_BATCH) {
			const batch = due.slice(i, i + PUSH_BATCH)
			let results: PushResult[]
			try {
				results = await call<PushResult[]>(
					PUSH_METHOD,
					{ mutations: batch.map((m) => ({ id: m.id, type: m.type, payload: m.payload })) },
					true,
					PUSH_TIMEOUT_MS,
				)
			} catch (error) {
				if (error instanceof ApiError && error.offline) return false
				throw error
			}
			const byId = new Map(results.map((r) => [r.id, r]))
			const keep: Mutation[] = []
			const newlyFailed: Mutation[] = []
			for (const mutation of outbox.value) {
				const result = byId.get(mutation.id)
				if (!result) {
					keep.push(mutation)
				} else if (result.ok) {
					if (CREATES.includes(mutation.type) && result.result?.name) {
						aliases.value = { ...aliases.value, [localKey(mutation.id)]: result.result.name }
					}
				} else if (result.retry && mutation.attempts + 1 < MAX_ATTEMPTS) {
					const attempts = mutation.attempts + 1
					keep.push({ ...mutation, attempts, next_at: Date.now() + retryDelayMs(attempts), error: result.error })
				} else {
					newlyFailed.push({ ...mutation, attempts: mutation.attempts + 1, error: result.error })
				}
			}
			outbox.value = keep
			failed.value = [...failed.value, ...newlyFailed]
			applied.value = [...applied.value, ...batch.filter((m) => byId.get(m.id)?.ok)]
			await persistState()
		}
		return true
	}

	// -----------------------------------------------------------------------
	// Synchro
	// -----------------------------------------------------------------------
	async function handleAuthError() {
		// Session terminée : l'instantané est effacé, les saisies non envoyées restent pour la reconnexion.
		await idbDelete(BUNDLE_KEY).catch(() => {})
		if (!outbox.value.length && !failed.value.length) await idbClear().catch(() => {})
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
			if (outbox.value.length) {
				// Jeton CSRF frais (application ouverte depuis le cache) et compte réellement connecté.
				const boot = await refreshBoot()
				foreignOutbox.value = Boolean(owner.value && boot.user && boot.user !== owner.value)
				if (!foreignOutbox.value && !(await pushOutbox())) return
			}
			const next = await pullSnapshot()
			if (server.value && server.value.user.name !== next.user.name) {
				// Autre compte sur cet appareil : l'ancien instantané et ses historiques sont effacés.
				consulted.value = {}
				clearContentIndex()
				await idbDelete(BUNDLE_KEY).catch(() => {})
			}
			server.value = next
			// L'instantané contient désormais tout ce qui a été accepté avant son chargement.
			applied.value = []
			await persistServer()
			await persistState()
			syncError.value = null
			prefetchWeekFiles()
		} catch (error) {
			if (isAuthError(error)) return handleAuthError()
			syncError.value = error instanceof ApiError && error.offline ? null : (error as Error).message
		} finally {
			syncing.value = false
		}
	}

	/** Abandonne les saisies d'un autre compte (après confirmation) pour reprendre l'appareil. */
	async function discardForeignOutbox() {
		outbox.value = []
		failed.value = []
		aliases.value = {}
		applied.value = []
		owner.value = server.value?.user.name ?? null
		foreignOutbox.value = false
		await persistState()
		await sync()
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
		// Temps réel : un changement fait ailleurs (Desk, autre appareil) recharge l'instantané, par rafales regroupées.
		const reload = throttledReload(() => sync())
		connectRealtime(
			(event) => {
				if (isForeignChange(event, server.value?.user.name ?? window.user)) reload()
			},
			reload,
		)
		// Une action en attente de nouvel essai repart à l'heure prévue, sans attendre la synchro suivante.
		setInterval(() => {
			const now = Date.now()
			if (outbox.value.some((m) => m.next_at && m.next_at <= now)) sync()
		}, 15000)
	}

	async function init() {
		await load()
		start()
		await sync()
	}

	// -----------------------------------------------------------------------
	// Fichiers de la semaine : dernier BAT des articles des clients visités ou rencontrés cette semaine
	// -----------------------------------------------------------------------
	function weekClients() {
		const from = weekStart()
		const to = addDays(from, 7)
		const clients = new Set<string>()
		for (const v of visites.value) if (v.date >= from && v.date < to && v.client) clients.add(v.client)
		for (const r of rdv.value) {
			const day = (r.date_heure || '').slice(0, 10)
			if (r.client && day >= from && day < to) clients.add(r.client)
		}
		return clients
	}

	function prefetchWeekFiles() {
		// En arrière-plan, après la synchro : rien n'attend la fin du téléchargement.
		setTimeout(() => prefetchFiles(prefetchPlan(bats.value, weekClients())), 2000)
	}

	// -----------------------------------------------------------------------
	// Consultations en ligne (gardées après consultation)
	// -----------------------------------------------------------------------
	async function cachedOnline<T>(kind: OnlineKind, name: string): Promise<T | null> {
		const key = `${kind}:${name}`
		if (consulted.value[key]) return consulted.value[key] as T
		const saved = await idbGet<T>(key).catch(() => undefined)
		if (saved) consulted.value[key] = saved
		return saved ?? null
	}

	/** Version à jour (en ligne) ; hors-ligne ou en erreur, la dernière version consultée. */
	async function fetchOnline<T>(kind: OnlineKind, name: string): Promise<T | null> {
		const cached = await cachedOnline<T>(kind, name)
		if (!online.value) return cached
		try {
			const fresh = await call<T>(ONLINE[kind].method, { [ONLINE[kind].param]: name })
			consulted.value[`${kind}:${name}`] = fresh
			idbSet(`${kind}:${name}`, fresh).catch(() => {})
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

	const cachedHistory = (article: string) => cachedOnline<ArticleHistory>('history', article)
	const fetchHistory = (article: string) => fetchOnline<ArticleHistory>('history', article)
	const cachedCycle = (ticket: string) => cachedOnline<TicketCycle>('cycle', ticket)
	const fetchCycle = (ticket: string) => fetchOnline<TicketCycle>('cycle', ticket)
	const cachedCreance = (creance: string) => cachedOnline<CreanceDetail>('creance', creance)
	const fetchCreance = (creance: string) => fetchOnline<CreanceDetail>('creance', creance)

	async function logout() {
		try {
			await apiLogout()
		} catch {
			/* hors-ligne : la session expirera côté serveur */
		}
		await idbClear().catch(() => {})
		clearContentIndex()
		navigator.serviceWorker?.controller?.postMessage('clear-caches')
		window.location.href = loginUrl()
	}

	return {
		server,
		bundle,
		outbox,
		failed,
		owner,
		aliases,
		loaded,
		online,
		syncing,
		syncError,
		storageError,
		foreignOutbox,
		pendingCount,
		clients,
		articles,
		visites,
		rdv,
		appels,
		creances,
		tickets,
		devis,
		commandes,
		reclamations,
		bats,
		user,
		references,
		clientsByName,
		articlesByName,
		visitesByName,
		rdvByName,
		appelsByName,
		articlesByClient,
		contactsByClient,
		visitesByClient,
		rdvByClient,
		appelsByClient,
		creancesByClient,
		ticketsByName,
		devisByName,
		commandesByName,
		reclamationsByName,
		ticketsByClient,
		devisByClient,
		commandesByClient,
		reclamationsByClient,
		batsByArticle,
		init,
		sync,
		enqueue,
		resolveKey,
		retryFailed,
		discardFailed,
		discardForeignOutbox,
		cachedHistory,
		fetchHistory,
		cachedCycle,
		fetchCycle,
		cachedCreance,
		fetchCreance,
		logout,
	}
})
