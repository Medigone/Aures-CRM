import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { setPoste } from '@/lib/postes'
import { routes } from '@/router'

vi.mock('@shared/realtime', async (original) => ({
	...(await original<typeof import('@shared/realtime')>()),
	connectRealtime: vi.fn(),
	closeRealtime: vi.fn(),
}))

const row = { name: 'ETF-1', doctype: 'Etude Faisabilite', modified: '2026-11-04 10:00:00', tags: [], cloche: false, status: 'En étude', client: 'CLI-1', client_label: 'BISCUITERIE SAI', article: 'CLI-1-001', designation: 'QAADA BOÎTE', procede: 'Offset', quantite: 50000, urgence: 'U3', echeance: '2026-01-02', retard: true, livraison: null, demande: 'DF-1', commercial: null, retirage: true, pieces: [{ key: 'trace', label: 'Tracé', value: 'TRA-1' }, { key: 'imposition', label: 'Imposition', value: null }], manquantes: 1, creation: '2026-01-01 10:00:00', date: '2026-01-01' }
const flexo = { ...row, name: '2ld234ra01', doctype: 'Etude Faisabilite Flexo', procede: 'Flexo', retard: false, urgence: 'U0', retirage: false, pieces: [{ key: 'trace', label: 'Tracé', value: 'TRA-2' }, { key: 'cliche', label: 'Cliché', value: 'CLF-1' }], manquantes: 0 }
const list = { etudes: [row, flexo], counts: { all: 2, traiter: 2, retard: 1, realisable: 0, non_realisable: 0, annulee: 0 }, total: 2, start: 0, page_length: 20, names: ['ETF-1', '2ld234ra01'] }
const detail = { ...row, can_write: false, observations: null, pieces: [{ key: 'trace', label: 'Tracé', value: 'TRA-1', doctype: 'Trace', status: null }, { key: 'imposition', label: 'Imposition', value: null, doctype: 'Imposition', status: null }] }

const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
	const url = String(input)
	const body = url.includes('get_etudes') ? list : url.includes('get_etude_options') ? { doctype: 'Etude Faisabilite', both: true, filter_fields: [] } : url.includes('get_etude') ? detail : url.includes('get_queue') ? { tickets: [], counts: { todo: 0 }, total: 0, start: 0, page_length: 1, names: [] } : null
	return Promise.resolve(new Response(JSON.stringify({ message: body }), { status: 200 }))
})
const sent = (method: string) => {
	const call = fetchMock.mock.calls.find((item) => String(item[0]).includes(method))
	if (!call) return undefined
	const body = (call[1] as RequestInit | undefined)?.body
	return body ? JSON.parse(String(body)) : Object.fromEntries(new URL(String(call[0]), 'https://x.test').searchParams)
}

async function open(path: string) {
	const router = createRouter({ history: createMemoryHistory('/bureau'), routes })
	await router.push(path)
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
	await flushPromises()
	return { wrapper, router }
}

describe('page Études', () => {
	beforeEach(() => {
		window.can_access = true
		window.user = 'bo@example.com'
		fetchMock.mockClear()
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => {
		delete window.postes
		delete window.droits
		setPoste('')
		localStorage.clear()
		vi.unstubAllGlobals()
		document.body.innerHTML = ''
	})

	it('réunit Offset et Flexo pour le back office, sans création', async () => {
		const { wrapper } = await open('/etudes')
		expect(sent('get_etudes').view).toBe('all')
		expect(wrapper.text()).toContain('ETF-1')
		expect(wrapper.text()).toContain('2ld234ra01')
		expect(wrapper.text()).toContain('50 000')
		expect(wrapper.text()).not.toContain('Nouvelle étude')
		wrapper.unmount()
	})

	it('ouvre l\'équipe Étude sur ce qu\'elle a à traiter', async () => {
		window.postes = [{ key: 'etude', label: 'Étude' }]
		const { wrapper } = await open('/etudes')
		expect(sent('get_etudes').view).toBe('traiter')
		wrapper.unmount()
	})

	it('l\'adresse garde la vue', async () => {
		const { wrapper } = await open('/etudes?vue=retard')
		expect(sent('get_etudes').view).toBe('retard')
		wrapper.unmount()
	})

	it('la vue de référence de l\'équipe Étude n\'apparaît pas comme un filtre', async () => {
		window.postes = [{ key: 'etude', label: 'Étude' }]
		const { wrapper } = await open('/etudes')
		expect(wrapper.find('.filter-chip').exists()).toBe(false)
		wrapper.unmount()
	})

	it('l\'aperçu montre les pièces', async () => {
		const { wrapper } = await open('/etudes?apercu=ETF-1')
		await flushPromises()
		const drawer = wrapper.find('.bureau-drawer')
		expect(drawer.text()).toContain('Manque : imposition')
		expect(drawer.text()).toContain('Ouvrir sur le Desk')
		expect(drawer.find('a[href="/app/trace/TRA-1"]').exists()).toBe(true)
		wrapper.unmount()
	})

	it('refuse la page à qui ne lit aucune étude', async () => {
		window.droits = { 'Etude Faisabilite': { read: false, create: false }, 'Etude Faisabilite Flexo': { read: false, create: false } }
		const { wrapper } = await open('/etudes')
		expect(wrapper.text()).toContain("Cette page n'est pas accessible")
		wrapper.unmount()
	})
})
