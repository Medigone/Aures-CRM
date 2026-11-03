import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// API simulée : instantané minimal, réponses de push_mutations pilotées par chaque test.
const api = vi.hoisted(() => ({ pushResponse: (_ids: string[]): any => [], pushCalls: [] as any[], bootUser: 'karim@aures.dz', offline: false }))

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
		mobileApi: vi.fn(async (method: string) => (method === 'get_sync_bundle' ? meta : [])),
		call: vi.fn(async (_method: string, params: any) => {
			if (api.offline) throw new ApiError('Pas de connexion réseau.', 0, true)
			api.pushCalls.push(params.mutations)
			return api.pushResponse(params.mutations.map((m: any) => m.id))
		}),
	}
})

async function freshStore() {
	vi.resetModules()
	const { idbClear } = await import('@/lib/idb')
	await idbClear()
	setActivePinia(createPinia())
	const { useCommercialStore } = await import('./commercial')
	const store = useCommercialStore()
	await store.init()
	return store
}

beforeEach(() => {
	api.pushCalls = []
	api.bootUser = 'karim@aures.dz'
	api.offline = false
	api.pushResponse = (ids) => ids.map((id) => ({ id, ok: true, retry: false, result: { doctype: 'Visite Commerciale', name: `VC-${id.slice(0, 4)}` }, error: null }))
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

	it('retrouve la file après un rechargement de la page', async () => {
		api.offline = true
		const first = await freshStore()
		first.enqueue('visite_create', { client: 'CL-1', type_visite: 'Prospection' })
		await new Promise((resolve) => setTimeout(resolve, 50))
		setActivePinia(createPinia())
		const { useCommercialStore } = await import('./commercial')
		const again = useCommercialStore()
		await again.init()
		expect(again.outbox).toHaveLength(1)
	})
})
