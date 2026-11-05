import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { redirectToLogin, safeRedirect } from '@/lib/api'
import { routes } from '@/router'

function reply(status: number, body: unknown = {}) {
	return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

async function openLogin(path = '/connexion') {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] } })
	await flushPromises()
	return wrapper
}

const replace = vi.fn()
const fetchMock = vi.fn()

beforeEach(() => {
	window.user = null
	window.can_access = false
	fetchMock.mockReset()
	replace.mockReset()
	vi.stubGlobal('fetch', fetchMock)
	vi.spyOn(window.location, 'replace').mockImplementation(replace)
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('safeRedirect', () => {
	it('garde une page du poste', () => {
		expect(safeRedirect('/bureau/clients?page=2')).toBe('/bureau/clients?page=2')
	})

	it('refuse un autre site ou une autre partie du site', () => {
		for (const target of ['https://exemple.com/bureau', '//exemple.com', '/app/customer', '/bureaux', null]) {
			expect(safeRedirect(target)).toBe('/bureau')
		}
	})

	it('ne renvoie jamais vers la connexion', () => {
		expect(safeRedirect('/bureau/connexion?redirect-to=/bureau')).toBe('/bureau')
	})
})

describe('page de connexion', () => {
	it("s'affiche pour un visiteur sans session, sans le refus d'accès", async () => {
		const wrapper = await openLogin()
		expect(wrapper.find('h1').text()).toBe('Bonjour,')
		expect(wrapper.text()).not.toContain('Accès non autorisé')
	})

	it("demande les deux champs sans appeler le serveur", async () => {
		const wrapper = await openLogin()
		await wrapper.find('form').trigger('submit')
		expect(wrapper.find('[role="alert"]').text()).toBe('Saisissez votre email et votre mot de passe.')
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('connecte puis revient à la page demandée', async () => {
		fetchMock.mockResolvedValue(reply(200, { message: 'Logged In' }))
		const wrapper = await openLogin('/connexion?redirect-to=/bureau/clients')
		await wrapper.find('#login-usr').setValue(' bo@example.com ')
		await wrapper.find('#login-pwd').setValue('secret')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		const [url, options] = fetchMock.mock.calls[0]
		expect(url).toBe('/api/method/login')
		expect(JSON.parse(options.body)).toEqual({ usr: 'bo@example.com', pwd: 'secret' })
		expect(replace).toHaveBeenCalledWith('/bureau/clients')
	})

	it('dit quand les identifiants sont refusés, puis efface le message à la saisie', async () => {
		fetchMock.mockResolvedValue(reply(401))
		const wrapper = await openLogin()
		await wrapper.find('#login-usr').setValue('bo@example.com')
		await wrapper.find('#login-pwd').setValue('faux')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(wrapper.find('[role="alert"]').text()).toBe('Email ou mot de passe incorrect.')
		expect(wrapper.find('#login-pwd').attributes('aria-invalid')).toBe('true')
		expect(replace).not.toHaveBeenCalled()
		await wrapper.find('#login-pwd').setValue('autre')
		expect(wrapper.find('[role="alert"]').exists()).toBe(false)
	})

	it('affiche et masque le mot de passe', async () => {
		const wrapper = await openLogin()
		expect(wrapper.find('#login-pwd').attributes('type')).toBe('password')
		await wrapper.find('[aria-label="Afficher le mot de passe"]').trigger('click')
		expect(wrapper.find('#login-pwd').attributes('type')).toBe('text')
	})

	it("envoie le lien de mot de passe oublié avec l'email déjà saisi", async () => {
		fetchMock.mockResolvedValue(reply(200))
		const wrapper = await openLogin()
		await wrapper.find('#login-usr').setValue('bo@example.com')
		await wrapper.findAll('button').find((button) => button.text() === 'Oublié ?')!.trigger('click')
		expect(wrapper.find('h1').text()).toBe('Mot de passe oublié')
		expect((wrapper.find('#reset-usr').element as HTMLInputElement).value).toBe('bo@example.com')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(fetchMock.mock.calls[0][0]).toBe('/api/method/frappe.core.doctype.user.user.reset_password')
		expect(wrapper.find('[role="status"]').text()).toContain('Si un compte existe pour bo@example.com')
	})
})

describe('session expirée', () => {
	const assign = vi.fn()

	beforeEach(() => {
		window.user = 'bo@example.com'
		window.can_access = true
		assign.mockReset()
		vi.spyOn(window.location, 'assign').mockImplementation(assign)
		window.history.replaceState({}, '', '/bureau/clients?page=2')
		document.cookie = 'user_id=bo@example.com'
	})

	const expired = () => reply(403, { session_expired: 1 })

	it('renvoie vers la connexion, avec la page en cours', async () => {
		fetchMock.mockImplementation(async () => expired())
		await openLogin('/clients')
		await flushPromises()
		expect(assign).toHaveBeenCalledWith('/bureau/connexion?redirect-to=%2Fbureau%2Fclients%3Fpage%3D2')
	})

	it("reconnaît aussi l'expiration déjà signalée à un autre onglet, au cookie retiré", async () => {
		document.cookie = 'user_id=Guest'
		fetchMock.mockImplementation(async () => reply(403))
		await openLogin('/clients')
		await flushPromises()
		expect(assign).toHaveBeenCalledWith('/bureau/connexion?redirect-to=%2Fbureau%2Fclients%3Fpage%3D2')
	})

	it("sans page à retrouver, renvoie vers la connexion seule", () => {
		window.history.replaceState({}, '', '/bureau')
		redirectToLogin()
		expect(assign).toHaveBeenCalledWith('/bureau/connexion')
	})

	it('ne bouge pas sur un simple refus de droit, session valide', async () => {
		fetchMock.mockImplementation(async () => reply(403))
		await openLogin('/clients')
		await flushPromises()
		expect(assign).not.toHaveBeenCalled()
	})
})

describe("compte connecté sans accès", () => {
	beforeEach(() => {
		window.user = 'commercial@example.com'
	})

	it('nomme le compte et propose de changer de compte', async () => {
		const wrapper = await openLogin('/')
		expect(wrapper.find('h1').text()).toBe('Accès non autorisé')
		expect(wrapper.text()).toContain('commercial@example.com')
		expect(wrapper.find('a[href="/app"]').text()).toBe('Retour au Desk')
	})

	it('déconnecte pour changer de compte', async () => {
		fetchMock.mockResolvedValue(reply(200))
		const wrapper = await openLogin('/')
		await wrapper.find('button.btn-primary').trigger('click')
		await flushPromises()
		expect(fetchMock.mock.calls[0][0]).toBe('/api/method/logout')
	})
})
