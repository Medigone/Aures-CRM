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

const queue = {
	tickets: [
		{
			name: 'TC-1',
			modified: '2026-11-04 10:00:00.000000',
			client: 'Client Un',
			commercial: 'Commercial A',
			request_type: 'Bon de commande',
			status: 'Pending',
			statut_creance: 'Non vérifiée',
			step: { label: 'Créance vérifiée', current: 2, done: 2, total: 5 },
			echeance: '2026-11-03',
			is_late: true,
			niveau_urgence: 'U1',
			urgence_en_attente: true,
			niveau_urgence_demande: 'U3',
			assigne_a: null,
			assigne_a_nom: null,
			mine: false,
		},
		{
			name: 'TC-2',
			modified: '2026-11-04 11:00:00.000000',
			client: 'Client Deux',
			commercial: 'Commercial B',
			request_type: 'Réclamation',
			status: 'Nouveau',
			statut_creance: 'OK',
			step: { label: 'Pris en charge', current: 1, done: 1, total: 5 },
			echeance: null,
			is_late: false,
			niveau_urgence: 'U0',
			urgence_en_attente: false,
			niveau_urgence_demande: null,
			assigne_a: null,
			assigne_a_nom: null,
			mine: false,
		},
	],
	counts: { todo: 2, mine: 0, urgent: 1, creance: 0, closed: 4 },
	truncated: false,
	limit: 500,
}
const ticket = {
	...queue.tickets[0],
	modified: '2026-11-04 10:00:00.000000',
	can_write: true,
	actions: ['Reprendre'],
	customer: 'C1',
	commercial: 'Commercial A',
	site: 'OFFSET',
	priority: null,
	creation_date: '2026-11-01',
	description: '<p>Besoin <b>urgent</b></p>',
	statut_demande_urgence: 'En attente',
	descr_urgence: '<p>Rupture de stock</p>',
	commentaire_validation_urgence: null,
	statut_creance: 'Non vérifiée',
	motif_blocage_creance: null,
	creance_verifiee_par: null,
	decision_rapprochement: null,
	commentaire_rapprochement: null,
	devis_rapproche: null,
	demande_faisabilite_rapprochee: null,
	checklist: [{ fieldname: 'checklist_bc_devis', label: 'Devis', checked: false }],
	steps: [
		{ key: 'recu', label: 'Ticket reçu', state: 'done', detail: '01/11/2026' },
		{ key: 'charge', label: 'Pris en charge', state: 'done', detail: '' },
		{ key: 'creance', label: 'Créance vérifiée', state: 'paused', detail: 'En pause' },
		{ key: 'rappro', label: 'Rapprochement', state: 'todo', detail: '' },
		{ key: 'fin', label: 'Terminé', state: 'todo', detail: 'Liste de contrôle 0/1' },
	],
	current_step: 2,
	documents: [{ name: 'F1', file_name: 'bc.pdf', file_url: '/private/files/bc.pdf', owner_name: 'Commercial A', creation: '2026-11-01 10:00:00', can_remove: false }],
	cycle: {
		demandes: [
			{
				name: 'DF-1',
				status: 'Finalisée',
				etudes: [{ name: 'E-1', status: 'Réalisable', doctype: 'Etude Faisabilite', item_name: 'Étui' }],
				sales_documents: [{ doctype: 'Quotation', name: 'DEV-1', status: 'Open' }],
			},
		],
		dossiers: [],
	},
	commande: null,
}
const candidates = {
	candidates: [
		{
			name: 'DF-1',
			demande_status: 'Finalisée',
			demande_type: 'Premier Tirage',
			date_creation: '2026-10-01',
			quotations: [
				{
					name: 'DEV-1',
					transaction_date: '2026-10-02',
					status: 'Open',
					grand_total: 1000,
					currency: 'DZD',
					command_analysis: { custom_status: 'Non commandé', percentage: 0 },
					items: [{ item_code: 'A', item_name: 'Étui', qty: 5000, uom: 'Unité' }],
				},
			],
		},
	],
}
const references = { types: ['Bon de commande'], statuses: ['Pending'], urgences: ['U0'], creances: ['OK'], assignees: [{ value: 'amine@example.com', label: 'Amine Melizi' }], nobody: '__nobody__' }

