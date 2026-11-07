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

const row = (name: string, kind: string, label: string, extra = {}) => ({
	name,
	modified: '2026-11-04 10:00:00.000000',
	request_type: 'Bon de commande',
	client: 'Client Un',
	commercial: 'Commercial A',
	status: 'Nouveau',
	urgence: 'U0',
	assigne_a: null,
	assigne_a_nom: null,
	mine: false,
	echeance: null,
	is_late: false,
	idle_days: 12,
	action: { kind, label, action: kind === 'run' ? 'Démarrer' : undefined },
	...extra,
})

const accueil = (overrides = {}) => ({
	stale_days: 7,
	stages: [
		{ key: 'tickets', label: 'Tickets', to: 'Tickets', href: null, third_party: false, late: 0, parts: [{ status: 'Nouveau', count: 4 }, { status: 'En Cours', count: 13 }], total: 17, stale: 5 },
		{ key: 'etudes', label: 'Études', to: null, href: '/app/etude-faisabilite', third_party: true, late: 0, parts: [{ status: 'En étude', count: 3 }], total: 3, stale: 3 },
	],
	trends: {
		months: [{ month: '2026-10', received: 2, closed: 1 }, { month: '2026-11', received: 3, closed: 0 }],
		ages: [{ label: '0–7 j', count: 1 }],
		completeness: { clients: { filled: 10, expected: 100, percent: 10 }, articles: null },
	},
	queue: [
		{ key: 'decide', total: 0, rows: [] },
		{ key: 'take', total: 2, rows: [row('TC-1', 'run', 'Démarrer'), row('TC-2', 'open', 'Ouvrir')] },
		{ key: 'transform', total: 0, rows: [] },
	],
	updates: { total: 1, rows: [{ name: 'TC-9', client: 'Client Neuf', status: 'En Cours', idle_days: 3 }] },
	clients: { total: 20, rows: [{ key: 'gps', label: 'Sans position GPS', count: 14, total: 20, conditions: [{ doctype: 'Customer', field: 'custom_gps', op: 'is', value: 'not set' }] }] },
	articles: { total: 5, rows: [{ key: 'maquette', label: 'Sans maquette activée', count: 2, total: 5, view: 'sans_maquette' }] },
	documents: [{ key: 'reclamations', label: 'Réclamations en retard', count: 10, href: '/app/reclamations-clients?status=En+retard' }],
	max_rows: 10,
	...overrides,
})

