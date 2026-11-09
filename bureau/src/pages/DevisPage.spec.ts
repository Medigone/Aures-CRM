import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { commandeText, devisStage, devisTimeline, parsePrice } from '@/lib/devis'
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
	urgence: 'U1', commercial: 'Ismail', demande: 'DF-26-11-0172', ticket: 'TC-26-11-0318', type: 'Premier Tirage', envoye_le: null, cree_par: 'Nadia',
}  // prettier-ignore
const ordered = { ...row, name: 'SAL-QTN-2026-00021', status: 'Ordered', chiffrees: 4, chiffrage: 1, statut_commande: 'Entièrement commandé', commande: 100 }
const list = { devis: [row, ordered], counts: { all: 2, chiffrer: 1, valider: 0, valides: 0, expirent: 0, commandes: 1, clos: 0 }, total: 2, start: 0, page_length: 20, names: [row.name, ordered.name] }
const line = (name: string, prix: number | null) => ({ name, article: `CLI-1-${name}`, designation: `Article ${name}`, quantite: 50000, unite: 'Unité', prix, montant: prix ? prix * 50000 : 0, chiffree: Boolean(prix) })
const detail = {
	...row, can_write: true, can_print: true, docstatus: 0, cree_par: 'Nadia', chiffrees: 1, taxes: 0, commandes: [], comments: { count: 0, last: null },
	lignes: [line('001', 8.7), line('002', 0)], actions: ['prix', 'valider'], blocked: ['1 ligne(s) sans prix.'], raisons_perte: [], perte: null, envoi: null, canaux_envoi: [],
}  // prettier-ignore
const open_ = { ...detail, status: 'Open', docstatus: 1, chiffrees: 2, lignes: [line('001', 8.7), line('002', 12)], actions: ['envoye', 'commande', 'perdu', 'annuler'], blocked: [], raisons_perte: ['Prix', 'Délai'], canaux_envoi: ['Email', 'WhatsApp', 'Remis en main propre', 'Autre'] }
let current: object = detail

const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
	const url = String(input)
	const body = url.includes('get_devis_list') ? list : url.includes('get_devis_options') ? { doctype: 'Quotation', filter_fields: [] } : url.includes('get_devis_activity') ? { items: [], comment_count: 0 } : url.includes('update_devis') || url.includes('mark_lost') || url.includes('mark_sent') ? current : url.includes('create_commande') ? { commande: 'SAL-ORD-1', devis: current } : url.includes('get_devis') ? current : url.includes('get_queue') ? { tickets: [], counts: { todo: 0 }, total: 0, start: 0, page_length: 1, names: [] } : null
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

	it('l aperçu montre les lignes et mène à la fiche', async () => {
		const { wrapper, router } = await open(`/devis?apercu=${row.name}`)
		await flushPromises()
		const drawer = wrapper.find('.bureau-drawer')
		expect(drawer.text()).toContain('Article 001')
		expect(drawer.text()).toContain('1 chiffrée sur 2')
		expect(drawer.text()).not.toContain('Coût')
		expect(drawer.find('a[href="/bureau/demandes/DF-26-11-0172"]').exists()).toBe(true)
		await drawer.find('.btn-primary').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('DevisFiche')
		wrapper.unmount()
	})

	it('la fiche d un brouillon saisit les prix et attend tous les prix pour valider', async () => {
		const { wrapper } = await open(`/devis/${row.name}`)
		await flushPromises()
		const head = wrapper.find('.record-actions')
		const valider = head.find('.btn-primary')
		expect(valider.text()).toBe('Valider le devis')
		expect(valider.attributes('disabled')).toBeDefined()
		const inputs = wrapper.findAll('input.devis-price')
		expect(inputs).toHaveLength(2)
		await inputs[1].setValue('12,50')
		await inputs[1].trigger('change')
		await flushPromises()
		const body = sent('update_devis')
		expect(JSON.parse(body.prix)).toEqual({ '002': 12.5 })
		wrapper.unmount()
	})

	it('refuse un prix illisible sans l envoyer', async () => {
		const { wrapper } = await open(`/devis/${row.name}`)
		await flushPromises()
		const input = wrapper.findAll('input.devis-price')[1]
		await input.setValue('douze')
		await input.trigger('change')
		await flushPromises()
		expect(sent('update_devis')).toBeUndefined()
		expect(wrapper.text()).toContain('Saisissez un nombre')
		wrapper.unmount()
	})

	it('un devis validé propose la commande et ses prix ne se modifient plus', async () => {
		current = open_
		const { wrapper } = await open(`/devis/${row.name}`)
		await flushPromises()
		expect(wrapper.find('.record-actions .btn-primary').text()).toBe('Créer la commande')
		expect(wrapper.find('input.devis-price').exists()).toBe(false)
		expect(wrapper.text()).toContain('Pas encore envoyé')
		wrapper.unmount()
	})

	it('la commande du devis s ouvre sur le bureau, depuis les informations et la carte', async () => {
		current = { ...open_, status: 'Ordered', commandes: [{ name: 'SAL-ORD-2026-00015', status: 'To Deliver and Bill', date: '2026-07-07', total: 119000 }] }
		const { wrapper } = await open(`/devis/${row.name}`)
		await flushPromises()
		const links = wrapper.findAll('a[href="/bureau/commandes?apercu=SAL-ORD-2026-00015"]')
		expect(links.length).toBe(2)
		expect(wrapper.find('.record-facts').text()).toContain('Commande')
		wrapper.unmount()
	})

	it('marque envoyé un devis remis en main propre', async () => {
		current = open_
		const { wrapper } = await open(`/devis/${row.name}`)
		await flushPromises()
		const button = wrapper.findAll('.record-actions button').find((item) => item.text() === 'Marquer envoyé')
		await button!.trigger('click')
		await flushPromises()
		const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
		const select = dialog.querySelector('select') as HTMLSelectElement
		select.value = 'Remis en main propre'
		select.dispatchEvent(new Event('change'))
		;(Array.from(dialog.querySelectorAll('button')).find((item) => item.textContent?.trim() === 'Marquer envoyé') as HTMLButtonElement).click()
		await flushPromises()
		expect(sent('mark_sent')).toMatchObject({ name: row.name, canal: 'Remis en main propre' })
		wrapper.unmount()
	})
})

