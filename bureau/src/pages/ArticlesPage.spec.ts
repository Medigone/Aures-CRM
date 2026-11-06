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

const row = { name: 'CLI-1-003', modified: '2026-11-04 10:00:00', tags: ['Saisonnier'], designation: 'ETUI BISCUIT', type: 'Client', client: 'CLI-1', client_label: 'BISCUITERIE NUMIDIA', commercial: 'Samia', procede: 'Offset', support: 'BBTB 275 g', format: '100×200×34', bat: 'BAT-P Validé', commande: '2026-10-28', reference: 'H200', groupe: 'Produits', couleurs: 'CMJN', consommation: 240000, compose: 0, sous_article: 0, parent: null }
const list = {
	articles: [row, { ...row, name: 'CLI-1-007', designation: 'COFFRET', compose: 1, bat: null, commande: null, tags: [] }],
	counts: { all: 2, offset: 2, flexo: 0, salle_blanche: 0, sans_bat: 1, compose: 1, general: 0 },
	total: 2,
	start: 0,
	page_length: 20,
	names: ['CLI-1-003', 'CLI-1-007'],
}
const schema = {
	groups: [
		{ label: 'Offset', fields: [
			{ fieldname: 'custom_support', label: 'Papier', fieldtype: 'Link', conditions: ["eval: doc.custom_procédé == 'Offset'"], options: ['BBTB', 'Bristol'] },
			{ fieldname: 'custom_type_inutile', label: 'Champ Flexo', fieldtype: 'Data', conditions: ["eval: doc.custom_procédé == 'Flexo'"] },
		] },
		{ label: 'Options Vernis', fields: [{ fieldname: 'custom_uv', label: 'UV', fieldtype: 'Check', conditions: ["eval: doc.custom_procédé == 'Offset'"] }] },
	],
	fields: ['custom_support', 'custom_type_inutile', 'custom_uv'],
}
const options = { procedes: ['Offset', 'Flexo'], types: ['Client', 'Général'], groupes: ['Produits'], supports: ['BBTB'], clients: [{ value: 'CLI-1', label: 'BISCUITERIE NUMIDIA' }], groupe_defaut: 'Produits', can_create: true, schema }
const detail = {
	...row,
	ancien_code: null,
	unite: 'Unité',
	parent_label: null,
	quantite_parent: 0,
	wilaya: 'Sétif',
	commercial_user: 's@example.com',
	image: null,
	own_image: false,
	fichiers: { image: null, fiche_technique: '/private/files/ft.pdf', trace_decoupe: null },
	documents: [{ file_name: 'ft.pdf', file_url: '/private/files/ft.pdf', file_size: 2048, owner_name: 'Back Office', creation: '2026-11-04 10:00:00', roles: ['fiche_technique'] }],
	droits_prepresse: { maquette: true, nouvelle_version: true, bat: true },
	fiche: { custom_support: 'BBTB', custom_uv: 1 },
	prepresse: {
		maquettes: [{ name: 'MAQ-V3', status: 'Version Activée', ver: 3, resume_couleurs: 'CMJN', date_creation: '2026-10-20', desc_changements: 'Poids net', fichier_maquette: '/files/m.pdf' }],
		bats: [{ name: 'BAT-21', status: 'BAT-P Validé', date: '2026-05-08', maquette: 'MAQ-V2', valide_par_nom: 'K. Rahmani', fichier_valide: null, image: null }],
		traces: [{ name: 'TR-1', dimensions: '100x200x34', fichier_trace: null }],
		impositions: [{ name: 'IMP-1', machine_impression: 'Offset 5', nbr_poses: 8, taux_chutes: 12, defaut: 1, fichier_imp: null }],
		cliches: [],
		plans_flexo: [],
		etudes_techniques: [],
	},
	ecart_bat: { bat: 'BAT-21', maquette_bat: 'MAQ-V2', maquette_active: 'MAQ-V3' },
	commandes: [{ name: 'SO-1184', transaction_date: '2026-10-28', status: 'En Cours', qty: 50000, rate: 12.4, amount: 620000 }],
	devis: [{ name: 'QTN-1', transaction_date: '2026-10-12', status: 'Open', custom_statut_commande: 'Accepté', qty: 50000, rate: 12.4, amount: 620000 }],
	etudes: [{ name: 'EF-1', doctype: 'Etude Faisabilite', date_creation: '2026-10-02', status: 'Réalisable', quantite: 50000 }],
	tickets: [{ name: 'TC-1', request_type: 'Demande de devis', status: 'En Cours', niveau_urgence: 'U1', echeance: null, is_open: true, is_late: false }],
	sous_articles: [],
	comments: { count: 0, last: null },
	can_edit: true,
}

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

