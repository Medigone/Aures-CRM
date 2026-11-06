import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { routes } from '@/router'

vi.mock('@shared/realtime', async (original) => ({
	...(await original<typeof import('@shared/realtime')>()),
	connectRealtime: vi.fn(),
	closeRealtime: vi.fn(),
}))

const row = { name: 'DF-1', modified: '2026-11-04 10:00:00', tags: [], cloche: false, status: 'Brouillon', type: 'Premier Tirage', client: 'CLI-1', client_label: 'BISCUITERIE NUMIDIA', articles: 'ETUI BISCUIT', articles_count: 2, procede: 'Offset', urgence: 'U1', livraison: '2026-11-20', commercial: 'Samia', ticket: null, bon_commande: null, creation: '2026-11-04', cree_par: 'Leïla' }
const list = { demandes: [row, { ...row, name: 'DF-2', status: 'Finalisée', articles_count: 1 }], counts: { all: 2, confirm: 1, etude: 0, chiffrer: 1, devis: 0, commande: 0, closes: 0 }, total: 2, start: 0, page_length: 20, names: ['DF-1', 'DF-2'] }
const line = { name: 'L1', article: 'CLI-1-003', designation: 'ETUI BISCUIT', quantite: 50000, est_creation: 0, procede: 'Offset', date_livraison: '2026-11-20' }
const detail = { name: 'DF-1', modified: '2026-11-04 10:00:00', tags: [], can_write: true, status: 'Brouillon', type: 'Premier Tirage', client: 'CLI-1', client_label: 'BISCUITERIE NUMIDIA', wilaya: 'Sétif', commercial: 'Samia', ticket: null, ticket_info: null, urgence: 'U1', livraison: '2026-11-20', creation: '2026-11-04', cree_par: 'Leïla', bon_commande: null, demande_origin: null, procede: 'Offset', lines: [line], etudes: [], devis: [], commandes: [], actions: ['confirm', 'edit'], cancel_blocking: [], comments: { count: 0, last: null } }
const articles = [
	{ name: 'CLI-1-003', designation: 'ETUI BISCUIT', reference: null, procedes: ['Offset'], support: 'BBTB', format: '10×20', bat: 'BAT-P Validé', last_quantity: 50000, compose: 0, unavailable: null },
	{ name: 'CLI-1-009', designation: 'EMBALLAGE OPP', reference: null, procedes: ['Flexo'], support: 'BOPP', format: null, bat: null, last_quantity: 0, compose: 0, unavailable: null },
]
const context = { ticket: 'TC-1', state: 'ready', procede: 'Offset', reason: null, request_type: 'Bon de commande', client: 'CLI-1', client_label: 'BISCUITERIE NUMIDIA', description: '<p>Chiffrer le biscuit</p>', urgence: 'U1', livraison: '2026-11-13', from_echeance: false, devis_rapproche: 'QTN-1' }

let current: Record<string, unknown>
function respond(url: string) {
	const key = Object.keys(current).find((item) => url.includes(item))
	return Promise.resolve(new Response(JSON.stringify({ message: key ? current[key] : null }), { status: 200 }))
}

async function open(path: string) {
	const router = createRouter({ history: createMemoryHistory('/bureau'), routes })
	await router.push(path)
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
	await flushPromises()
	await flushPromises()
	await flushPromises()
	return { wrapper, router }
}
const button = (label: string) => [...document.querySelectorAll('button')].find((item) => item.textContent?.replace(/\s+/g, ' ').trim() === label)

