import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { commandeText, devisStage } from '@/lib/devis'
import { setPoste } from '@/lib/postes'
import { routes } from '@/router'

vi.mock('@shared/realtime', async (original) => ({
	...(await original<typeof import('@shared/realtime')>()),
	connectRealtime: vi.fn(),
	closeRealtime: vi.fn(),
}))

const row = {
	name: 'SAL-QTN-2026-00024', modified: '2026-11-09 10:00:00', creation: '2026-11-08 15:40:00', tags: [], cloche: false, status: 'Draft',
	client: 'CLI-1', client_label: 'IFRI', articles: 'ÉTUI BISCUIT 250 G', articles_count: 4, lignes: 4, chiffrees: 3, chiffrage: 0.75,
	total: 2186400, total_ttc: 2601816, statut_commande: 'Non commandé', commande: 0, date: '2026-11-08', valable: '2026-12-09', livraison: '2027-01-15',
	urgence: 'U1', commercial: 'Ismail', demande: 'DF-26-11-0172', ticket: 'TC-26-11-0318', type: 'Premier Tirage', cree_par: 'Nadia',
}  // prettier-ignore
const ordered = { ...row, name: 'SAL-QTN-2026-00021', status: 'Ordered', chiffrees: 4, chiffrage: 1, statut_commande: 'Entièrement commandé', commande: 100 }
const list = { devis: [row, ordered], counts: { all: 2, chiffrer: 1, valider: 0, valides: 0, expirent: 0, commandes: 1, clos: 0 }, total: 2, start: 0, page_length: 20, names: [row.name, ordered.name] }
const line = (name: string, prix: number | null, calcul?: object | null) => ({ name, article: `CLI-1-${name}`, designation: `Article ${name}`, quantite: 50000, unite: 'Unité', prix, montant: prix ? prix * 50000 : 0, chiffree: Boolean(prix), ...(calcul === undefined ? {} : { calcul }) })
const detail = {
	...row, can_write: true, couts: true, docstatus: 0, cree_par: 'Nadia', chiffrees: 1, taxes: 0, commandes: [], comments: { count: 0, last: null },
	lignes: [line('001', 8.7, { name: 'CALC-1', cout_unitaire: 6.42, prix_propose: 8.67, prix_final: 8.7, marge: 35.5 }), line('002', null, null)],
}  // prettier-ignore
let current: object = detail

const fetchMock = vi.fn((input: RequestInfo | URL) => {
	const url = String(input)
	const body = url.includes('get_devis_list') ? list : url.includes('get_devis_options') ? { doctype: 'Quotation', filter_fields: [] } : url.includes('get_devis') ? current : url.includes('get_queue') ? { tickets: [], counts: { todo: 0 }, total: 0, start: 0, page_length: 1, names: [] } : null
	return Promise.resolve(new Response(JSON.stringify({ message: body }), { status: 200 }))
})
const sent = (method: string) => {
	const call = fetchMock.mock.calls.find((item) => String(item[0]).includes(method))
	return call ? Object.fromEntries(new URL(String(call[0]), 'https://x.test').searchParams) : undefined
}

async function open(path: string) {
	const router = createRouter({ history: createMemoryHistory('/bureau'), routes })
	await router.push(path)
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
	await flushPromises()
	return { wrapper, router }
}

describe('page Devis', () => {
	beforeEach(() => {
		window.can_access = true
		window.user = 'bo@example.com'
		current = detail
		fetchMock.mockClear()
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => {
		delete window.droits
		setPoste('')
		localStorage.clear()
		vi.unstubAllGlobals()
		document.body.innerHTML = ''
	})

	it('liste les devis avec leur chiffrage, sans création', async () => {
		const { wrapper } = await open('/devis')
		expect(sent('get_devis_list')?.view).toBe('all')
		expect(wrapper.text()).toContain('SAL-QTN-2026-00024')
		expect(wrapper.text()).toContain('3/4')
		expect(wrapper.text()).toContain('2 186 400,00')
		expect(wrapper.text()).toContain('À chiffrer')
		expect(wrapper.text()).toContain('100 %')
		expect(wrapper.text()).not.toContain('Nouveau devis')
		wrapper.unmount()
	})

	it('l adresse garde la vue', async () => {
		const { wrapper } = await open('/devis?vue=commandes')
		expect(sent('get_devis_list')?.view).toBe('commandes')
		wrapper.unmount()
	})

	it('l aperçu montre les lignes, les coûts de l équipe devis et le lien vers le Desk', async () => {
		const { wrapper } = await open(`/devis?apercu=${row.name}`)
		await flushPromises()
		const drawer = wrapper.find('.bureau-drawer')
		expect(drawer.text()).toContain('Article 001')
		expect(drawer.text()).toContain('Coût 6,42 · marge 35,5 %')
		expect(drawer.text()).toContain('Pas de calcul')
		expect(drawer.text()).toContain('1 chiffrée sur 2')
		expect(drawer.find(`a[href="/app/quotation/${row.name}"]`).exists()).toBe(true)
		expect(drawer.find('a[href="/bureau/demandes/DF-26-11-0172"]').exists()).toBe(true)
		wrapper.unmount()
	})

	it('sans les coûts, l aperçu n a ni coût ni marge', async () => {
		current = { ...detail, couts: false, lignes: detail.lignes.map(({ calcul: _calcul, ...rest }) => rest) }
		const { wrapper } = await open(`/devis?apercu=${row.name}`)
		await flushPromises()
		const drawer = wrapper.find('.bureau-drawer')
		expect(drawer.text()).not.toContain('Marge')
		expect(drawer.find('.devis-cost').exists()).toBe(false)
		wrapper.unmount()
	})
})

describe('règles des devis', () => {
	it('un brouillon est à chiffrer tant qu une ligne n a pas de prix, puis à valider', () => {
		expect(devisStage({ status: 'Draft', lignes: 2, chiffrees: 1 })?.label).toBe('À chiffrer')
		expect(devisStage({ status: 'Draft', lignes: 0, chiffrees: 0 })?.label).toBe('À chiffrer')
		expect(devisStage({ status: 'Draft', lignes: 2, chiffrees: 2 })?.label).toBe('À valider')
		expect(devisStage({ status: 'Open', lignes: 2, chiffrees: 2 })).toBeNull()
	})

	it('la commande ne se lit que sur un devis validé', () => {
		expect(commandeText({ status: 'Draft', commande: 0, statut_commande: 'Non commandé' })).toBe('')
		expect(commandeText({ status: 'Open', commande: 0, statut_commande: null })).toBe('Non commandé')
		expect(commandeText({ status: 'Partially Ordered', commande: 40, statut_commande: 'Partiellement commandé' })).toBe('40 %')
	})
})