describe('page Articles', () => {
	const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => respond(String(input)))
	const posted = (method: string) => {
		const call = fetchMock.mock.calls.find((item) => String(item[0]).includes(method) && (item as unknown as [unknown, RequestInit])[1]?.method === 'POST')
		return call ? JSON.parse(String((call as unknown as [unknown, RequestInit])[1].body)) : undefined
	}

	beforeEach(() => {
		for (const key of Object.keys(localStorage)) if (key.startsWith('bureau-article-brouillon')) localStorage.removeItem(key)
		window.can_access = true
		window.user = 'bo@example.com'
		window.user_fullname = 'Back Office'
		current = {
			'bureau_articles.get_articles': list,
			'bureau_articles.get_article_options': options,
			'bureau_articles.get_article_activity': { items: [], comment_count: 0 },
			'bureau_articles.get_article': detail,
			'bureau_articles.create_article': { name: 'CLI-1-008' },
			'bureau_articles.update_article': { ...detail, reference: 'H300' },
			'bureau_articles.make_composed': { ...detail, compose: 1 },
			'bureau.search_clients': [{ name: 'CLI-1', label: 'BISCUITERIE NUMIDIA', wilaya: 'Sétif', commercial: null, commercial_name: null, open_tickets: 0 }],
			'bureau.get_queue': { tickets: [], counts: { todo: 7 }, total: 0, start: 0, page_length: 1, names: [] },
			'bureau.get_ticket_form_options': { types: [], channels: [], sites: [], commercials: [] },
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

	it('le menu mène aux articles, sans quitter le poste', async () => {
		const { wrapper, router } = await open('/')
		await wrapper.find('a.app-nav-item[href="/bureau/articles"]').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Articles')
		expect(wrapper.find('.app-nav-item[aria-current="page"]').text()).toContain('Articles')
		wrapper.unmount()
	})

	it('affiche la liste, ses repères et ses vues', async () => {
		const { wrapper } = await open('/articles')
		expect(wrapper.text()).toContain('ETUI BISCUIT')
		expect(wrapper.text()).toContain('BBTB 275 g')
		expect(wrapper.text()).toContain('BAT-P Validé')
		expect(wrapper.text()).toContain('Composé')
		expect(wrapper.text()).toContain('Aucun')
		await wrapper.findAll('.bureau-toolbar button').find((button) => button.text().startsWith('Filtres'))!.trigger('click')
		expect(wrapper.findAll('select[aria-label="Afficher"] option').map((option) => option.text())).toContain('Sans BAT validé (1)')
		wrapper.unmount()
	})

	it('ouvre l’aperçu, puis la fiche', async () => {
		const { wrapper, router } = await open('/articles')
		await wrapper.find('.list-row-main').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.query.apercu).toBe('CLI-1-003')
		expect(wrapper.find('.bureau-drawer').text()).toContain('Le BAT validé ne couvre pas la maquette active')
		await wrapper.find('.bureau-drawer-head .btn-primary').trigger('click')
		await flushPromises()
		expect(router.currentRoute.value.name).toBe('Article')
		wrapper.unmount()
	})

	it('un clic hors du tiroir le ferme, pas un clic dedans ni sur une ligne', async () => {
		const { wrapper, router } = await open('/articles')
		const pointerdown = (selector: string) => document.querySelector(selector)!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
		await wrapper.find('.list-row-main').trigger('click')
		await flushPromises()

		pointerdown('.bureau-drawer-body')
		pointerdown('.list-row-main')
		await flushPromises()
		expect(router.currentRoute.value.query.apercu).toBe('CLI-1-003')

		pointerdown('.bureau-toolbar')
		await flushPromises()
		expect(router.currentRoute.value.query.apercu).toBeUndefined()
		expect(wrapper.find('.bureau-drawer').exists()).toBe(false)
		wrapper.unmount()
	})

	it('la fiche résume la prépresse et signale l’écart de BAT', async () => {
		const { wrapper } = await open('/articles/CLI-1-003')
		const main = wrapper.find('.client-main').text()
		expect(main).toContain('BAT-21 porte sur MAQ-V2')
		expect(main).toContain('8 poses · chutes 12 %')
		expect(main).toContain('12,40 DA')
		expect(wrapper.find('.client-side').text()).toContain('BISCUITERIE NUMIDIA')
		expect(wrapper.findAll('.record-tab').map((tab) => tab.text())).toEqual(['Aperçu', 'Fiche technique', 'Prépresse, une étape à faire', 'Documents1', 'Affaires4'])
		wrapper.unmount()
	})

	it('le fil reste visible hors des onglets, quel que soit l’onglet', async () => {
		for (const tab of ['', '?onglet=technique', '?onglet=affaires']) {
			const { wrapper } = await open(`/articles/CLI-1-003${tab}`)
			expect(wrapper.find('.record-activity .activity').exists()).toBe(true)
			expect(wrapper.find('.client-main .activity').exists()).toBe(false)
			wrapper.unmount()
		}
	})

	it('la prépresse dit la prochaine étape, et l’historique reste replié', async () => {
		const { wrapper } = await open('/articles/CLI-1-003?onglet=prepresse')
		expect(wrapper.find('.step-hero h3').text()).toBe('Refaire le BAT')
		expect(wrapper.findAll('.pp-step b').map((step) => step.text())).toEqual(['Tracé', 'Maquette', 'Imposition', 'BAT'])
		expect(wrapper.find('.pp-name').text()).toBe('MAQ-V3')
		expect(wrapper.find('.pp-rows').exists()).toBe(false)
		wrapper.unmount()
	})

	it('la visionneuse annonce la conséquence de l’activation, puis l’envoie', async () => {
		const older = { name: 'MAQ-V2', status: 'Obsolète', ver: 2, resume_couleurs: null, date_creation: '2026-05-02', desc_changements: 'Pantone', fichier_maquette: null }
		const prepresse = { ...detail.prepresse, maquettes: [detail.prepresse.maquettes[0], older] }
		current['bureau_articles.get_article'] = { ...detail, prepresse }
		current['bureau_articles.activate_maquette'] = detail
		const { wrapper } = await open('/articles/CLI-1-003?onglet=prepresse')
		await wrapper.find('.pp-toggle').trigger('click')
		await wrapper.find('.pp-row').trigger('click')
		const dialog = wrapper.find('.pp-dialog')
		expect(dialog.text()).toContain('MAQ-V3 passe en obsolète')
		await dialog.findAll('button').find((button) => button.text().startsWith('Activer la version'))!.trigger('click')
		await flushPromises()
		expect(posted('activate_maquette')).toEqual({ name: 'CLI-1-003', maquette: 'MAQ-V2' })
		wrapper.unmount()
	})

	it('l’onglet Documents liste les fichiers et les range sans nouvel envoi', async () => {
		current['bureau_articles.set_article_file'] = detail
		const { wrapper } = await open('/articles/CLI-1-003?onglet=documents')
		expect(wrapper.find('.upload-zone').text()).toContain('Glissez vos fichiers ici')
		expect(wrapper.find('.upload-item').text()).toContain('ft.pdf')
		expect(wrapper.find('.upload-item .tag-pill').text()).toBe('BAT')
		await wrapper.find('.upload-item .icon-btn').trigger('click')
		const items = wrapper.findAll('.upload-item .app-menu-item').map((item) => item.text())
		expect(items).toEqual(['Utiliser comme tracé de découpe', 'Télécharger', 'Retirer le fichier'])
		await wrapper.find('.upload-item .app-menu-item').trigger('click')
		await flushPromises()
		expect(posted('set_article_file')).toMatchObject({ piece: 'trace_decoupe', file_url: '/private/files/ft.pdf' })
		wrapper.unmount()
	})

	it('l’image se change depuis le visuel, et un fichier qui n’en est pas une est refusé', async () => {
		current['bureau_articles.get_article'] = { ...detail, image: '/files/v.png', own_image: true }
		const { wrapper } = await open('/articles/CLI-1-003')
		await wrapper.find('.article-visual-change').trigger('click')
		expect(wrapper.findAll('.article-visual .app-menu-item').map((item) => item.text())).toEqual(['Importer une image', 'Voir en grand', "Retirer l'image"])
		const input = wrapper.find('.article-visual input[type="file"]')
		Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'note.pdf', { type: 'application/pdf' })], configurable: true })
		await input.trigger('change')
		expect(wrapper.find('.client-side [role="alert"]').text()).toContain("n'est pas une image")
		wrapper.unmount()
	})

	it('confirme un enregistrement par un message en bas à droite, qui s’en va seul', async () => {
		const { wrapper } = await open('/articles/CLI-1-003')
		const timers = vi.spyOn(window, 'setTimeout')
		await wrapper.findAll('.client-side button').find((button) => button.text() === 'Modifier')!.trigger('click')
		await flushPromises()
		const input = wrapper.find('#article-reference')
		await input.setValue('H300')
		await wrapper.findAll('.dialog button').find((button) => button.text() === 'Enregistrer')!.trigger('click')
		await flushPromises()
		const toast = wrapper.find('.app-toast')
		expect(toast.text()).toContain('Article enregistré.')
		expect(toast.attributes('data-tone')).toBe('success')
		expect(wrapper.find('.client-main').text()).not.toContain('Article enregistré.')
		expect(timers.mock.calls.some((call) => call[1] === 4000)).toBe(true)
		timers.mockRestore()
		await toast.find('[aria-label="Fermer ce message"]').trigger('click')
		expect(wrapper.find('.app-toast').exists()).toBe(false)
		wrapper.unmount()
	})

	it('la fiche technique n’affiche que les champs du procédé', async () => {
		const { wrapper } = await open('/articles/CLI-1-003?onglet=technique')
		const main = wrapper.find('.client-main').text()
		expect(main).toContain('Papier')
		expect(main).toContain('UV')
		expect(main).not.toContain('Champ Flexo')
		// Une seule carte : le titre, puis ses champs ou ses cases cochées.
		expect(wrapper.findAll('.client-main .fiche-releve')).toHaveLength(1)
		expect(wrapper.find('.fiche-rubrique > h3').exists()).toBe(true)
		expect(wrapper.find('.fiche-champs dt').text()).toBeTruthy()
		expect(wrapper.find('.fiche-coches').text()).toContain('UV')
		wrapper.unmount()
	})

	it('un article composé gagne l’onglet Sous-articles', async () => {
		current['bureau_articles.get_article'] = { ...detail, compose: 1, sous_articles: [{ name: 'CLI-1-003-1', designation: 'CALE', quantite: 2, support: null, format: null, bat: null }] }
		const { wrapper } = await open('/articles/CLI-1-003?onglet=sous-articles')
		expect(wrapper.find('.client-main').text()).toContain('CALE')
		expect(wrapper.findAll('.record-tab').map((tab) => tab.text())).toContain('Sous-articles1')
		wrapper.unmount()
	})

	it('un article général garde Modifier comme action principale, sans prépresse', async () => {
		current['bureau_articles.get_article'] = { ...detail, type: 'Général', client: null, client_label: null, procede: null, ecart_bat: null, fiche: {} }
		const { wrapper } = await open('/articles/CLI-1-003')
		expect(wrapper.find('.client-side .btn-primary').text()).toBe('Modifier')
		expect(wrapper.findAll('.record-tab').map((tab) => tab.text())).toEqual(['Aperçu', 'Documents1', 'Affaires4'])
		wrapper.unmount()
	})

	it('Modifier n’envoie que les champs changés', async () => {
		const { wrapper } = await open('/articles/CLI-1-003')
		await wrapper.findAll('.client-side button').find((button) => button.text() === 'Modifier')!.trigger('click')
		await flushPromises()
		await flushPromises()
		await wrapper.find('#article-reference').setValue('H300')
		await wrapper.find('#fiche-custom_support').setValue('Bristol')
		await wrapper.findAll('.dialog button').find((button) => button.text() === 'Enregistrer')!.trigger('click')
		await flushPromises()
		const body = posted('bureau_articles.update_article')
		expect(body.values).toEqual({ reference: 'H300', fiche: { custom_support: 'Bristol' } })
		expect(body.modified).toBe(detail.modified)
		expect(wrapper.find('.app-toast').text()).toContain('Article enregistré.')
		wrapper.unmount()
	})

	const openDialog = async (wrapper: ReturnType<typeof mount>) => {
		await wrapper.findAll('.bureau-toolbar button').find((button) => button.text() === 'Nouvel article')!.trigger('click')
		await flushPromises()
		await flushPromises()
	}
	const dialogButton = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('.dialog button').find((button) => button.text() === label)!
	const fillBase = async (wrapper: ReturnType<typeof mount>) => {
		await wrapper.find('#article-designation').setValue('Etui chocolat')
		await wrapper.find('#article-client').trigger('focus')
		await flushPromises()
		await wrapper.find('.picker-menu .app-menu-item').trigger('click')
		await wrapper.findAll('.dialog .seg button').find((button) => button.text() === 'Offset')!.trigger('click')
		await flushPromises()
	}

	it('Nouvel article passe par les deux phases, puis crée avec les seuls champs du procédé', async () => {
		const { wrapper } = await open('/articles')
		await openDialog(wrapper)
		await dialogButton(wrapper, 'Continuer').trigger('click')
		await flushPromises()
		expect(wrapper.find('.dialog').text()).toContain('Saisissez la désignation.')
		expect(wrapper.find('.dialog').text()).toContain('Choisissez le client.')
		expect(wrapper.find('.dialog').text()).toContain('Choisissez le procédé.')
		await fillBase(wrapper)
		await dialogButton(wrapper, 'Continuer').trigger('click')
		await flushPromises()
		expect(wrapper.find('.phase-step[aria-current="step"]').text()).toContain('Fiche technique Offset')
		expect(wrapper.find('.phase-recap').text()).toContain('ETUI CHOCOLAT')
		expect(wrapper.find('.dialog').text()).toContain('Papier')
		expect(wrapper.find('.dialog').text()).not.toContain('Champ Flexo')
		await wrapper.find('#fiche-custom_support').setValue('BBTB')
		await dialogButton(wrapper, "Créer l'article").trigger('click')
		await flushPromises()
		expect(posted('bureau_articles.create_article').values).toMatchObject({ type: 'Client', designation: 'Etui chocolat', client: 'CLI-1', procede: 'Offset', groupe: 'Produits', fiche: { custom_support: 'BBTB' } })
		expect(wrapper.text()).toContain('Article créé.')
		expect(Object.keys(localStorage).filter((key) => key.startsWith('bureau-article-brouillon'))).toEqual([])
		wrapper.unmount()
	})

	it('refuse dès Continuer une désignation déjà prise par le client', async () => {
		current['check_article_designation'] = { message: 'Le client a déjà un article « ETUI CHOCOLAT ».' }
		const { wrapper } = await open('/articles')
		await openDialog(wrapper)
		await fillBase(wrapper)
		await dialogButton(wrapper, 'Continuer').trigger('click')
		await flushPromises()
		expect(wrapper.find('.field-error').text()).toContain('a déjà un article')
		expect(wrapper.find('.phase-step[aria-current="step"]').text()).toContain('Informations de base')
		delete current['check_article_designation']
		wrapper.unmount()
	})

	it('garde la saisie en brouillon après une fermeture, puis la reprend ou l efface', async () => {
		const { wrapper } = await open('/articles')
		await openDialog(wrapper)
		await fillBase(wrapper)
		await dialogButton(wrapper, 'Continuer').trigger('click')
		await flushPromises()
		await wrapper.find('#fiche-custom_support').setValue('BBTB')
		await dialogButton(wrapper, 'Annuler').trigger('click')
		expect(wrapper.find('.dialog-foot').text()).toContain('Votre saisie reste en brouillon.')
		await dialogButton(wrapper, 'Fermer').trigger('click')
		await flushPromises()
		expect(wrapper.find('.dialog').exists()).toBe(false)

		await openDialog(wrapper)
		expect(wrapper.find('.draft-note').text()).toContain('Brouillon repris')
		expect((wrapper.find('#fiche-custom_support').element as HTMLSelectElement).value).toBe('BBTB')
		expect(wrapper.find('.phase-recap').text()).toContain('BISCUITERIE NUMIDIA')
		await dialogButton(wrapper, 'Repartir de zéro').trigger('click')
		await dialogButton(wrapper, 'Effacer').trigger('click')
		await flushPromises()
		expect((wrapper.find('#article-designation').element as HTMLInputElement).value).toBe('')
		expect(Object.keys(localStorage).filter((key) => key.startsWith('bureau-article-brouillon'))).toEqual([])
		wrapper.unmount()
	})

	it('sans réseau à la création, ne perd rien et le dit', async () => {
		const { wrapper } = await open('/articles')
		await openDialog(wrapper)
		await fillBase(wrapper)
		await dialogButton(wrapper, 'Continuer').trigger('click')
		await flushPromises()
		fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
		await dialogButton(wrapper, "Créer l'article").trigger('click')
		await flushPromises()
		expect(wrapper.find('.phase-alert').text()).toContain('reste en brouillon')
		expect(Object.keys(localStorage).some((key) => key.startsWith('bureau-article-brouillon'))).toBe(true)
		await dialogButton(wrapper, "Créer l'article").trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Article créé.')
		wrapper.unmount()
	})
})
