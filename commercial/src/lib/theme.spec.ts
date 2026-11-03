import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le module garde l'état du thème : un import neuf par test, avec le réglage du téléphone simulé.
async function loadTheme(systemDark: boolean) {
	vi.resetModules()
	const listeners: ((event: { matches: boolean }) => void)[] = []
	vi.stubGlobal('matchMedia', (query: string) => ({
		matches: query.includes('dark') && systemDark,
		addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.push(listener),
	}))
	const module = await import('./theme')
	return { ...module, changeSystem: (matches: boolean) => listeners.forEach((listener) => listener({ matches })) }
}

describe("thème de l'application", () => {
	beforeEach(() => {
		localStorage.clear()
		document.documentElement.removeAttribute('data-theme')
	})

	it('suit le réglage du téléphone par défaut', async () => {
		const { useAppTheme, changeSystem } = await loadTheme(true)
		const theme = useAppTheme()
		expect(theme.preference.value).toBe('system')
		expect(document.documentElement.dataset.theme).toBe('dark')
		changeSystem(false)
		expect(document.documentElement.dataset.theme).toBe('light')
	})

	it('garde un choix forcé sous sa propre clé, sans toucher celle des portails', async () => {
		localStorage.setItem('theme', 'light')
		const { useAppTheme, THEME_KEY, changeSystem } = await loadTheme(false)
		const theme = useAppTheme()
		theme.setPreference('dark')
		expect(localStorage.getItem(THEME_KEY)).toBe('dark')
		expect(localStorage.getItem('theme')).toBe('light')
		changeSystem(false)
		expect(document.documentElement.dataset.theme).toBe('dark')
		expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0f0f0f')
		theme.setPreference('system')
		expect(localStorage.getItem(THEME_KEY)).toBeNull()
		expect(document.documentElement.dataset.theme).toBe('light')
	})

	it('relit le choix gardé au démarrage', async () => {
		localStorage.setItem('commercial-theme', 'light')
		const { useAppTheme } = await loadTheme(true)
		expect(useAppTheme().resolved.value).toBe('light')
		expect(document.documentElement.dataset.theme).toBe('light')
	})
})
