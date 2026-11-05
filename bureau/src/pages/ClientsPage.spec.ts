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

const rows = [
	{ name: 'CLI-1', modified: '2026-11-04 10:00:00', client: 'LAITERIE ATLAS', status: 'Actif', wilaya: 'Sétif', commune: 'El Eulma', categorie: 'Commercial', commercial: 'Sofiane', contact: 'R. Saidi', telephone: '036', grand_compte: 1, visite: '2026-10-22', creance: 1240000, tickets: 2 },
	{ name: 'CLI-2', modified: '2026-11-04 10:00:00', client: 'PHARMA NUMIDIA', status: 'Prospect', wilaya: null, commune: null, categorie: 'Commercial', commercial: null, contact: null, telephone: null, grand_compte: 0, visite: null, creance: 0, tickets: 0 },
]
const list = { clients: rows, counts: { all: 2, actif: 1, prospect: 1, dormant: 0, creance: 1, perdu: 0 }, total: 2, start: 0, page_length: 20, names: ['CLI-1', 'CLI-2'] }
const detail = {
	name: 'CLI-1',
	modified: '2026-11-04 10:00:00',
	client: 'LAITERIE ATLAS',
	status: 'Actif',
	forme_juridique: 'SPA',
	categorie: 'Commercial',
	groupe: null,
	depuis: '2019-03-14',
	commune: 'abc123',
	commune_label: 'El Eulma',
	wilaya: 'Sétif',
	map_url: null,
	commercial: 'Sofiane',
	commercial_user: 's@example.com',
	contact: 'R. Saidi',
	telephone: '036',
	email: 'r@example.com',
	visite: '2026-10-22',
	grand_compte: 1,
	prioritaire: 0,
	petites_quantites: 0,
	qualite: 4.5,
	satisfaction: null,
	sensibilites: { prix: 'Forte', delais: null, qualite: null, process: null },
	pieces: [{ key: 'rc', label: 'Nº RC', numero: '19 B', fichier: '/private/files/rc.pdf' }, { key: 'nif', label: 'Nº NIF', numero: null, fichier: null }],
	attributions: [{ societe: 'Aures', commercial: 'Sofiane', principal: 1 }],
	contacts: [{ nom: 'R. Saidi', fonction: 'Achats', telephone: '036', email: 'r@example.com', principal: 1 }],
	adresses: [{ label: 'Adresse principale', commune: 'El Eulma', wilaya: 'Sétif', texte: null }],
	tickets: [{ name: 'TC-9', request_type: 'Bon de commande', status: 'Blocage Créance', niveau_urgence: 'U1', echeance: null, is_open: true, is_late: false }],
	creance: { name: 'CC-1', statut: 'Ouverte', solde_restant: 1240000, date_prochaine_relance: '2026-11-12', dernier_resultat_recouvrement: 'À relancer', mouvements: [{ name: 'M-1', date_mouvement: '2026-10-20', type_mouvement: 'Paiement recouvré', type_paiement: 'Chèque', sens: 'Crédit', montant: 620000 }] },
	devis: [],
	commandes: [{ name: 'SO-1', transaction_date: '2026-10-28', grand_total: 3180000, status: 'To Bill' }],
	articles: [],
	relation: [{ name: 'V-1', doctype: 'Visite Commerciale', kind: 'Visite', date: '2026-10-22', objet: 'Suivi', who: 'Sofiane', status: 'Terminé', note: 'Devis accepté.' }, { name: 'A-1', doctype: 'Appel Telephonique', kind: 'Appel', date: '2026-10-20', objet: 'Entrant', who: 'Sofiane', status: 'Terminé', note: '' }],
	comments: { count: 0, last: null },
	can_edit: true,
	can_view_activity: true,
}
const options = { statuses: ['Prospect', 'Actif'], formes: ['SPA'], sensibilites: ['Forte'], categories: ['Commercial'], groupes: [], wilayas: ['Sétif'], commercials: [{ value: 's@example.com', label: 'Sofiane' }], nobody: '__nobody__' }

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

