import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { setPoste } from '@/lib/postes'
import { routes } from '@/router'

async function open(path: string) {
	const router = createRouter({ history: createMemoryHistory(), routes })
	await router.push(path)
	await router.isReady()
	const wrapper = mount(App, { global: { plugins: [router] }, attachTo: document.body })
	await flushPromises()
	return { wrapper, router }
}

beforeEach(() => {
	window.user = 'etude@example.com'
	window.can_access = true
	vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ message: {} }), { status: String(url).includes('accueil') ? 500 : 200, headers: { 'Content-Type': 'application/json' } })))
})

afterEach(() => {
	document.body.innerHTML = ''
	delete window.postes
	delete window.droits
	window.user = null
	window.can_access = false
	setPoste('')
	localStorage.clear()
	vi.unstubAllGlobals()
})

describe('garde des pages et choix du poste', () => {
	it('dit qu\'une page n\'est pas accessible et garde son adresse', async () => {
		window.droits = { Customer: { read: false, create: false } }
		const { wrapper, router } = await open('/clients/CLI-000001')
		expect(wrapper.text()).toContain("Cette page n'est pas accessible")
		expect(router.currentRoute.value.fullPath).toBe('/clients/CLI-000001')
		expect(wrapper.find('nav[aria-label="Navigation principale"]').text()).not.toContain('Clients')
		wrapper.unmount()
	})

	it('affiche un libellé simple avec un seul poste', async () => {
		window.postes = [{ key: 'back_office', label: 'Back office' }]
		window.droits = { Customer: { read: false, create: false } }
		const { wrapper } = await open('/clients')
		expect(wrapper.find('.app-poste').text()).toBe('Back office')
		expect(wrapper.find('[aria-label="Changer de poste"]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('change de menu avec le poste, sans accorder de droit', async () => {
		window.postes = [
			{ key: 'back_office', label: 'Back office' },
			{ key: 'etude', label: 'Étude' },
		]
		window.droits = { Customer: { read: false, create: false }, 'Etude Faisabilite Flexo': { read: false, create: false } }
		const { wrapper } = await open('/clients')
		const nav = () => wrapper.find('nav[aria-label="Navigation principale"]').text()
		expect(nav()).toContain('Tickets')
		await wrapper.find('[aria-label="Changer de poste"]').trigger('click')
		const etude = wrapper.findAll('[role="menuitemradio"]').find((item) => item.text() === 'Étude')
		await etude!.trigger('click')
		await flushPromises()
		expect(nav()).toContain('Études Offset')
		expect(nav()).not.toContain('Études Flexo')
		expect(nav()).not.toContain('Tickets')
		expect(localStorage.getItem('bureau-poste')).toBe('etude')
		wrapper.unmount()
	})
})
