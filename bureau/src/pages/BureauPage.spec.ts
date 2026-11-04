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
			comments: 0,
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
			comments: 0,
		},
	],
	counts: { todo: 2, mine: 0, urgent: 1, creance: 0, closed: 4 },
	total: 2,
	start: 0,
	page_length: 20,
	names: ['TC-1', 'TC-2'],
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
	comments: { count: 2, last: { who: 'Commercial A', at: '2026-11-01 10:00:00', parts: [{ text: 'Le client relance', mention: false }] } },
}
const activity = {
	comment_count: 1,
	items: [
		{ id: 'C1', kind: 'comment', who: 'Back Office', at: '2026-11-03 10:00:00', mine: true, text: 'Bonjour @Commercial A', parts: [{ text: 'Bonjour ', mention: false }, { text: '@Commercial A', mention: true }], mentions: [{ id: 'a@example.com', label: 'Commercial A' }] },
		{ id: 'C2', kind: 'comment', who: 'Commercial A', at: '2026-11-02 10:00:00', mine: false, text: 'Message', parts: [{ text: 'Message', mention: false }], mentions: [] },
		{ id: 'V1', kind: 'change', who: 'Back Office', at: '2026-11-01 11:00:00', changes: [{ label: 'Statut', old: 'Nouveau', new: 'En Cours' }] },
		{ id: 'TC-1-creation', kind: 'create', who: 'Commercial A', at: '2026-11-01 10:00:00', text: 'a créé ce document' },
	],
}
const formOptions = {
	types: [{ value: 'Bon de commande', urgence: 'U2' }, { value: 'Autre', urgence: 'U0' }],
	channels: ['Email'],
	sites: [{ value: 'S1', label: 'OFFSET' }, { value: 'S2', label: 'FLEXO 2' }],
	commercials: [{ value: 'a@example.com', label: 'Commercial A' }, { value: 'b@example.com', label: 'Commercial B' }],
}
const clientChoices = [{ name: 'CLI-1', label: 'Client Un', wilaya: 'Sétif', commercial: 'b@example.com', commercial_name: 'Commercial B', open_tickets: 2 }]
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
		: /get_activity|add_comment|update_comment|delete_comment/.test(url)
			? activity
			: url.includes('get_mention_candidates')
				? [{ id: 'a@example.com', label: 'Commercial A' }, { id: 'b@example.com', label: 'Autre Personne' }]
				: url.includes('get_ticket_form_options')
					? formOptions
					: url.includes('search_clients')
						? clientChoices
						: url.includes('create_ticket')
							? { name: 'TC-NEW' }
							: url.includes('upload_file')
								? {}
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
		expect(text).not.toContain('Commercial A')
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

		await wrapper.find('.btn-ghost').trigger('click')
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

	it('bascule le thème depuis le menu du compte et le garde sur cet appareil', async () => {
		const { wrapper } = await open('/')
		const before = document.documentElement.dataset.theme
		await wrapper.find('button[aria-label^="Mon compte"]').trigger('click')
		await wrapper.find('button[role="menuitem"]').trigger('click')
		const after = document.documentElement.dataset.theme
		expect(after).not.toBe(before)
		expect(localStorage.getItem('bureau-theme')).toBe(after)
		expect(wrapper.find('[role="menu"]').exists()).toBe(false)
		await wrapper.find('button[aria-label^="Mon compte"]').trigger('click')
		await wrapper.find('button[role="menuitem"]').trigger('click')
		expect(document.documentElement.dataset.theme).toBe(before)
	})

	it("montre les tickets en cours dans le menu et ouvre sur le Desk ce qui n'est pas encore repris", async () => {
		const { wrapper } = await open('/')
		const current = wrapper.find('.app-nav-item[aria-current="page"]')
		expect(current.text()).toContain('Tickets')
		expect(current.text()).toContain('2')
		const commandes = wrapper.find('a.app-nav-item[href="/app/sales-order"]')
		expect(commandes.attributes('target')).toBe('_blank')
	})

	it('replie le menu et garde ce choix sur cet appareil', async () => {
		const { wrapper } = await open('/')
		const shell = wrapper.find('.app-shell')
		const before = shell.attributes('data-collapsed')
		await wrapper.find('.app-collapse').trigger('click')
		expect(shell.attributes('data-collapsed')).not.toBe(before)
		expect(localStorage.getItem('bureau-menu')).toBe(before === 'true' ? 'open' : 'rail')
	})

	it('le fil d\'Ariane nomme la fiche ouverte et ramène à la liste', async () => {
		const { wrapper } = await open('/ticket/TC-1')
		const crumbs = wrapper.find('.app-crumbs')
		expect(crumbs.text()).toContain('Client Un · TC-1')
		expect(crumbs.find('a').text()).toBe('Tickets')
	})

	it('la recherche globale trouve un ticket, y compris clos, et ouvre sa fiche', async () => {
		const { wrapper, router } = await open('/')
		fetchMock.mockClear()
		await wrapper.find('.global-search input').setValue('Client')
		await new Promise((resolve) => setTimeout(resolve, 300))
		await flushPromises()
		const views = fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://x').searchParams.get('view'))
		expect(views).toEqual(expect.arrayContaining(['todo', 'closed']))
		const results = wrapper.findAll('.global-search-results .app-menu-item')
		expect(results).toHaveLength(2)
		await results[1].trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.path).toBe('/ticket/TC-2')
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

	const queueParams = () => {
		const urls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('get_queue'))
		return new URL(urls[urls.length - 1], 'http://x').searchParams
	}

	it('demande le tri au serveur : croissant, décroissant, puis ordre par défaut', async () => {
		const { wrapper } = await open('/')
		const sortByClient = async () => {
			await wrapper.find('.list-head [aria-label*="Client"]').trigger('click')
			await flushPromises()
		}
		await sortByClient()
		expect(queueParams().get('sort')).toBe('client')
		expect(queueParams().get('direction')).toBe('asc')
		await sortByClient()
		expect(queueParams().get('direction')).toBe('desc')
		await sortByClient()
		expect(queueParams().get('sort')).toBeNull()
	})

	it("n'offre pas le tri par étape", async () => {
		const { wrapper } = await open('/')
		expect(wrapper.find('.list-head [aria-label*="Étape"]').exists()).toBe(false)
		expect(wrapper.find('.list-head').text()).toContain('Étape')
	})

	describe('pagination', () => {
		const paged = { ...queue, total: 45, names: Array.from({ length: 45 }, (_, index) => `TC-${index + 1}`) }
		beforeEach(() => {
			localStorage.removeItem('bureau-tickets-par-page')
			fetchMock.mockImplementation((input) => {
				const url = String(input)
				if (!url.includes('get_queue')) return respond(url)
				const params = new URL(url, 'http://x').searchParams
				return Promise.resolve(new Response(JSON.stringify({ message: { ...paged, start: Number(params.get('start')), page_length: Number(params.get('page_length')) } }), { status: 200 }))
			})
		})
		afterEach(() => {
			fetchMock.mockImplementation((input) => respond(String(input)))
			localStorage.removeItem('bureau-tickets-par-page')
		})

		it("affiche la position, change de page et garde la page dans l'adresse", async () => {
			const { wrapper, router } = await open('/')
			expect(wrapper.find('.pager').text()).toContain('1–20 sur 45')
			expect(wrapper.find('.pager').text()).toContain('Page 1 sur 3')
			expect(wrapper.find('[aria-label="Page précédente"]').attributes('disabled')).toBeDefined()
			await wrapper.find('[aria-label="Page suivante"]').trigger('click')
			await flushPromises()
			expect(queueParams().get('start')).toBe('20')
			expect(wrapper.find('.pager').text()).toContain('21–40 sur 45')
			await flushPromises()
			expect(router.currentRoute.value.query.page).toBe('2')
		})

		it("reprend la page et la vue depuis l'adresse", async () => {
			await open('/?vue=mine&page=3')
			expect(queueParams().get('view')).toBe('mine')
			expect(queueParams().get('start')).toBe('40')
		})

		it('changer de taille ramène à la première page et reste en mémoire', async () => {
			const { wrapper } = await open('/?page=2')
			await wrapper.findAll('.seg button').find((button) => button.text() === '100')!.trigger('click')
			await flushPromises()
			expect(queueParams().get('start')).toBe('0')
			expect(queueParams().get('page_length')).toBe('100')
			expect(localStorage.getItem('bureau-tickets-par-page')).toBe('100')
		})

		it('changer de vue ramène à la première page', async () => {
			const { wrapper } = await open('/?page=2')
			await wrapper.find('.view[aria-label^="À moi"]').trigger('click')
			await flushPromises()
			expect(queueParams().get('view')).toBe('mine')
			expect(queueParams().get('start')).toBe('0')
		})

		it('changer de page vide la sélection', async () => {
			const { wrapper } = await open('/')
			await row(wrapper, 'TC-1').find('input[type="checkbox"]').setValue(true)
			expect(wrapper.find('.bureau-bulk').exists()).toBe(true)
			await wrapper.find('[aria-label="Page suivante"]').trigger('click')
			await flushPromises()
			expect(wrapper.find('.bureau-bulk').exists()).toBe(false)
		})

		it('la fiche va au ticket voisin au-delà de la page affichée', async () => {
			const { wrapper, router } = await open('/ticket/TC-2')
			expect(wrapper.text()).toContain('2 sur 45')
			await wrapper.find('[aria-label="Ticket suivant"]').trigger('click')
			await flushPromises()
			expect(router.currentRoute.value.params.id).toBe('TC-3')
		})
	})

	it('choisit les colonnes et garde ce choix', async () => {
		localStorage.removeItem('bureau-tickets-colonnes')
		const { wrapper } = await open('/')
		await wrapper.find('[aria-label="Choisir les colonnes"]').trigger('click')
		const commercial = wrapper.findAll('[role="menuitemcheckbox"]').find((item) => item.text() === 'Commercial')!
		await commercial.trigger('click')
		expect(row(wrapper, 'TC-1').text()).toContain('Commercial A')
		expect(JSON.parse(localStorage.getItem('bureau-tickets-colonnes')!)).toContain('commercial')
		localStorage.removeItem('bureau-tickets-colonnes')
	})

	it("distingue une vue vide d'une recherche sans résultat", async () => {
		fetchMock.mockImplementation((input) => {
			const url = String(input)
			if (url.includes('get_queue')) return Promise.resolve(new Response(JSON.stringify({ message: { ...queue, tickets: [], names: [], total: 0 } }), { status: 200 }))
			return respond(url)
		})
		const { wrapper } = await open('/')
		expect(wrapper.find('.list-state').text()).toContain('Rien dans cette vue')
		await wrapper.find('.bureau-search').setValue('xyz')
		expect(wrapper.find('.list-state').text()).toContain('Aucun résultat')
		await wrapper.find('.list-state button').trigger('click')
		expect((wrapper.find('.bureau-search').element as HTMLInputElement).value).toBe('')
		fetchMock.mockImplementation((input) => respond(String(input)))
	})

	describe('création de ticket', () => {
		const openDialog = async () => {
			const opened = await open('/')
			await opened.wrapper.findAll('.page-head button').find((button) => button.text() === 'Nouveau ticket')!.trigger('click')
			await flushPromises()
			return opened
		}
		const chooseClient = async (wrapper: Awaited<ReturnType<typeof open>>['wrapper']) => {
			await wrapper.find('#nouveau-client').trigger('focus')
			await flushPromises()
			await wrapper.find('.picker-menu .app-menu-item').trigger('click')
		}
		const fill = async (wrapper: Awaited<ReturnType<typeof open>>['wrapper']) => {
			await chooseClient(wrapper)
			await wrapper.findAll('.type-tile').find((tile) => tile.text() === 'Bon de commande')!.trigger('click')
			await wrapper.find('#nouveau-site').setValue('S1')
			await wrapper.find('#nouveau-description').setValue('40 000 boîtes')
		}
		const button = (wrapper: Awaited<ReturnType<typeof open>>['wrapper'], label: string) => wrapper.findAll('.dialog button').find((item) => item.text() === label)!

		it("ouvre la fenêtre sans quitter la page et n'envoie rien vers le Desk", async () => {
			const { wrapper, router } = await openDialog()
			expect(wrapper.find('.dialog').exists()).toBe(true)
			expect(router.currentRoute.value.path).toBe('/')
			expect(wrapper.find('a[href*="ticket-commercial/new"]').exists()).toBe(false)
		})

		it('refuse une saisie incomplète, sans appeler le serveur', async () => {
			const { wrapper } = await openDialog()
			await button(wrapper, 'Créer le ticket').trigger('click')
			expect(wrapper.findAll('.dialog .field-error')).toHaveLength(4)
			expect(posted().some((item) => item.url.includes('create_ticket'))).toBe(false)
		})

		it('reprend le commercial du client, signale ses tickets ouverts et annonce l\'urgence', async () => {
			const { wrapper } = await openDialog()
			await fill(wrapper)
			expect((wrapper.find('#nouveau-commercial').element as HTMLSelectElement).value).toBe('b@example.com')
			expect(wrapper.find('.dialog').text()).toContain('déjà 2 tickets ouverts')
			expect(wrapper.find('.dialog .urgence').text()).toBe('U2')
		})

		it('crée le ticket, ferme la fenêtre et surligne la ligne', async () => {
			fetchMock.mockImplementation((input) => {
				const url = String(input)
				if (url.includes('get_queue')) return Promise.resolve(new Response(JSON.stringify({ message: { ...queue, tickets: [{ ...queue.tickets[0], name: 'TC-NEW' }], names: ['TC-NEW'], total: 1 } }), { status: 200 }))
				return respond(url)
			})
			const { wrapper, router } = await openDialog()
			await fill(wrapper)
			await button(wrapper, 'Créer le ticket').trigger('click')
			await flushPromises()
			await flushPromises()
			const call = posted().find((item) => item.url.includes('create_ticket'))!
			expect(call.body).toMatchObject({ customer: 'CLI-1', request_type: 'Bon de commande', site: 'S1', description: '40 000 boîtes', commercial: 'b@example.com' })
			expect(wrapper.find('.dialog').exists()).toBe(false)
			expect(router.currentRoute.value.path).toBe('/')
			expect(wrapper.find('.list-row-created').exists()).toBe(true)
			await wrapper.find('.toast-action button').trigger('click')
			await flushPromises()
			expect(router.currentRoute.value.params.id).toBe('TC-NEW')
			fetchMock.mockImplementation((input) => respond(String(input)))
		})

		it('garde le client, le site et le commercial pour la saisie suivante', async () => {
			const { wrapper } = await openDialog()
			await fill(wrapper)
			await button(wrapper, 'Créer et en saisir un autre').trigger('click')
			await flushPromises()
			await flushPromises()
			expect(wrapper.find('.dialog').exists()).toBe(true)
			expect(wrapper.find('.picked').text()).toContain('Client Un')
			expect((wrapper.find('#nouveau-site').element as HTMLSelectElement).value).toBe('S1')
			expect((wrapper.find('#nouveau-description').element as HTMLTextAreaElement).value).toBe('')
			expect(wrapper.find('.type-tile[aria-checked="true"]').exists()).toBe(false)
		})

		it('garde la saisie si le serveur refuse', async () => {
			const { wrapper } = await openDialog()
			await fill(wrapper)
			fetchMock.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ exception: 'frappe.ValidationError: Refusé' }), { status: 417 })))
			await button(wrapper, 'Créer le ticket').trigger('click')
			await flushPromises()
			expect(wrapper.find('.dialog [role="alert"]').exists()).toBe(true)
			expect((wrapper.find('#nouveau-description').element as HTMLTextAreaElement).value).toBe('40 000 boîtes')
		})

		it('signale un fichier non envoyé sans perdre le ticket', async () => {
			fetchMock.mockImplementation((input) => {
				const url = String(input)
				if (url.includes('upload_file')) return Promise.reject(new Error('réseau'))
				return respond(url)
			})
			const { wrapper } = await openDialog()
			await fill(wrapper)
			const input = wrapper.find('.dropzone input')
			Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'bc.pdf')], configurable: true })
			await input.trigger('change')
			expect(wrapper.find('.dialog').text()).toContain('bc.pdf')
			await button(wrapper, 'Créer le ticket').trigger('click')
			await flushPromises()
			await flushPromises()
			expect(wrapper.find('.toast-action').text()).toContain("Un fichier n'a pas été envoyé")
			fetchMock.mockImplementation((input2) => respond(String(input2)))
		})

		it('demande confirmation avant de perdre une saisie, pas si la fenêtre est vide', async () => {
			const { wrapper } = await openDialog()
			await wrapper.find('.dialog-scrim').trigger('keydown', { key: 'Escape' })
			expect(wrapper.find('.dialog').exists()).toBe(false)

			await wrapper.findAll('.page-head button').find((item) => item.text() === 'Nouveau ticket')!.trigger('click')
			await flushPromises()
			await wrapper.find('#nouveau-description').setValue('Texte')
			await wrapper.find('.dialog-scrim').trigger('keydown', { key: 'Escape' })
			expect(wrapper.find('.dialog').text()).toContain('Abandonner cette saisie ?')
			await button(wrapper, 'Continuer la saisie').trigger('click')
			expect((wrapper.find('#nouveau-description').element as HTMLTextAreaElement).value).toBe('Texte')
			await wrapper.find('.dialog-scrim').trigger('click')
			expect(wrapper.find('.dialog').exists()).toBe(true)
		})
	})

	describe('commentaires et activité', () => {
		it("montre les bulles et l'historique, avec les outils sur ses seuls commentaires", async () => {
			const { wrapper } = await open('/ticket/TC-1')
			await flushPromises()
			const feed = wrapper.find('.activity')
			expect(feed.findAll('.comment-bubble')).toHaveLength(2)
			expect(feed.findAll('.comment-tools')).toHaveLength(1)
			expect(feed.find('.mention').text()).toBe('@Commercial A')
			expect(feed.text()).toContain('a changé Statut de Nouveau à En Cours')
			expect(feed.text()).toContain('a créé ce document')
			expect(wrapper.text()).toContain('2 commentaires')
		})

		it('filtre le fil', async () => {
			const { wrapper } = await open('/ticket/TC-1')
			await flushPromises()
			const filterBy = async (label: string) => {
				await wrapper.findAll('.activity .seg button').find((button) => button.text().startsWith(label))!.trigger('click')
			}
			await filterBy('Commentaires')
			expect(wrapper.findAll('.activity .act-item')).toHaveLength(2)
			await filterBy('Historique')
			expect(wrapper.findAll('.comment-bubble')).toHaveLength(0)
			expect(wrapper.findAll('.activity .act-item')).toHaveLength(2)
		})

		it('envoie un commentaire avec sa mention, puis vide la saisie', async () => {
			const { wrapper } = await open('/ticket/TC-1')
			await flushPromises()
			const input = wrapper.find('textarea[aria-label="Écrire un commentaire"]')
			const send = () => wrapper.findAll('.comment-foot button')[0]
			expect(send().attributes('disabled')).toBeDefined()
			await input.setValue('Bonjour @Comm')
			;(input.element as HTMLTextAreaElement).setSelectionRange(13, 13)
			await input.trigger('input')
			await flushPromises()
			await flushPromises()
			const options = wrapper.findAll('.mention-menu .app-menu-item')
			expect(options).toHaveLength(1)
			await options[0].trigger('click')
			await flushPromises()
			expect((input.element as HTMLTextAreaElement).value).toBe('Bonjour @Commercial A ')
			await send().trigger('click')
			await flushPromises()
			const call = posted().find((item) => item.url.includes('add_comment'))!
			expect(call.body.text).toBe('Bonjour @Commercial A')
			expect(call.body.mentions).toEqual([{ id: 'a@example.com', label: 'Commercial A' }])
			expect((input.element as HTMLTextAreaElement).value).toBe('')
		})

		it('garde le texte si le serveur refuse', async () => {
			const { wrapper } = await open('/ticket/TC-1')
			await flushPromises()
			fetchMock.mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ exception: 'frappe.ValidationError: Refusé' }), { status: 417 })))
			const input = wrapper.find('textarea[aria-label="Écrire un commentaire"]')
			await input.setValue('Mon message')
			await wrapper.findAll('.comment-foot button')[0].trigger('click')
			await flushPromises()
			expect(wrapper.find('.comment-field [role="alert"]').exists()).toBe(true)
			expect((input.element as HTMLTextAreaElement).value).toBe('Mon message')
		})

		it('modifie puis supprime son commentaire après confirmation', async () => {
			const { wrapper } = await open('/ticket/TC-1')
			await flushPromises()
			await wrapper.find('[aria-label="Modifier ce commentaire"]').trigger('click')
			await wrapper.find('textarea[aria-label="Modifier le commentaire"]').setValue('Corrigé')
			await wrapper.findAll('.comment-bubble button').find((button) => button.text() === 'Enregistrer')!.trigger('click')
			await flushPromises()
			const updated = posted().find((item) => item.url.includes('update_comment'))!
			expect(updated.body).toMatchObject({ name: 'TC-1', comment: 'C1', text: 'Corrigé' })

			await wrapper.find('[aria-label="Supprimer ce commentaire"]').trigger('click')
			expect(posted().some((item) => item.url.includes('delete_comment'))).toBe(false)
			await wrapper.findAll('.comment-confirm button').find((button) => button.text() === 'Supprimer')!.trigger('click')
			await flushPromises()
			expect(posted().find((item) => item.url.includes('delete_comment'))!.body.comment).toBe('C1')
		})

		it("montre le dernier commentaire dans l'aperçu et ouvre la fiche sur le fil", async () => {
			const { wrapper, router } = await open('/?apercu=TC-1')
			await flushPromises()
			const drawer = wrapper.find('.bureau-drawer')
			expect(drawer.text()).toContain('Le client relance')
			await drawer.findAll('button').find((button) => button.text() === 'Voir les 2 commentaires')!.trigger('click')
			await flushPromises()
			expect(router.currentRoute.value.params.id).toBe('TC-1')
			expect(router.currentRoute.value.query.fil).toBe('1')
		})
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