describe('règles des devis', () => {
	it('un brouillon est à chiffrer tant qu une ligne n a pas de prix, puis à valider', () => {
		expect(devisStage({ status: 'Draft', lignes: 2, chiffrees: 1 })?.label).toBe('À chiffrer')
		expect(devisStage({ status: 'Draft', lignes: 0, chiffrees: 0 })?.label).toBe('À chiffrer')
		expect(devisStage({ status: 'Draft', lignes: 2, chiffrees: 2 })?.label).toBe('À valider')
		expect(devisStage({ status: 'Open', lignes: 2, chiffrees: 2 })?.label).toBe('À envoyer')
		expect(devisStage({ status: 'Open', lignes: 2, chiffrees: 2, envoye_le: '2026-11-10' })?.label).toBe('Envoyé')
		expect(devisStage({ status: 'Ordered', lignes: 2, chiffrees: 2 })).toBeNull()
	})

	it('lit un prix tapé à la française', () => {
		expect(parsePrice('1 240,50')).toBe(1240.5)
		expect(parsePrice('8.7')).toBe(8.7)
		expect(parsePrice('')).toBeNull()
		expect(parsePrice('-3')).toBeNull()
		expect(parsePrice('abc')).toBeNull()
	})

	it('les étapes suivent le devis, et perdu ferme la frise', () => {
		const base = { status: 'Draft', docstatus: 0, lignes: [{}, {}] as never[], chiffrees: 1, commande: 0, commandes: [], perte: null }
		expect(devisTimeline(base).current).toBe(0)
		expect(devisTimeline({ ...base, chiffrees: 2 }).current).toBe(1)
		expect(devisTimeline({ ...base, chiffrees: 2, status: 'Open', docstatus: 1 }).current).toBe(2)
		const sentOne = devisTimeline({ ...base, chiffrees: 2, status: 'Open', docstatus: 1, envoi: { le: '2026-11-10 09:12:00', par: 'u', par_nom: 'Ismail T.', canal: 'WhatsApp' } })
		expect(sentOne.steps[2]).toMatchObject({ state: 'done', detail: '10/11/2026 · Ismail T. · WhatsApp' })
		const lost = devisTimeline({ ...base, chiffrees: 2, status: 'Lost', docstatus: 1, perte: { raisons: ['Prix'], precisions: null } })
		expect(lost.steps[3]).toMatchObject({ label: 'Perdu', state: 'blocked', detail: 'Prix' })
	})

	it('la commande ne se lit que sur un devis validé', () => {
		expect(commandeText({ status: 'Draft', commande: 0, statut_commande: 'Non commandé' })).toBe('')
		expect(commandeText({ status: 'Open', commande: 0, statut_commande: null })).toBe('Non commandé')
		expect(commandeText({ status: 'Partially Ordered', commande: 40, statut_commande: 'Partiellement commandé' })).toBe('40 %')
	})
})