describe('accueil du poste', () => {
	let calls: { method: string; body: Record<string, unknown> }[]
	let current: ReturnType<typeof accueil>

	beforeEach(() => {
		calls = []
		current = accueil()
		window.user = 'moi@aures.dz'
		window.can_access = true
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init?: RequestInit) => {
				const method = url.split('/api/method/')[1]?.split('?')[0] ?? ''
				const query = Object.fromEntries(new URL(url, 'http://local').searchParams)
				calls.push({ method, body: init?.body ? JSON.parse(init.body as string) : query })
				const message = method.endsWith('get_accueil') ? current : method.endsWith('get_references') ? { assignees: [] } : method.endsWith('get_queue') ? { tickets: [], counts: { todo: 2 }, total: 0, start: 0, page_length: 1, names: [] } : {}
				return new Response(JSON.stringify({ message }), { status: 200, headers: { 'Content-Type': 'application/json' } })
			}),
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		localStorage.clear()
	})

	async function open(path = '/') {
		const router = createRouter({ history: createMemoryHistory(), routes })
		await router.push(path)
		await router.isReady()
		const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
		await flushPromises()
		return { wrapper, router }
	}

	it('sert la racine et garde la liste des tickets sous /tickets', async () => {
		const { wrapper, router } = await open('/')
		expect(wrapper.find('.accueil').exists()).toBe(true)
		expect(router.currentRoute.value.name).toBe('Home')
		wrapper.unmount()
	})

	it('renvoie un ancien lien de la liste vers /tickets, sa vue comprise', async () => {
		const { wrapper, router } = await open('/?vue=mine')
		expect(router.currentRoute.value.path).toBe('/tickets')
		expect(router.currentRoute.value.query.vue).toBe('mine')
		wrapper.unmount()
	})

	it('affiche une barre par étape avec son total, sans légende', async () => {
		const { wrapper } = await open()
		const stages = wrapper.findAll('.accueil-stage')
		expect(stages).toHaveLength(2)
		expect(stages[0].find('.accueil-stage-total').text()).toBe('17')
		expect(stages[0].findAll('.accueil-strip-part')).toHaveLength(2)
		expect(stages[0].findAll('.badge')).toHaveLength(0)
		expect(stages[0].text()).toContain('5 sans mouvement depuis 7 j')
		expect(stages[1].text()).toContain('Chez un tiers')
		wrapper.unmount()
	})

	it('donne le nombre et le statut au survol, puis revient au total', async () => {
		const { wrapper } = await open()
		const stage = wrapper.findAll('.accueil-stage')[0]
		await stage.findAll('.accueil-strip-part')[1].trigger('mouseenter')
		expect(stage.find('.accueil-stage-total').text()).toBe('13')
		expect(stage.find('.badge').text()).toBe('En Cours')
		expect(stage.find('.badge').classes()).toContain('tone-orange')
		expect(stage.text()).not.toContain('sans mouvement')
		await stage.findAll('.accueil-strip-part')[1].trigger('mouseleave')
		expect(stage.find('.accueil-stage-total').text()).toBe('17')
		wrapper.unmount()
	})

	it('met un retard en rouge, sauf pendant le survol', async () => {
		current = accueil({ stages: [{ key: 'devis', label: 'Devis', to: null, href: '/app/quotation', third_party: false, late: 2, parts: [{ status: 'Draft', count: 4 }], total: 4, stale: 4 }] })
		const { wrapper } = await open()
		expect(wrapper.find('.accueil-stage-foot').classes()).toContain('is-late')
		await wrapper.find('.accueil-strip-part').trigger('mouseenter')
		expect(wrapper.find('.accueil-stage-foot').classes()).not.toContain('is-late')
		wrapper.unmount()
	})

	it('garde les tendances sous la file', async () => {
		const { wrapper } = await open()
		const order = [...wrapper.find('.accueil').element.children].map((element) => element.className)
		expect(order.findIndex((name) => name.includes('accueil-columns-main'))).toBeLessThan(order.findIndex((name) => name.includes('accueil-trends')))
		wrapper.unmount()
	})

	it("ne met une pastille d'urgence qu'à partir de U1, et montre qui a le ticket", async () => {
		current = accueil({ queue: [{ key: 'take', total: 2, rows: [row('TC-1', 'run', 'Démarrer', { assigne_a: 'a@b', assigne_a_nom: 'Amine Melizi' }), row('TC-2', 'run', 'Démarrer', { urgence: 'U2' })] }] })
		const { wrapper } = await open()
		const rows = wrapper.findAll('.accueil-row')
		expect(rows[0].find('.urgence').exists()).toBe(false)
		expect(rows[0].find('.accueil-urgence-quiet').text()).toBe('U0')
		expect(rows[0].find('.accueil-row-who').text()).toContain('Amine Melizi')
		expect(rows[1].find('.urgence-U2').exists()).toBe(true)
		expect(rows[1].find('.accueil-row-who').text()).toContain('Non attribué')
		wrapper.unmount()
	})

	it('compte les lignes de chaque groupe', async () => {
		const { wrapper } = await open()
		expect(wrapper.find('.accueil-group-count').text()).toBe('2')
		wrapper.unmount()
	})

	it('recharge la file pour la personne connectée', async () => {
		const { wrapper } = await open()
		await wrapper.findAll('.accueil-scope button')[1].trigger('click')
		await flushPromises()
		const last = calls.filter((call) => call.method.endsWith('get_accueil')).at(-1)
		expect(last?.body.scope).toBe('mine')
		wrapper.unmount()
	})

	it('démarre un ticket depuis sa ligne, avec la date affichée, puis recharge', async () => {
		const { wrapper } = await open()
		const before = calls.filter((call) => call.method.endsWith('get_accueil')).length
		await wrapper.findAll('.accueil-row-action button')[0].trigger('click')
		await flushPromises()
		const run = calls.find((call) => call.method.endsWith('run_action'))
		expect(run?.body).toMatchObject({ name: 'TC-1', action: 'Démarrer', modified: '2026-11-04 10:00:00.000000' })
		expect(calls.filter((call) => call.method.endsWith('get_accueil')).length).toBe(before + 1)
		wrapper.unmount()
	})

	it('ouvre la fiche quand le serveur ne permet aucune action directe', async () => {
		const { wrapper, router } = await open()
		// La fiche elle-même n'est pas chargée : seul le chemin compte ici.
		const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)
		await wrapper.findAll('.accueil-row-action button')[1].trigger('click')
		expect(push).toHaveBeenCalledWith({ name: 'Ticket', params: { id: 'TC-2' } })
		wrapper.unmount()
	})

	it('ouvre la fiche pour décider, avec un vrai bouton et non le bouton discret', async () => {
		current = accueil({ queue: [{ key: 'decide', total: 1, rows: [row('TC-3', 'decide', 'Décider la créance')] }] })
		const { wrapper, router } = await open()
		const button = wrapper.find('.accueil-row-action button')
		expect(button.classes()).toContain('btn-secondary')
		const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)
		await button.trigger('click')
		expect(push).toHaveBeenCalledWith({ name: 'Ticket', params: { id: 'TC-3' } })
		wrapper.unmount()
	})

	it('relie au bouton discret la raison qui empêche une action directe', async () => {
		current = accueil({ queue: [{ key: 'transform', total: 1, rows: [row('TC-4', 'open', 'Ouvrir', { action: { kind: 'open', label: 'Ouvrir', reason: 'Renseignez le site.' } })] }] })
		const { wrapper } = await open()
		const button = wrapper.find('.accueil-action-quiet')
		const tip = wrapper.find('.accueil-tip')
		expect(tip.text()).toBe('Renseignez le site.')
		expect(button.attributes('aria-describedby')).toBe(tip.attributes('id'))
		expect(button.attributes('title')).toBeUndefined()
		wrapper.unmount()
	})

	it('mène chaque manque à la liste déjà filtrée', async () => {
		const { wrapper } = await open()
		const links = wrapper.findAll('.accueil-data a').map((link) => link.attributes('href'))
		expect(links.some((href) => href?.includes('/clients?filtres='))).toBe(true)
		expect(links.some((href) => href?.includes('/articles?vue=sans_maquette'))).toBe(true)
		expect(links).toContain('/app/reclamations-clients?status=En+retard')
		wrapper.unmount()
	})

	it('retient que les tendances sont masquées', async () => {
		const { wrapper } = await open()
		expect(wrapper.find('.accueil-charts').exists()).toBe(true)
		await wrapper.findAll('.accueil-trends-head button').at(-1)!.trigger('click')
		expect(wrapper.find('.accueil-charts').exists()).toBe(false)
		wrapper.unmount()
		const again = await open()
		expect(again.wrapper.find('.accueil-charts').exists()).toBe(false)
		again.wrapper.unmount()
	})

	it('dit quand aucune requête n\'attend', async () => {
		current = accueil({ queue: [{ key: 'decide', total: 0, rows: [] }] })
		const { wrapper } = await open()
		expect(wrapper.text()).toContain("Aucune requête n'attend d'action ici.")
		wrapper.unmount()
	})
})
