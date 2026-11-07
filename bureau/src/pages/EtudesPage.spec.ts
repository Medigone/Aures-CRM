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
const detail = { ...row, can_write: false, can_assign: false, assigne_a: null, assigne_a_nom: null, mine: false, assignees: [], actions: [] as string[], blocked: [] as { action: string; missing: string[] }[], taux_chutes: 0, date: '2026-01-01', comments: { count: 0, last: null }, observations: null, pieces: [{ key: 'trace', label: 'Tracé', value: 'TRA-1', doctype: 'Trace', status: null }, { key: 'imposition', label: 'Imposition', value: null, doctype: 'Imposition', status: null }] }

let current = detail
const emptyPieces = { travail: false, ouverte: true, manque: [] as string[], trace: { name: 'TRA-1', linked: true, can_edit: false, can_create: false, dimensions: '72x46.5x107', points_colle: 3, fichier: null, ecart: false }, imposition: { can_edit: false, can_create: false, atelier: false, nombre: 0, courante: null }, machine: { can_change: false, name: null }, nbr_feuilles: 0, cotations: { valeur: '72x46.5x107', origine: null } }
let pieces = emptyPieces
const confirmation = { actuelles: '72x46.5x107', nouvelles: '80x40x100', par: 'Lina', le: '2026-11-03 10:00:00' }
// La première demande revient avec la confirmation, la seconde enregistre.
function traceResponse() {
	const sentBefore = fetchMock.mock.calls.filter((item) => String(item[0]).includes('save_trace')).length
	return sentBefore > 1 ? { etude: current, pieces, piece: 'TRA-1' } : { confirmation }
}
const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
	const url = String(input)
	const body = url.includes('get_etudes') ? list : url.includes('get_etude_options') ? { doctype: 'Etude Faisabilite', both: true, filter_fields: [] } : url.includes('run_etude_action') ? { ...current, status: 'En étude', actions: [] } : url.includes('get_etude_activity') ? { items: [], comment_count: 0 } : url.includes('get_etude_pieces') ? pieces : url.includes('save_trace') ? traceResponse() : url.includes('get_etude') ? current : url.includes('get_queue') ? { tickets: [], counts: { todo: 0 }, total: 0, start: 0, page_length: 1, names: [] } : null
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
		current = detail
		pieces = emptyPieces
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
		expect(drawer.text()).toContain('Aucun document')
		expect(drawer.text()).toContain('Ouvrir la fiche')
		expect(drawer.find('a[href="/app/trace/TRA-1"]').exists()).toBe(true)
		wrapper.unmount()
	})

	it('la fiche ne propose rien au back office, qui suit en lecture seule', async () => {
		const { wrapper } = await open('/etudes/ETF-1')
		const head = wrapper.find('.record-actions')
		expect(head.text()).not.toContain('Réalisable')
		expect(head.find('.btn-primary').exists()).toBe(false)
		expect(head.text()).toContain('Non attribué')
		wrapper.unmount()
	})

	it('démarre une étude et rend compte', async () => {
		current = { ...detail, status: 'Nouveau', can_write: true, actions: ['Démarrer'] }
		const { wrapper } = await open('/etudes/ETF-1')
		await wrapper.find('.record-actions .btn-primary').trigger('click')
		await flushPromises()
		expect(sent('run_etude_action').action).toBe('Démarrer')
		wrapper.unmount()
	})

	it('explique pourquoi une conclusion n\'est pas encore possible', async () => {
		current = { ...detail, can_write: true, actions: ['Non Réalisable'], blocked: [{ action: 'Réalisable', missing: ['Imposition', 'Taux de chutes'] }] }
		pieces = { ...emptyPieces, manque: ['Imposition', 'Taux de chutes'] }
		const { wrapper } = await open('/etudes/ETF-1')
		const primary = wrapper.find('.record-actions .btn-primary')
		expect(primary.text()).toBe('Réalisable')
		expect(primary.attributes('disabled')).toBeDefined()
		expect(wrapper.find('.etude-pieces-banner').text()).toBe('Pour passer à Réalisable, il manque : imposition, taux de chutes.')
		wrapper.unmount()
	})

	it("montre à qui renseigne ce qu'il peut faire, à qui lit seulement aucun bouton", async () => {
		const reader = await open('/etudes/ETF-1')
		expect(reader.wrapper.find('.etude-work-actions').exists()).toBe(false)
		expect(reader.wrapper.text()).toContain('72 × 46,5 × 107 mm')
		reader.wrapper.unmount()

		pieces = { ...emptyPieces, travail: true, trace: { ...emptyPieces.trace, can_edit: true }, imposition: { ...emptyPieces.imposition, can_create: true, can_edit: true }, machine: { can_change: true, name: null } }
		const worker = await open('/etudes/ETF-1')
		const labels = worker.wrapper.findAll('.etude-work-actions button').map((button) => button.text())
		expect(labels).toEqual(['Mettre à jour', 'Choisir ou créer', 'Choisir la presse'])
		worker.wrapper.unmount()
	})

	it('verrouille les pièces tant que l\'étude n\'est pas démarrée', async () => {
		current = { ...detail, status: 'Nouveau' }
		pieces = { ...emptyPieces, trace: { ...emptyPieces.trace, name: null as unknown as string, linked: false } }
		const { wrapper } = await open('/etudes/ETF-1')
		expect(wrapper.text()).toContain("Démarrez l'étude pour renseigner les pièces.")
		expect(wrapper.find('.etude-work-actions').exists()).toBe(false)
		wrapper.unmount()
	})

	it('demande confirmation avant de remplacer des cotations venues du BAT', async () => {
		pieces = { ...emptyPieces, travail: true, trace: { ...emptyPieces.trace, can_edit: true, fichier: { url: '/f.pdf', name: 'f.pdf' } as never } }
		const { wrapper } = await open('/etudes/ETF-1')
		await wrapper.find('.etude-work-actions .btn-secondary').trigger('click')
		await flushPromises()
		const dialog = () => document.body
		const field = wrapper.find('.dialog input[type="text"]')
		await field.setValue('80x40x100')
		expect(dialog().textContent).toContain('seront mises à jour')
		await wrapper.find('.dialog-foot .btn-primary').trigger('click')
		await flushPromises()
		expect(sent('save_trace').confirm_bat).toBe(0)
		expect(wrapper.find('.dialog').text()).toContain('viennent du BAT importé par Lina le 03/11/2026')
		await wrapper.find('.dialog-foot .btn-primary').trigger('click')
		await flushPromises()
		const last = fetchMock.mock.calls.filter((item) => String(item[0]).includes('save_trace')).at(-1)
		expect(JSON.parse(String((last?.[1] as RequestInit).body)).confirm_bat).toBe(1)
		expect(wrapper.find('.dialog').exists()).toBe(false)
		wrapper.unmount()
	})

	it('demande confirmation avant de conclure', async () => {
		current = { ...detail, can_write: true, actions: ['Réalisable', 'Non Réalisable'] }
		const { wrapper } = await open('/etudes/ETF-1')
		await wrapper.find('.record-actions .btn-primary').trigger('click')
		expect(sent('run_etude_action')).toBeUndefined()
		expect(document.body.textContent).toContain('Conclure cette étude réalisable ?')
		wrapper.unmount()
	})

	it('refuse la page à qui ne lit aucune étude', async () => {
		window.droits = { 'Etude Faisabilite': { read: false, create: false }, 'Etude Faisabilite Flexo': { read: false, create: false } }
		const { wrapper } = await open('/etudes')
		expect(wrapper.text()).toContain("Cette page n'est pas accessible")
		wrapper.unmount()
	})
})
