import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { bonText, commandeColumns, isLate } from '@/lib/commandes'
import { setPoste } from '@/lib/postes'
import { routes } from '@/router'

vi.mock('@shared/realtime', async (original) => ({
	...(await original<typeof import('@shared/realtime')>()),
	connectRealtime: vi.fn(),
	closeRealtime: vi.fn(),
}))

const row = {
	name: 'SAL-ORD-2026-00015', modified: '2026-11-09 10:00:00', creation: '2026-07-07 09:31:00', tags: [], cloche: false, status: 'To Deliver and Bill',
	client: 'CLI-1', client_label: 'AURES EMBALLAGES', articles: 'ETUI BISCUIT', articles_count: 4, bon_commande: '12345', date_bon: '2026-07-07',
	livraison: '2026-07-14', fabrication: 'Programmation complète', dossier: 'DOF-2026-00005', livre: 40, facture: 0, total: 100000, total_ttc: 119000,
	urgence: 'U0', commercial: 'Ismail', devis: 'SAL-QTN-2026-00021', demande: 'DF-26-07-0161', ticket: 'TC-26-07-00001', retirage: false, date: '2026-07-07', cree_par: 'Nadia',
}  // prettier-ignore
const draft = { ...row, name: 'SAL-ORD-2026-00016', status: 'Draft', bon_commande: null, date_bon: null, fabrication: null, dossier: null, livre: 0 }
const list = { commandes: [draft, row], counts: { all: 2, valider: 1, livrer: 1, retard: 1, facturer: 0, terminees: 0, annulees: 0 }, total: 2, start: 0, page_length: 20, names: [draft.name, row.name] }
const detail = {
	...row, can_write: true, docstatus: 1, dossier: { name: 'DOF-2026-00005', status: 'Programmation complète' }, taxes: 19000, comments: { count: 0, last: null },
	lignes: [{ name: 'l1', article: 'CLI-1-001', designation: 'ETUI BISCUIT', quantite: 1000, livree: 400, unite: 'Unité', livraison: '2026-07-14', prix: 10, montant: 10000 }],
}  // prettier-ignore
let montants = true

const fetchMock = vi.fn((input: RequestInfo | URL) => {
	const url = String(input)
	const body = url.includes('get_commandes_list')
		? list
		: url.includes('get_commandes_options')
			? { doctype: 'Sales Order', filter_fields: [], montants }
			: url.includes('get_commande')
				? detail
				: url.includes('get_queue')
					? { tickets: [], counts: { todo: 0 }, total: 0, start: 0, page_length: 1, names: [] }
					: null
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

describe('page Commandes', () => {
	beforeEach(() => {
		window.can_access = true
		window.user = 'bo@example.com'
		montants = true
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

	it('liste les commandes avec leur bon de commande, leur livraison et leur fabrication', async () => {
		const { wrapper } = await open('/commandes')
		expect(sent('get_commandes_list')?.view).toBe('all')
		const text = wrapper.text()
		expect(text).toContain('SAL-ORD-2026-00015')
		expect(text).toContain('12345 · 07/07/2026')
		expect(text).toContain('À saisir')
		expect(text).toContain('Programmation complète')
		expect(text).toContain('40 %')
		expect(text).toContain('119 000,00')
		expect(text).not.toContain('Nouvelle commande')
		wrapper.unmount()
	})

	it('ouvre l aperçu depuis l adresse, avec le lien vers le devis', async () => {
		const { wrapper } = await open('/commandes?apercu=SAL-ORD-2026-00015')
		const drawer = wrapper.find('aside[aria-label="Aperçu de la commande"]')
		expect(drawer.exists()).toBe(true)
		expect(drawer.text()).toContain('Programmation complète')
		expect(drawer.find('a[href="/bureau/devis/SAL-QTN-2026-00021"]').exists()).toBe(true)
		expect(drawer.text()).toContain('400 livrés')
		wrapper.unmount()
	})

	it('l adresse garde la vue', async () => {
		const { wrapper, router } = await open('/commandes?vue=retard')
		expect(sent('get_commandes_list')?.view).toBe('retard')
		expect(router.currentRoute.value.query.vue).toBe('retard')
		wrapper.unmount()
	})
})

describe('règles des commandes', () => {
	it('une livraison passée sur une commande à livrer est en retard', () => {
		expect(isLate({ status: 'To Deliver and Bill', livraison: '2026-07-14' }, '2026-11-09')).toBe(true)
		expect(isLate({ status: 'To Deliver', livraison: '2026-12-01' }, '2026-11-09')).toBe(false)
		expect(isLate({ status: 'To Bill', livraison: '2026-07-14' }, '2026-11-09')).toBe(false)
		expect(isLate({ status: 'Draft', livraison: '2026-07-14' }, '2026-11-09')).toBe(false)
	})

	it('le bon de commande se lit avec sa date', () => {
		expect(bonText({ bon_commande: '12345', date_bon: '2026-07-07' })).toBe('12345 · 07/07/2026')
		expect(bonText({ bon_commande: null, date_bon: null })).toBe('')
	})

	it('sans droit sur les montants, leurs colonnes disparaissent', () => {
		const keys = commandeColumns(false).map((column) => column.key)
		expect(keys).not.toContain('total')
		expect(keys).not.toContain('total_ttc')
		expect(commandeColumns(true).map((column) => column.key)).toContain('total_ttc')
	})
})
