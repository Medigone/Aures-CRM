import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// API simulée : instantané minimal, réponses de push_mutations pilotées par chaque test.
const api = vi.hoisted(() => ({ pushResponse: (_ids: string[]): any => [], pushCalls: [] as any[], bootUser: 'karim@aures.dz', offline: false, pullOffline: false }))

vi.mock('@/lib/api', () => {
	class ApiError extends Error {
		status: number
		offline: boolean
		constructor(message: string, status = 0, offline = false) {
			super(message)
			this.status = status
			this.offline = offline
		}
	}
	const meta = { server_time: '', user: { name: 'karim@aures.dz', full_name: 'Karim', image: null, roles: [], exempt: false }, references: {} }
	return {
		ApiError,
		PUSH_TIMEOUT_MS: 1000,
		isAuthError: () => false,
		loginUrl: () => '/login',
		logout: vi.fn(),
		refreshBoot: vi.fn(async () => ({ csrf_token: 't', user: api.bootUser })),
		mobileApi: vi.fn(async (method: string) => {
			if (api.pullOffline) throw new ApiError('Pas de connexion réseau.', 0, true)
			return method === 'get_sync_bundle' ? meta : []
		}),
		call: vi.fn(async (_method: string, params: any) => {
			if (api.offline) throw new ApiError('Pas de connexion réseau.', 0, true)
			api.pushCalls.push(params.mutations)
			return api.pushResponse(params.mutations.map((m: any) => m.id))
		}),
	}
})

async function freshStore() {
	// Une base par store : ceux des tests précédents tournent encore (minuteries, synchro) et écriraient leur état dans la même.
	globalThis.indexedDB = new IDBFactory()
	vi.resetModules()
	setActivePinia(createPinia())
	const { useCommercialStore } = await import('./commercial')
	const store = useCommercialStore()
	await store.init()
	return store
}

beforeEach(() => {
	// Minuteries simulées : celles d'une saisie ou d'un store ne se déclenchent jamais pendant un autre test.
	// (IndexedDB simulé repose sur setImmediate, laissé réel.)
	vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
	api.pushCalls = []
	api.bootUser = 'karim@aures.dz'
	api.offline = false
	api.pullOffline = false
	api.pushResponse = (ids) => ids.map((id) => ({ id, ok: true, retry: false, result: { doctype: 'Visite Commerciale', name: `VC-${id.slice(0, 4)}` }, error: null }))
})

afterEach(() => {
	vi.clearAllTimers()
	vi.useRealTimers()
})

describe('file des saisies', () => {
	it('envoie une saisie, la retire de la file et garde la correspondance clé locale → nom serveur', async () => {
		const store = await freshStore()
		const id = store.enqueue('visite_create', { client: 'CL-1', type_visite: 'Prospection' })
		await store.sync()
		expect(api.pushCalls).toHaveLength(1)
		expect(store.outbox).toHaveLength(0)
		expect(store.resolveKey(`local:${id}`)).toBe(`VC-${id.slice(0, 4)}`)
	})

	it("garde un document créé visible, sous son nom serveur, tant que l'instantané ne l'a pas rechargé", async () => {
		const store = await freshStore()
		const id = store.enqueue('visite_create', { client: 'CL-1', type_visite: 'Prospection' })
		api.pullOffline = true
		await store.sync()
		expect(store.outbox).toHaveLength(0)
		const name = store.resolveKey(`local:${id}`)
		expect(store.visitesByName.get(name)).toMatchObject({ name, type_visite: 'Prospection' })
		api.pullOffline = false
		await store.sync()
		expect(store.visitesByName.get(name)).toBeUndefined()
	})

	it('réessaie plus tard une erreur passagère, puis la passe en échec après 5 essais', async () => {
		api.pushResponse = (ids) => ids.map((id) => ({ id, ok: false, retry: true, result: null, error: 'Verrou' }))
		const store = await freshStore()
		store.enqueue('appel_create', { client: 'CL-1', type: 'Prospection' })
		await store.sync()
		expect(store.outbox[0]).toMatchObject({ attempts: 1, error: 'Verrou' })
		expect(store.outbox[0].next_at).toBeGreaterThan(Date.now())
		for (let i = 0; i < 4; i++) {
			store.outbox.forEach((m) => (m.next_at = null))
			await store.sync()
		}
		expect(store.outbox).toHaveLength(0)
		expect(store.failed).toHaveLength(1)
	})

	it('passe tout de suite en échec une saisie refusée, et peut la réessayer', async () => {
		api.pushResponse = (ids) => ids.map((id) => ({ id, ok: false, retry: false, result: null, error: 'Type obligatoire' }))
		const store = await freshStore()
		store.enqueue('visite_create', { client: 'CL-1' })
		await store.sync()
		expect(store.failed[0].error).toBe('Type obligatoire')
		// Toujours visible localement, pour être corrigée.
		expect(store.visites).toHaveLength(1)
		store.retryFailed(store.failed[0].id)
		expect(store.failed).toHaveLength(0)
		expect(store.outbox).toHaveLength(1)
	})

	it('garde la file hors réseau', async () => {
		api.offline = true
		const store = await freshStore()
		store.enqueue('rdv_create', { client: 'CL-1', date_heure: '2026-11-04 10:00:00' })
		await store.sync()
		expect(store.outbox).toHaveLength(1)
		expect(store.rdv[0]._pending).toBe(true)
	})

	it("n'envoie pas les saisies d'un autre compte", async () => {
		const store = await freshStore()
		api.offline = true
		store.enqueue('appel_create', { client: 'CL-1', type: 'Prospection' })
		await store.sync()
		api.offline = false
		api.bootUser = 'autre@aures.dz'
		await store.sync()
		expect(api.pushCalls).toHaveLength(0)
		expect(store.foreignOutbox).toBe(true)
	})

	it('envoie un ticket avec photo et sa demande d’urgence dans l’ordre, au retour du réseau', async () => {
		api.offline = true
		const store = await freshStore()
		const id = store.enqueue('ticket_create', {
			client: 'CL-1',
			request_type: 'Réclamation',
			site: 'Flexo',
			description: '<p>Défaut</p>',
			attachments: [{ filename: 'defaut.jpg', data: 'data:image/jpeg;base64,AAAA' }],
		})
		store.enqueue('ticket_urgence_request', { ticket_ref: id, niveau: 'U1', motif: 'Ligne arrêtée' })
		await store.sync()
		expect(store.tickets[0]).toMatchObject({ statut_demande_urgence: 'En attente', _pending: true })
		api.offline = false
		await store.sync()
		expect(api.pushCalls).toHaveLength(1)
		expect(api.pushCalls[0].map((m: any) => m.type)).toEqual(['ticket_create', 'ticket_urgence_request'])
		expect(api.pushCalls[0][0].payload.attachments[0].filename).toBe('defaut.jpg')
		expect(api.pushCalls[0][1].payload.ticket_ref).toBe(id)
		expect(store.outbox).toHaveLength(0)
	})

	it('retrouve la file après un rechargement de la page', async () => {
		api.offline = true
		const first = await freshStore()
		first.enqueue('visite_create', { client: 'CL-1', type_visite: 'Prospection' })
		const { idbGet } = await import('@/lib/idb')
		await vi.waitFor(async () => expect((await idbGet<any>('state'))?.outbox).toHaveLength(1))
		setActivePinia(createPinia())
		const { useCommercialStore } = await import('./commercial')
		const again = useCommercialStore()
		await again.init()
		expect(again.outbox).toHaveLength(1)
	})
})
