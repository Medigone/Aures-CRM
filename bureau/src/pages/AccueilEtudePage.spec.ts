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

const row = (name: string, group: string, action: object, extra = {}) => ({ name, doctype: 'Etude Faisabilite', modified: '2026-11-04 10:00:00', status: 'En étude', client_label: 'BISCUITERIE SAI', designation: 'BOÎTE', procede: 'Offset', quantite: 50000, urgence: 'U0', echeance: '2026-01-02', retard: true, assigne: null, mine: false, manque: [], idle_days: 3, group, action, ...extra })
const accueil = (rows = [row('ETF-1', 'ready', { kind: 'link', label: 'Conclure' }), row('ETF-2', 'start', { kind: 'run', label: 'Démarrer', action: 'Démarrer' }, { status: 'Nouveau' }), row('ETF-3', 'missing', { kind: 'link', label: 'Compléter' }, { manque: ['Imposition'] })], canConclude = true) => ({
	stages: [{ key: 'etudes_offset', label: 'Études Offset', to: 'Etudes', href: null, third_party: false, late: 2, parts: [{ status: 'En étude', count: 3 }], total: 3, stale: 0 }],
	queue: ['urgent', 'ready', 'start', 'missing'].map((key) => ({ key, total: rows.filter((item) => item.group === key).length, rows: rows.filter((item) => item.group === key) })),
	counts: { team: rows.length, mine: 1 },
	can_conclude: canConclude,
	both: false,
	watch: [
		{ key: 'ouvertes', label: 'Études ouvertes', count: 3, total: null, view: 'traiter' },
		{ key: 'retard', label: 'Échéance dépassée', count: 2, total: null, view: 'retard', alert: true },
		{ key: 'imposition', label: 'Sans imposition', count: 1, total: 3, conditions: [{ doctype: 'Etude Faisabilite', field: 'imposition', op: 'is', value: 'not set' }] },
		{ key: 'cliche', label: 'Flexo sans cliché', count: 1, total: 3, conditions: null },
	],
	max_rows: 10,
})

let current = accueil()
const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
	const url = String(input)
	const body = url.includes('get_etude_accueil') ? current : url.includes('run_etude_action') ? {} : url.includes('get_accueil') ? null : null
	return Promise.resolve(new Response(JSON.stringify({ message: body }), { status: 200 }))
})
const calls = (method: string) => fetchMock.mock.calls.filter((item) => String(item[0]).includes(method))

async function open() {
	const router = createRouter({ history: createMemoryHistory('/bureau'), routes })
	await router.push('/')
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
	await flushPromises()
	return { wrapper, router }
}

describe('accueil du poste Étude', () => {
	beforeEach(() => {
		window.can_access = true
		window.user = 'etude@example.com'
		window.postes = [{ key: 'etude', label: 'Étude' }]
		current = accueil()
		fetchMock.mockClear()
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => {
		delete window.postes
		setPoste('')
		localStorage.clear()
		vi.unstubAllGlobals()
		document.body.innerHTML = ''
	})

	it("remplace l'accueil du back office et classe la file", async () => {
		const { wrapper } = await open()
		expect(calls('get_etude_accueil').length).toBe(1)
		expect(calls('bureau_accueil.get_accueil').length).toBe(0)
		expect(wrapper.text()).toContain("File de l'équipe")
		expect(wrapper.text()).toContain('Prêtes à conclure')
		expect(wrapper.text()).toContain('À démarrer')
		expect(wrapper.text()).toContain('manque imposition')
		expect(wrapper.text()).not.toContain('Urgentes')
	})

	it('dit à qui ne conclut pas que le responsable décide', async () => {
		current = accueil(undefined, false)
		const { wrapper } = await open()
		expect(wrapper.text()).toContain('Prêtes, en attente du responsable')
	})

	it('démarre sur place et recharge, conclure mène à la fiche', async () => {
		const { wrapper } = await open()
		const start = wrapper.findAll('button').find((item) => item.text() === 'Démarrer')!
		await start.trigger('click')
		await flushPromises()
		expect(calls('run_etude_action').length).toBe(1)
		expect(calls('get_etude_accueil').length).toBe(2)
		expect(document.body.textContent).toContain('Étude ETF-2 démarrée.')
		const conclude = wrapper.findAll('a').find((item) => item.text() === 'Conclure')!
		expect(conclude.attributes('href')).toContain('/etudes/ETF-1')
	})

	it('garde la page et affiche le refus', async () => {
		const { wrapper } = await open()
		fetchMock.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ exc_type: 'ValidationError', _server_messages: JSON.stringify([JSON.stringify({ message: 'Refusé par le workflow' })]) }), { status: 417 })))
		await wrapper.findAll('button').find((item) => item.text() === 'Démarrer')!.trigger('click')
		await flushPromises()
		expect(wrapper.find('[role=alert]').text()).toContain('Refusé par le workflow')
		expect(wrapper.text()).toContain("File de l'équipe")
	})

	it('change de périmètre sur le serveur', async () => {
		const { wrapper } = await open()
		await wrapper.findAll('button').find((item) => item.text().startsWith('À moi'))!.trigger('click')
		await flushPromises()
		expect(String(calls('get_etude_accueil').at(-1)![0])).toContain('scope=mine')
		expect(wrapper.text()).toContain('Mes études')
	})

	it('ouvre la liste filtrée, sans lien pour un champ absent de la liste', async () => {
		const { wrapper } = await open()
		const hrefs = wrapper.findAll('.accueil-data a').map((item) => decodeURIComponent(item.attributes('href') ?? ''))
		expect(hrefs.some((href) => href.includes('vue=retard'))).toBe(true)
		expect(hrefs.some((href) => href.includes('imposition'))).toBe(true)
		expect(wrapper.findAll('.accueil-data a').length).toBe(3)
		expect(wrapper.find('.accueil-data div.accueil-gap').text()).toContain('Flexo sans cliché')
	})

	it("garde l'accueil du back office pour son poste", async () => {
		window.postes = [{ key: 'back_office', label: 'Back office' }]
		await open()
		expect(calls('get_etude_accueil').length).toBe(0)
		expect(calls('bureau_accueil.get_accueil').length).toBe(1)
	})
})