describe('page Demandes', () => {
	const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => respond(String(input)))
	const posted = (method: string) => {
		const call = fetchMock.mock.calls.find((item) => String(item[0]).includes(method) && (item as unknown as [unknown, RequestInit])[1]?.method === 'POST')
		return call ? JSON.parse(String((call as unknown as [unknown, RequestInit])[1].body)) : undefined
	}

	beforeEach(() => {
		window.can_access = true
		window.user = 'bo@example.com'
		window.user_fullname = 'Back Office'
		current = {
			'bureau_demandes.get_demandes': list,
			'bureau_demandes.get_demande_options': { types: [], can_create: true, filter_fields: [] },
			'bureau_demandes.get_demande_activity': { items: [], comment_count: 0 },
			'bureau_demandes.get_demande_articles': articles,
			'bureau_demandes.get_ticket_demande_context': context,
			'bureau_demandes.get_demande': detail,
			'bureau_demandes.create_demande': { name: 'DF-3' },
			'bureau_demandes.confirm_demande': { ...detail, status: 'Confirmée', actions: ['cancel'] },
			'bureau.search_clients': [{ name: 'CLI-1', label: 'BISCUITERIE NUMIDIA', wilaya: 'Sétif', commercial: null, commercial_name: null, open_tickets: 0 }],
			'bureau.get_queue': { tickets: [], counts: { todo: 7 }, total: 0, start: 0, page_length: 1, names: [] },
			'bureau.get_mention_candidates': [],
			'bureau_bulk.get_bulk_options': { can_delete: false, fields: [] },
			'bureau_bulk.get_bulk_tags': [],
		}
		fetchMock.mockClear()
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		document.body.innerHTML = ''
	})

	it('affiche la liste et compte les autres articles', async () => {
		const { wrapper } = await open('/demandes')
		expect(wrapper.text()).toContain('Demandes de faisabilité')
		expect(wrapper.text()).toContain('DF-1')
		expect(wrapper.text()).toContain('+1')
		expect(button('Nouvelle demande')).toBeUndefined()
		wrapper.unmount()
	})

	it('la fiche propose de confirmer, et garde le fil visible hors des onglets', async () => {
		const { wrapper } = await open('/demandes/DF-1')
		expect(wrapper.find('.record-activity').exists()).toBe(true)
		// Même structure que le ticket : en-tête, contenu puis fil à gauche, étapes à droite.
		expect(wrapper.find('.bureau-center .record-activity').exists()).toBe(true)
		expect(wrapper.find('.client-side').exists()).toBe(false)
		expect(wrapper.find('.pp-chain').exists()).toBe(false)
		expect(wrapper.find('[aria-label="Étapes de la demande"] .step-tip').text()).toContain('Confirmer la demande')
		await wrapper.find('.record-actions .btn-primary').trigger('click')
		await flushPromises()
		button('Confirmer et lancer les études')!.click()
		await flushPromises()
		await flushPromises()
		expect(posted('confirm_demande')).toMatchObject({ name: 'DF-1', modified: detail.modified })
		expect(wrapper.text()).toContain('Confirmée')
		wrapper.unmount()
	})

	it('une annulation certaine d’échouer le dit sans proposer le bouton', async () => {
		const etude = { name: 'EF-1', doctype: 'Etude Faisabilite', status: 'Réalisable', article: 'CLI-1-003', article_parent: null, designation: 'ETUI', quantite: 50000 }
		current['bureau_demandes.get_demande'] = { ...detail, status: 'Partiellement Finalisée', actions: ['cancel'], etudes: [etude], cancel_blocking: [etude] }
		const { wrapper } = await open('/demandes/DF-1')
		button('Annuler la demande')!.click()
		await flushPromises()
		expect(document.body.textContent).toContain('Annulation impossible')
		expect([...document.querySelectorAll('.dialog-foot .btn-danger')]).toHaveLength(0)
		wrapper.unmount()
	})

	it('crée depuis un ticket : client et procédé imposés, articles ajoutés en un clic', async () => {
		const { default: DemandeDialog } = await import('@/components/DemandeDialog.vue')
		const wrapper = mount(DemandeDialog, { props: { ticket: 'TC-1' }, attachTo: document.body })
		await flushPromises()
		await flushPromises()
		const text = document.body.textContent ?? ''
		expect(text).toContain('Chiffrer le biscuit')
		expect(text).toContain('Procédé du site : Offset')
		expect(text).toContain('1 article Flexo masqué : autre site')
		expect(text).toContain('Ce ticket a un devis retenu, QTN-1.')
		expect(text).not.toContain('EMBALLAGE OPP')
		const create = button('Créer la demande') as HTMLButtonElement
		expect(create.disabled).toBe(true)

		;(document.querySelector('.demande-row') as HTMLButtonElement).click()
		await flushPromises()
		expect(document.querySelector('.demande-status')?.textContent).toBe('1 quantité à saisir')
		button('Reprendre 50 000')!.click()
		await flushPromises()
		expect(create.disabled).toBe(false)

		;(document.querySelector('.demande-row') as HTMLButtonElement).click()
		await flushPromises()
		const second = document.querySelectorAll<HTMLInputElement>('.demande-qty')[1]
		second.value = '50000'
		second.dispatchEvent(new Event('input'))
		await flushPromises()
		expect(document.querySelector('.demande-status')?.textContent).toBe('1 doublon à corriger')
		second.value = '30 000'
		second.dispatchEvent(new Event('input'))
		await flushPromises()
		expect(second.value.replace(/\s/g, ' ')).toBe('30 000')

		create.click()
		await flushPromises()
		expect(posted('create_demande')).toEqual({
			ticket: 'TC-1',
			values: { client: 'CLI-1', type: 'Premier Tirage', date_livraison: '2026-11-13', n_bon_commande: '', lines: [{ article: 'CLI-1-003', quantite: 50000, est_creation: 0 }, { article: 'CLI-1-003', quantite: 30000, est_creation: 0 }] },
		})
		expect(wrapper.emitted('created')?.[0]).toEqual(['DF-3'])
		wrapper.unmount()
	})

	it('un ticket qui ne le permet plus affiche la raison', async () => {
		current['bureau_demandes.get_ticket_demande_context'] = { ...context, state: 'not_started', reason: 'La demande se crée quand le ticket est En Cours.', devis_rapproche: null }
		const { default: DemandeDialog } = await import('@/components/DemandeDialog.vue')
		const wrapper = mount(DemandeDialog, { props: { ticket: 'TC-1' }, attachTo: document.body })
		await flushPromises()
		await flushPromises()
		expect(document.body.textContent).toContain('La demande se crée quand le ticket est En Cours.')
		wrapper.unmount()
	})
})