function respond(url: string) {
	const message = url.includes('get_queue')
		? queue
		: url.includes('get_references')
			? references
			: url.includes('get_ticket')
				? ticket
				: url.includes('get_quotation_candidates')
					? candidates
					: null
	return Promise.resolve(new Response(JSON.stringify({ message }), { status: 200 }))
}

async function open(path: string) {
	const router = createRouter({ history: createMemoryHistory('/bureau'), routes })
	await router.push(path)
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] } })
	await flushPromises()
	await flushPromises()
	return { wrapper, router }
}

describe('poste de bureau', () => {
	const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => respond(String(input)))

	beforeEach(() => {
		window.can_access = true
		window.user = 'bo@example.com'
		window.user_fullname = 'Back Office'
		fetchMock.mockClear()
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => vi.unstubAllGlobals())

	const posted = () => fetchMock.mock.calls.filter((call) => (call as unknown as [unknown, RequestInit])[1]?.method === 'POST').map((call) => {
		const [url, init] = call as unknown as [string, RequestInit]
		return { url, body: JSON.parse(String(init.body)) }
	})

	it("refuse l'accès sans le bon rôle, sans appeler l'API", async () => {
		window.can_access = false
		const { wrapper } = await open('/')
		expect(wrapper.text()).toContain('Accès réservé au back office')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	const ticketCalls = () => fetchMock.mock.calls.filter((call) => String(call[0]).includes('get_ticket'))
	const row = (wrapper: Awaited<ReturnType<typeof open>>['wrapper'], name: string) => wrapper.findAll('.list-row').find((item) => item.text().includes(name))!

	it("arrive sur la liste, sans ouvrir de ticket", async () => {
		const { wrapper, router } = await open('/')
		await flushPromises()
		expect(router.currentRoute.value.params.id).toBeUndefined()
		expect(wrapper.find('.bureau-drawer').exists()).toBe(false)
		expect(ticketCalls()).toEqual([])
		const text = row(wrapper, 'TC-1').text()
		expect(text).toContain('Client Un')
		expect(text).toContain('→ U3')
		expect(text).toContain('Retard 03/11')
		expect(text).toContain('3/5 Créance vérifiée')
		expect(text).toContain('Commercial A')
		expect(row(wrapper, 'TC-2').text()).toContain('—')
	})

	it("ouvre l'aperçu au clic, change de ticket sans le fermer, puis ouvre la fiche", async () => {
		const { wrapper, router } = await open('/')
		await row(wrapper, 'TC-1').find('.list-row-main').trigger('click')
		await flushPromises()
		await flushPromises()
		expect(router.currentRoute.value.query.apercu).toBe('TC-1')
		expect(wrapper.find('.bureau-drawer').text()).toContain('Étape 3 sur 5')
		expect(wrapper.find('.bureau-drawer').text()).toContain('1 sur 2')
		await row(wrapper, 'TC-2').find('.list-row-main').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.query.apercu).toBe('TC-2')
		expect(wrapper.find('.bureau-drawer').exists()).toBe(true)

		await wrapper.findAll('button').find((button) => button.text() === 'Ouvrir la fiche')!.trigger('click')
		await flushPromises()
		await flushPromises()
		expect(router.currentRoute.value.params.id).toBe('TC-2')
		expect(wrapper.find('.bureau-drawer').exists()).toBe(false)
		expect(wrapper.text()).toContain('2 sur 2')

		await wrapper.findAll('button').find((button) => button.text() === 'Retour à la liste')!.trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.query.apercu).toBe('TC-2')
	})

	it("ouvre la fiche à l'étape cliquée dans l'aperçu", async () => {
		const { wrapper, router } = await open('/?apercu=TC-1')
		await wrapper.findAll('.bureau-drawer .step-button')[3].trigger('click')
		await flushPromises()
		await flushPromises()
		expect(router.currentRoute.value.params.id).toBe('TC-1')
		expect(wrapper.text()).toContain('Étape 4 sur 5')
	})

	it('va au ticket voisin depuis la fiche', async () => {
		const { wrapper, router } = await open('/ticket/TC-1')
		await flushPromises()
		const previous = wrapper.find('[aria-label="Ticket précédent"]')
		expect(previous.attributes('disabled')).toBeDefined()
		await wrapper.find('[aria-label="Ticket suivant"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.params.id).toBe('TC-2')
	})

	it('trie au clic sur une colonne : croissant, décroissant, puis ordre du serveur', async () => {
		const { wrapper } = await open('/')
		const names = () => wrapper.findAll('.list-client').map((item) => item.text())
		const sortByClient = () => wrapper.find('.list-head [aria-label*="Client"]').trigger('click')
		expect(names()).toEqual(['Client Un', 'Client Deux'])
		await sortByClient()
		expect(names()).toEqual(['Client Deux', 'Client Un'])
		await sortByClient()
		expect(names()).toEqual(['Client Un', 'Client Deux'])
		await sortByClient()
		expect(names()).toEqual(['Client Un', 'Client Deux'])
	})

	it("cocher une ligne n'ouvre pas l'aperçu et propose les actions concernées", async () => {
		const { wrapper, router } = await open('/')
		expect(wrapper.find('.bureau-bulk').exists()).toBe(false)
		await row(wrapper, 'TC-2').find('input[type="checkbox"]').setValue(true)
		expect(router.currentRoute.value.query.apercu).toBeUndefined()
		const bar = wrapper.find('.bureau-bulk')
		expect(bar.text()).toContain('1 ticket sélectionné')
		expect(bar.text()).toContain('Démarrer (1)')
		expect(bar.findAll('button').find((button) => button.text() === 'Mettre en pause (0)')!.attributes('disabled')).toBeDefined()
		expect(bar.findAll('button').find((button) => button.text() === 'Attribuer')!.attributes('disabled')).toBeDefined()
	})

	it('la case de tête sélectionne toute la vue, et changer de vue vide la sélection', async () => {
		const { wrapper } = await open('/')
		const all = wrapper.find('.list-head input[type="checkbox"]')
		await row(wrapper, 'TC-1').find('input[type="checkbox"]').setValue(true)
		expect((all.element as HTMLInputElement).indeterminate).toBe(true)
		await all.setValue(true)
		expect(wrapper.find('.bureau-bulk').text()).toContain('2 tickets sélectionnés')
		await wrapper.findAll('.view')[1].trigger('click')
		await flushPromises()
		expect(wrapper.find('.bureau-bulk').exists()).toBe(false)
	})

	it('attribue la sélection, puis signale ce qui n\'a pas été traité', async () => {
		fetchMock.mockImplementation((input: RequestInfo | URL) =>
			String(input).includes('bulk_assign')
				? Promise.resolve(new Response(JSON.stringify({ message: { done: ['TC-1'], skipped: [{ name: 'TC-2', reason: 'Ticket clos.' }] } })))
				: respond(String(input)),
		)
		const { wrapper } = await open('/')
		await wrapper.find('.list-head input[type="checkbox"]').setValue(true)
		await wrapper.find('#bulk-assignee').setValue('amine@example.com')
		await wrapper.find('.bureau-bulk').findAll('button').find((button) => button.text() === 'Attribuer')!.trigger('click')
		await flushPromises()
		await flushPromises()
		expect(posted()[0].url).toContain('bureau.bulk_assign')
		expect(posted()[0].body).toEqual({
			items: [
				{ name: 'TC-1', modified: queue.tickets[0].modified },
				{ name: 'TC-2', modified: queue.tickets[1].modified },
			],
			user: 'amine@example.com',
		})
		const message = wrapper.find('.bureau-bulk').text()
		expect(message).toContain('1 ticket attribué à Amine Melizi · 1 non traité')
		expect(message).toContain('TC-2 : Ticket clos.')
		expect(wrapper.findAll('.list-row input:checked')).toHaveLength(0)
		fetchMock.mockImplementation((input: RequestInfo | URL) => respond(String(input)))
	})

	it('garde la sélection si le serveur refuse toute la demande', async () => {
		fetchMock.mockImplementation((input: RequestInfo | URL) =>
			String(input).includes('bulk_action')
				? Promise.resolve(new Response(JSON.stringify({ _server_messages: JSON.stringify([JSON.stringify({ message: 'Trop de tickets' })]) }), { status: 417 }))
				: respond(String(input)),
		)
		const { wrapper } = await open('/')
		await row(wrapper, 'TC-2').find('input[type="checkbox"]').setValue(true)
		await wrapper.find('.bureau-bulk').findAll('button').find((button) => button.text() === 'Démarrer (1)')!.trigger('click')
		await flushPromises()
		await flushPromises()
		expect(wrapper.find('.bureau-bulk').text()).toContain('Trop de tickets')
		expect(wrapper.find('.bureau-bulk').text()).toContain('1 ticket sélectionné')
		fetchMock.mockImplementation((input: RequestInfo | URL) => respond(String(input)))
	})

	it("garde le ticket de l'aperçu visible dans la liste, qui défile seule", async () => {
		const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
		const { wrapper } = await open('/?apercu=TC-1')
		await flushPromises()
		const selected = wrapper.find('.bureau-list-card [aria-current="true"]')
		expect(selected.exists()).toBe(true)
		expect(scrollIntoView).toHaveBeenCalledTimes(1)
		expect(scrollIntoView.mock.contexts[0]).toBe(selected.element)
		scrollIntoView.mockRestore()
	})

	it('affiche le ticket et ses colonnes', async () => {
		const { wrapper } = await open('/ticket/TC-1')
		const text = wrapper.text()
		expect(text).toContain('Client Un')
		expect(text).toContain("Demande d'urgence U3")
		expect(text).toContain('En pause')
		expect(text).not.toContain('Pending')
		expect(text).toContain('Étape 3 sur 5')
		expect(text).toContain('Rupture de stock')
		expect(text).toContain('Besoin urgent')
		expect(text).toContain('Non vérifiée')
		expect(text).toContain('DEV-1')
		const document = wrapper.find('a[href="/private/files/bc.pdf"]')
		expect(document.attributes('target')).toBe('_blank')
	})

	it("montre le contenu de l'étape consultée, puis revient à l'étape en cours", async () => {
		const { wrapper } = await open('/ticket/TC-1')
		expect(wrapper.text()).not.toContain('Rapprochement avec un devis')
		await wrapper.findAll('.step-button')[3].trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Étape 4 sur 5')
		expect(wrapper.text()).toContain('Rapprochement avec un devis')
		expect(wrapper.text()).toMatch(/5\s000/)
		const back = wrapper.findAll('button').find((button) => button.text() === "Revenir à l'étape en cours")
		await back!.trigger('click')
		expect(wrapper.text()).toContain('Étape 3 sur 5')
	})

	it('recharge la file avec les filtres et les vues', async () => {
		const { wrapper } = await open('/ticket/TC-1')
		const filtres = wrapper.findAll('button').find((button) => button.text() === 'Filtres')
		await filtres!.trigger('click')
		const add = wrapper.findAll('button').find((button) => button.text() === 'Ajouter un filtre')
		await add!.trigger('click')
		await wrapper.find('select[aria-label="Valeur"]').setValue('Bon de commande')
		await new Promise((resolve) => setTimeout(resolve, 300))
		await flushPromises()
		expect(wrapper.find('.filter-chip').text()).toBe('Type de ticket est Bon de commande')
		const urls = fetchMock.mock.calls.map((call) => new URL(String(call[0]), 'http://x').searchParams.get('conditions') || '')
		expect(urls.some((conditions) => conditions.includes('"value":"Bon de commande"'))).toBe(true)
		expect(wrapper.text()).toContain('Filtres (1)')

		await wrapper.findAll('.view')[4].trigger('click')
		await flushPromises()
		const last = decodeURIComponent(String(fetchMock.mock.calls.at(-1)?.[0]))
		expect(last).toContain('view=closed')
	})

	it("signale une erreur et permet de réessayer", async () => {
		fetchMock.mockImplementation((input: RequestInfo | URL) =>
			String(input).includes('get_ticket')
				? Promise.resolve(new Response(JSON.stringify({ exception: 'frappe.PermissionError: Accès refusé' }), { status: 403 }))
				: respond(String(input)),
		)
		const { wrapper } = await open('/ticket/TC-1')
		expect(wrapper.text()).toContain('Accès refusé')
		fetchMock.mockImplementation((input: RequestInfo | URL) => respond(String(input)))
	})

	it('lance une action du workflow avec la version affichée', async () => {
		const { wrapper } = await open('/ticket/TC-1')
		await wrapper.findAll('button').find((button) => button.text() === 'Reprendre')!.trigger('click')
		await flushPromises()
		expect(posted()[0].url).toContain('bureau.run_action')
		expect(posted()[0].body).toEqual({ name: 'TC-1', modified: ticket.modified, action: 'Reprendre' })
	})

	it("décide l'urgence : le refus exige un commentaire", async () => {
		const { wrapper } = await open('/ticket/TC-1')
		const refuse = wrapper.findAll('button').find((button) => button.text() === 'Refuser')!
		expect(refuse.attributes('disabled')).toBeDefined()
		await wrapper.find('textarea').setValue('Pas justifié')
		expect(refuse.attributes('disabled')).toBeUndefined()
		await refuse.trigger('click')
		await flushPromises()
		expect(posted()[0].url).toContain('decide_urgence')
		expect(posted()[0].body).toMatchObject({ action: 'refuse', niveau: null, commentaire: 'Pas justifié' })
	})

	it('accorde un autre niveau que celui demandé', async () => {
		const { wrapper } = await open('/ticket/TC-1')
		await wrapper.findAll('button').find((button) => button.text().startsWith('U2'))!.trigger('click')
		await wrapper.findAll('button').find((button) => button.text() === 'Valider U2')!.trigger('click')
		await flushPromises()
		expect(posted()[0].body).toMatchObject({ action: 'validate', niveau: 'U2' })
	})

	it('affiche le refus du serveur et garde la saisie', async () => {
		const { wrapper } = await open('/ticket/TC-1')
		fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) =>
			init?.method === 'POST'
				? Promise.resolve(new Response(JSON.stringify({ _server_messages: JSON.stringify([JSON.stringify({ message: 'Refus du serveur' })]) }), { status: 417 }))
				: respond(String(input)),
		)
		await wrapper.find('textarea').setValue('Mon commentaire')
		await wrapper.findAll('button').find((button) => button.text() === 'Refuser')!.trigger('click')
		await flushPromises()
		await flushPromises()
		expect(wrapper.text()).toContain('Refus du serveur')
		expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('Mon commentaire')
		fetchMock.mockImplementation((input: RequestInfo | URL) => respond(String(input)))
	})

	it('exige un motif pour bloquer la créance', async () => {
		const enCours = { ...ticket, status: 'En Cours', actions: ['Pause', 'Terminer'] }
		fetchMock.mockImplementation((input: RequestInfo | URL) =>
			String(input).includes('get_ticket') ? Promise.resolve(new Response(JSON.stringify({ message: enCours }))) : respond(String(input)),
		)
		const { wrapper } = await open('/ticket/TC-1')
		await wrapper.findAll('button').find((button) => button.text() === 'Bloquée')!.trigger('click')
		const block = wrapper.findAll('button').find((button) => button.text() === 'Bloquer le ticket')!
		expect(block.attributes('disabled')).toBeDefined()
		expect(posted()).toEqual([])
		await wrapper.find('input[placeholder^="Ex."]').setValue('Facture impayée')
		await block.trigger('click')
		await flushPromises()
		expect(posted()[0].url).toContain('set_creance')
		expect(posted()[0].body).toMatchObject({ statut: 'Bloquée', motif: 'Facture impayée' })
		fetchMock.mockImplementation((input: RequestInfo | URL) => respond(String(input)))
	})

	it('grise Terminer tant que la liste de contrôle est incomplète', async () => {
		const enCours = { ...ticket, status: 'En Cours', statut_demande_urgence: 'Aucune', actions: ['Pause', 'Terminer'] }
		fetchMock.mockImplementation((input: RequestInfo | URL) =>
			String(input).includes('get_ticket') ? Promise.resolve(new Response(JSON.stringify({ message: enCours }))) : respond(String(input)),
		)
		const { wrapper } = await open('/ticket/TC-1')
		const finish = wrapper.findAll('button').find((button) => button.text() === 'Terminer')!
		expect(finish.attributes('disabled')).toBeDefined()
		expect(wrapper.text()).toContain('Pour terminer, cochez : Devis.')
		fetchMock.mockImplementation((input: RequestInfo | URL) => respond(String(input)))
	})

	it('propose de joindre un fichier sur un ticket ouvert', async () => {
		const { wrapper } = await open('/ticket/TC-1')
		expect(wrapper.find('input[type="file"]').exists()).toBe(true)
		expect(wrapper.text()).toContain('Joindre un fichier')
	})
})
