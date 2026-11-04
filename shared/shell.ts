/** Coquille des applications Aures : entrées du menu de gauche et mémoire de son repli. */
import { ref, watch, type Component } from 'vue'

export interface NavItem {
	id: string
	label: string
	icon: Component
	/** Page de l'application (route vue-router). */
	to?: unknown
	/** Page hors de l'application, ouverte dans une nouvelle fenêtre. */
	href?: string
	count?: number | null
	/** Compteur en rouge : réservé à un blocage ou à une décision en attente. */
	alert?: boolean
	active?: boolean
}

export interface NavGroup {
	title: string
	items: NavItem[]
}

export interface Crumb {
	label: string
	to?: unknown
}

/** Sous cette largeur, le menu démarre replié : la liste a besoin de la place. */
export const SIDEBAR_OPEN_MIN_WIDTH = 1440

/** Le choix de l'utilisateur prime et reste sur cet appareil ; sans choix, la largeur de l'écran décide. */
export function useSidebarCollapse(storageKey: string) {
	function initial() {
		try {
			const saved = localStorage.getItem(storageKey)
			if (saved === 'open') return false
			if (saved === 'rail') return true
		} catch {
			// Stockage indisponible : la largeur décide.
		}
		return typeof window !== 'undefined' && window.innerWidth < SIDEBAR_OPEN_MIN_WIDTH
	}
	const collapsed = ref(initial())
	function toggle() {
		collapsed.value = !collapsed.value
	}
	watch(collapsed, (value) => {
		try {
			localStorage.setItem(storageKey, value ? 'rail' : 'open')
		} catch {
			// Stockage indisponible : le choix vaut pour cette session.
		}
	})
	return { collapsed, toggle }
}
