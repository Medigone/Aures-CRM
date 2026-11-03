/**
 * Thème de la PWA commerciale : celui du téléphone par défaut, ou forcé (clair / sombre) sur cet appareil.
 *
 * Clé propre `commercial-theme` : `localStorage.theme` (frappe-ui `useTheme`) est partagée avec les
 * portails organisation et praticien, servis sur la même origine, qui restent en clair.
 */
import { computed, ref } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_KEY = 'commercial-theme'
const THEME_COLORS = { light: '#ffffff', dark: '#0f0f0f' } as const

function readPreference(): ThemePreference {
	try {
		const saved = localStorage.getItem(THEME_KEY)
		return saved === 'light' || saved === 'dark' ? saved : 'system'
	} catch {
		return 'system'
	}
}

const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
const preference = ref<ThemePreference>(readPreference())
const systemDark = ref(Boolean(media?.matches))
const resolved = computed<'light' | 'dark'>(() => (preference.value === 'system' ? (systemDark.value ? 'dark' : 'light') : preference.value))

function apply() {
	const root = document.documentElement
	root.dataset.theme = resolved.value
	// Barre d'état du téléphone accordée au fond de l'application.
	let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')
	if (!meta) {
		meta = document.createElement('meta')
		meta.name = 'theme-color'
		document.head.appendChild(meta)
	}
	meta.content = THEME_COLORS[resolved.value]
}

let started = false

/** À appeler une fois au démarrage : applique le thème et suit le réglage du téléphone. */
export function useAppTheme() {
	if (!started) {
		started = true
		apply()
		media?.addEventListener('change', (event) => {
			systemDark.value = event.matches
			apply()
		})
	}

	function setPreference(value: ThemePreference) {
		preference.value = value
		try {
			if (value === 'system') localStorage.removeItem(THEME_KEY)
			else localStorage.setItem(THEME_KEY, value)
		} catch {
			// Stockage indisponible : le choix vaut pour cette session.
		}
		apply()
	}

	return { preference, resolved, setPreference }
}