describe('page Clients', () => {
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
			'bureau_clients.get_clients': list,
			'bureau_clients.get_client_options': options,
			'bureau_clients.get_client_activity': { items: [], comment_count: 0 },
			'bureau_clients.get_client': detail,
			'bureau_clients.search_communes': [{ name: 'Akbou', commune: 'Akbou', wilaya: 'Béjaïa' }],
			'bureau_clients.create_prospect': { name: 'CLI-3' },
			'bureau_clients.update_client': { ...detail, status: 'Dormant' },
			'bureau.search_clients': [],
			'bureau.get_queue': { tickets: [], counts: { todo: 7 }, total: 0, start: 0, page_length: 1, names: [] },
			'bureau.get_ticket_form_options': { types: [], channels: [], sites: [], commercials: [] },
			'bureau.get_mention_candidates': [],
			'bureau_bulk.get_bulk_options': {
				can_delete: true,
				fields: [
					{ fieldname: 'custom_status', label: 'Statut Client', fieldtype: 'Select', options: ['Actif', 'Dormant'], required: true },
					{ fieldname: 'custom_gps', label: 'GPS', fieldtype: 'Data', options: [], required: false },
					{ fieldname: 'custom_grand_compte', label: 'Grand Compte', fieldtype: 'Check', options: [], required: false },
					{ fieldname: 'customer_group', label: 'Catégorie Client', fieldtype: 'Link', options: [], required: true },
				],
			},
			'bureau_bulk.bulk_update': { done: ['CLI-1'], skipped: [{ name: 'CLI-2', reason: 'Valeur refusée.' }] },
			'bureau_bulk.bulk_add_tags': { done: ['CLI-1', 'CLI-2'], skipped: [] },
			'bureau_bulk.bulk_delete': { done: ['CLI-1'], skipped: [] },
			'bureau_bulk.get_bulk_tags': ['VIP'],
			'bureau_bulk.search_bulk_link': [{ value: 'Commercial', label: 'Commercial' }],
		}
		fetchMock.mockClear()
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		document.body.innerHTML = ''
	})

	it('le menu mène aux clients, sans quitter le poste', async () => {
		const { wrapper, router } = await open('/')
		await wrapper.find('a.app-nav-item[href="/bureau/clients"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Clients')
		expect(wrapper.find('.app-nav-item[aria-current="page"]').text()).toContain('Clients')
		wrapper.unmount()
	})

	it('affiche la liste, ses vues et le compteur du menu', async () => {
		const { wrapper } = await open('/clients')
		expect(wrapper.text()).toContain('LAITERIE ATLAS')
		expect(wrapper.text()).toContain('Grand compte')
		expect(wrapper.text()).toContain('Non attribué')
		expect(wrapper.text()).toContain('Jamais')
		expect(wrapper.findAll('.list-row input[type="checkbox"]')).toHaveLength(2)
		await wrapper.findAll('.bureau-toolbar button').find((button) => button.text().startsWith('Filtres'))!.trigger('click')
		expect(wrapper.findAll('select[aria-label="Afficher"] option').map((option) => option.text())).toContain('Avec créance (1)')
		wrapper.unmount()
	})

	it('garde la vue dans l\'adresse et la demande au serveur', async () => {
		const { wrapper, router } = await open('/clients?vue=dormant')
		expect(String(fetchMock.mock.calls.find((call) => String(call[0]).includes('get_clients'))?.[0])).toContain('view=dormant')
		expect(wrapper.find('.filter-chip').text()).toBe('Dormants')
		await wrapper.findAll('.bureau-toolbar button').find((button) => button.text().startsWith('Filtres'))!.trigger('click')
		await wrapper.find('select[aria-label="Afficher"]').setValue('actif')
		await flushPromises()
		expect(router.currentRoute.value.query.vue).toBe('actif')
		wrapper.unmount()
	})

	it("ouvre l'aperçu au clic, puis la fiche au double clic", async () => {
		const { wrapper, router } = await open('/clients')
		await wrapper.find('.list-row-main').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.query.apercu).toBe('CLI-1')
		expect(wrapper.find('.bureau-drawer').text()).toContain('R. Saidi')
		await wrapper.find('.list-row-main').trigger('dblclick')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Client')
		wrapper.unmount()
	})

	it('la fiche résume les affaires et signale un ticket bloqué', async () => {
		const { wrapper } = await open('/clients/CLI-1')
		expect(wrapper.findAll('.record-tab').map((tab) => tab.text())).toEqual(['Aperçu', 'Affaires3', 'Articles', 'Visites et appels2', 'Informations', 'Activité'])
		expect(wrapper.find('.record-tab[aria-selected="true"]').text()).toBe('Aperçu')
		expect(wrapper.text()).toContain('1 ticket bloqué pour créance')
		expect(wrapper.text()).toContain('4,5 sur 5')
		expect(wrapper.text()).toContain('El Eulma, Sétif')
		expect(wrapper.text()).not.toContain('abc123')
		expect(wrapper.text()).toContain('Visite du 22/10/2026')
		wrapper.unmount()
	})

	it("l'onglet reste dans l'adresse, et un onglet inconnu ramène à l'aperçu", async () => {
		const { wrapper, router } = await open('/clients/CLI-1?onglet=inconnu')
		expect(wrapper.find('.record-tab[aria-selected="true"]').text()).toBe('Aperçu')
		await wrapper.findAll('.record-tab')[1].trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.query.onglet).toBe('affaires')
		expect(wrapper.text()).toContain('−620 000')
		expect(wrapper.text()).toContain('À facturer')
		wrapper.unmount()
	})

	it('filtre les échanges par type', async () => {
		const { wrapper } = await open('/clients/CLI-1?onglet=relation')
		expect(wrapper.findAll('.ref-table tbody tr')).toHaveLength(2)
		await wrapper.findAll('.seg button').find((button) => button.text() === 'Appels')!.trigger('click')
		expect(wrapper.findAll('.ref-table tbody tr')).toHaveLength(1)
		wrapper.unmount()
	})

	it('montre les pièces à joindre, et un article absent en état vide', async () => {
		const { wrapper } = await open('/clients/CLI-1?onglet=infos')
		expect(wrapper.text()).toContain('1 manquante')
		expect(wrapper.find('input[type="file"]').attributes('aria-label')).toBe('Joindre le fichier Nº NIF')
		await wrapper.findAll('.record-tab')[2].trigger('click')
		await flushPromises()
		wrapper.unmount()
		const articles = await open('/clients/CLI-1?onglet=articles')
		expect(articles.wrapper.text()).toContain('Aucun article pour ce client')
		articles.wrapper.unmount()
	})

	it('cache Modifier et Activité sans le droit', async () => {
		current['bureau_clients.get_client'] = { ...detail, can_edit: false, can_view_activity: false }
		const { wrapper } = await open('/clients/CLI-1')
		expect(wrapper.findAll('.record-tab').map((tab) => tab.text())).not.toContain('Activité')
		expect(wrapper.text()).not.toContain('Modifier')
		expect(wrapper.text()).not.toContain('Dernière activité')
		wrapper.unmount()
	})

	it("refuse un prospect incomplet, puis le crée et reste sur la liste", async () => {
		const { wrapper, router } = await open('/clients')
		await wrapper.findAll('.btn-primary').find((button) => button.text().includes('Nouveau prospect'))!.trigger('click')
		await flushPromises()
		const dialog = () => wrapper.find('.dialog')
		await dialog().findAll('.btn-primary')[0].trigger('click')
		await flushPromises()
		expect(dialog().text()).toContain('Saisissez la raison sociale.')
		expect(dialog().text()).toContain('Choisissez le commercial.')
		expect(posted('create_prospect')).toBeUndefined()

		await dialog().find('#client-raison').setValue('sarl atlas')
		expect(dialog().text()).toContain('Enregistrée ainsi : SARL ATLAS')
		await dialog().find('#client-forme').setValue('SPA')
		await dialog().find('#client-commercial').setValue('s@example.com')
		await dialog().find('#client-commune').trigger('focus')
		await flushPromises()
		await dialog().find('.picker-menu .app-menu-item').trigger('click')
		await flushPromises()
		expect(dialog().text()).toContain('Wilaya : Béjaïa')
		await dialog().findAll('.btn-primary')[0].trigger('click')
		await flushPromises()
		await flushPromises()
		expect(posted('create_prospect').values).toMatchObject({ customer_name: 'sarl atlas', forme_juridique: 'SPA', categorie: 'Commercial', commune: 'Akbou', commercial: 's@example.com' })
		expect(wrapper.find('.dialog').exists()).toBe(false)
		expect(wrapper.find('.toast-action').text()).toContain('Prospect créé.')
		expect(router.currentRoute.value.name).toBe('Clients')
		wrapper.unmount()
	})

	it("une catégorie préremplie ne demande pas de confirmation à la fermeture", async () => {
		const { wrapper } = await open('/clients')
		await wrapper.findAll('.btn-primary').find((button) => button.text().includes('Nouveau prospect'))!.trigger('click')
		await flushPromises()
		await wrapper.find('.dialog .btn-ghost').trigger('click')
		expect(wrapper.find('.dialog').exists()).toBe(false)
		wrapper.unmount()
	})

	it("Modifier n'envoie que ce qui a changé, avec la date affichée", async () => {
		const { wrapper } = await open('/clients/CLI-1')
		await wrapper.findAll('.btn-secondary').find((button) => button.text() === 'Modifier')!.trigger('click')
		await flushPromises()
		await wrapper.find('#client-statut').setValue('Prospect')
		await wrapper.find('.dialog .btn-primary').trigger('click')
		await flushPromises()
		await flushPromises()
		expect(posted('update_client')).toEqual({ name: 'CLI-1', modified: detail.modified, values: { status: 'Prospect' } })
		expect(wrapper.find('.dialog').exists()).toBe(false)
		expect(wrapper.text()).toContain('Client enregistré.')
		wrapper.unmount()
	})

	it('Nouveau ticket part avec le client et son commercial', async () => {
		const { wrapper } = await open('/clients/CLI-1')
		await wrapper.findAll('.btn-primary').find((button) => button.text() === 'Nouveau ticket')!.trigger('click')
		await flushPromises()
		expect(wrapper.find('.dialog .picked').text()).toContain('LAITERIE ATLAS')
		await wrapper.find('.dialog .btn-ghost').trigger('click')
		expect(wrapper.find('.dialog').exists()).toBe(false)
		wrapper.unmount()
	})

	it('dit quand le client est introuvable', async () => {
		current['bureau_clients.get_client'] = undefined
		fetchMock.mockImplementation((input: RequestInfo | URL) => (String(input).includes('bureau_clients.get_client?') ? Promise.resolve(new Response('{}', { status: 404 })) : respond(String(input))))
		const { wrapper } = await open('/clients/CLI-X')
		expect(wrapper.text()).toContain("Ce client n'existe pas ou n'existe plus.")
		wrapper.unmount()
		fetchMock.mockImplementation((input: RequestInfo | URL) => respond(String(input)))
	})

	describe('actions groupées', () => {
		const checkbox = (wrapper: Awaited<ReturnType<typeof open>>['wrapper'], index: number) => wrapper.findAll('.list-row input[type="checkbox"]')[index]
		const barButton = (wrapper: Awaited<ReturnType<typeof open>>['wrapper'], label: string) => wrapper.find('.bureau-bulk').findAll('button').find((button) => button.text() === label)!
		const dialogButton = (wrapper: Awaited<ReturnType<typeof open>>['wrapper'], text: string) => wrapper.find('.dialog').findAll('button').find((button) => button.text().startsWith(text))!

		async function pickAll(wrapper: Awaited<ReturnType<typeof open>>['wrapper']) {
			await wrapper.find('.list-head input[type="checkbox"]').setValue(true)
			await flushPromises()
		}

		it('cocher propose les actions, sans ouvrir l\'aperçu', async () => {
			const { wrapper, router } = await open('/clients')
			await checkbox(wrapper, 0).setValue(true)
			await flushPromises()
			expect(router.currentRoute.value.query.apercu).toBeUndefined()
			const bar = wrapper.find('.bureau-bulk').text()
			expect(bar).toContain('1 client sélectionné')
			for (const label of ['Modifier', 'Tags', 'Exporter', 'Supprimer']) expect(bar).toContain(label)
		})

		it('Shift + clic coche l\'intervalle, Ctrl + clic coche sans ouvrir l\'aperçu', async () => {
			const { wrapper, router } = await open('/clients')
			await checkbox(wrapper, 0).setValue(true)
			await checkbox(wrapper, 1).trigger('click', { shiftKey: true })
			await checkbox(wrapper, 1).setValue(true)
			await flushPromises()
			expect(wrapper.find('.bureau-bulk').text()).toContain('2 clients sélectionnés')
			await wrapper.find('[aria-label="Désélectionner tout"]').trigger('click')
			await wrapper.findAll('.list-row-main')[1].trigger('click', { ctrlKey: true })
			await flushPromises()
			expect(router.currentRoute.value.query.apercu).toBeUndefined()
			expect(wrapper.find('.bureau-bulk').text()).toContain('1 client sélectionné')
		})

		it('une recherche vide la sélection', async () => {
			const { wrapper } = await open('/clients')
			await pickAll(wrapper)
			expect(wrapper.find('.bureau-bulk').exists()).toBe(true)
			await wrapper.find('.bureau-search input').setValue('atlas')
			await flushPromises()
			expect(wrapper.find('.bureau-bulk').exists()).toBe(false)
		})

		it('Modifier envoie champ et valeur, puis liste ce qui n\'a pas été traité', async () => {
			const { wrapper } = await open('/clients')
			await pickAll(wrapper)
			await barButton(wrapper, 'Modifier').trigger('click')
			const apply = () => dialogButton(wrapper, 'Modifier 2 clients')
			expect(apply().attributes('disabled')).toBeDefined()
			await wrapper.find('#bulk-field').setValue('custom_status')
			// Champ obligatoire : pas d'envoi sans valeur.
			expect(apply().attributes('disabled')).toBeDefined()
			await wrapper.find('#bulk-value').setValue('Dormant')
			await apply().trigger('click')
			await flushPromises()
			await flushPromises()
			expect(posted('bulk_update')).toEqual({
				doctype: 'Customer',
				items: rows.map(({ name, modified }) => ({ name, modified })),
				fieldname: 'custom_status',
				value: 'Dormant',
			})
			const message = wrapper.find('.bureau-bulk').text()
			expect(message).toContain('1 client modifié · 1 non traité')
			expect(message).toContain('CLI-2 : Valeur refusée.')
			expect(wrapper.findAll('.list-row input:checked')).toHaveLength(0)
		})

		it('prévient qu\'un champ facultatif laissé vide sera vidé', async () => {
			const { wrapper } = await open('/clients')
			await pickAll(wrapper)
			await barButton(wrapper, 'Modifier').trigger('click')
			await wrapper.find('#bulk-field').setValue('custom_gps')
			expect(wrapper.find('.dialog').text()).toContain('Ce champ sera vidé sur 2 clients.')
			expect(dialogButton(wrapper, 'Modifier 2 clients').attributes('disabled')).toBeUndefined()
			await wrapper.find('#bulk-field').setValue('custom_grand_compte')
			expect(dialogButton(wrapper, 'Modifier 2 clients').attributes('disabled')).toBeDefined()
		})

		it('un champ lien cherche ses valeurs sur le serveur', async () => {
			const { wrapper } = await open('/clients')
			await pickAll(wrapper)
			await barButton(wrapper, 'Modifier').trigger('click')
			await wrapper.find('#bulk-field').setValue('customer_group')
			await wrapper.find('#bulk-value').trigger('focus')
			await flushPromises()
			await wrapper.find('.picker-menu button').trigger('click')
			expect(wrapper.find('.picked').text()).toContain('Commercial')
			await dialogButton(wrapper, 'Modifier 2 clients').trigger('click')
			await flushPromises()
			expect(posted('bulk_update').value).toBe('Commercial')
		})

		it('Tags ajoute la saisie en cours et ce qui a été validé', async () => {
			const { wrapper } = await open('/clients')
			await pickAll(wrapper)
			await barButton(wrapper, 'Tags').trigger('click')
			const input = wrapper.find('#bulk-tags')
			await input.setValue('VIP')
			await input.trigger('keydown', { key: 'Enter' })
			await input.setValue('Salon 2026')
			await dialogButton(wrapper, 'Ajouter à 2 clients').trigger('click')
			await flushPromises()
			await flushPromises()
			expect(posted('bulk_add_tags').tags).toEqual(['VIP', 'Salon 2026'])
			expect(wrapper.find('.bureau-bulk').text()).toContain('2 clients étiquetés')
		})

		it('Supprimer demande confirmation et ferme l\'aperçu de la ligne supprimée', async () => {
			const { wrapper, router } = await open('/clients?apercu=CLI-1')
			await checkbox(wrapper, 0).setValue(true)
			await flushPromises()
			await barButton(wrapper, 'Supprimer').trigger('click')
			expect(posted('bulk_delete')).toBeUndefined()
			expect(wrapper.find('.dialog').text()).toContain('CLI-1')
			await dialogButton(wrapper, 'Supprimer 1 client').trigger('click')
			await flushPromises()
			await flushPromises()
			expect(posted('bulk_delete').items[0].name).toBe('CLI-1')
			expect(router.currentRoute.value.query.apercu).toBeUndefined()
		})

		it('sans le droit, Supprimer n\'apparaît pas', async () => {
			current['bureau_bulk.get_bulk_options'] = { can_delete: false, fields: [] }
			const { wrapper } = await open('/clients')
			await pickAll(wrapper)
			const bar = wrapper.find('.bureau-bulk').text()
			expect(bar).not.toContain('Supprimer')
			expect(barButton(wrapper, 'Modifier').attributes('disabled')).toBeDefined()
		})
	})
})
