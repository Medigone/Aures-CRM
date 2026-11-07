/** Postes du bureau : le menu de chacun et le poste actif, retenu par navigateur. Un poste n'accorde aucun droit. */
import { ref, type Component } from 'vue'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideClipboardCheck from '~icons/lucide/clipboard-check'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import LucideFileText from '~icons/lucide/file-text'
import LucidePrinter from '~icons/lucide/printer'
import LucideGrid from '~icons/lucide/layout-grid'
import LucideLayoutDashboard from '~icons/lucide/layout-dashboard'
import LucidePackage from '~icons/lucide/package'
import LucidePenTool from '~icons/lucide/pen-tool'
import LucideScissors from '~icons/lucide/scissors'
import LucideShoppingCart from '~icons/lucide/shopping-cart'
import LucideTicket from '~icons/lucide/ticket'
import LucideWallet from '~icons/lucide/wallet'
import { canRead } from './droits'

export interface Poste {
	key: string
	label: string
}

export interface PosteNavItem {
	id: string
	label: string
	icon: Component
	to?: { name: string }
	href?: string
	/** Sans droit de lecture sur ce document (ou aucun de ceux-ci), l'entrée n'apparaît pas. */
	doctype?: string | string[]
}

export interface PosteNavGroup {
	title: string
	items: PosteNavItem[]
}

const ETUDE_DOCTYPES = ['Etude Faisabilite', 'Etude Faisabilite Flexo']
const BACK_OFFICE: Poste = { key: 'back_office', label: 'Back office' }
const STORAGE_KEY = 'bureau-poste'

const REFERENTIEL: PosteNavGroup = {
	title: 'Référentiel',
	items: [
		{ id: 'clients', label: 'Clients', icon: LucideBuilding2, to: { name: 'Clients' }, doctype: 'Customer' },
		{ id: 'articles', label: 'Articles', icon: LucidePackage, to: { name: 'Articles' }, doctype: 'Item' },
	],
}

// Les écrans pas encore repris dans le poste de bureau s'ouvrent sur le Desk.
const NAV: Record<string, PosteNavGroup[]> = {
	back_office: [
		{
			title: 'Mon travail',
			items: [
				{ id: 'accueil', label: 'Accueil', icon: LucideLayoutDashboard, to: { name: 'Home' } },
				{ id: 'tickets', label: 'Tickets', icon: LucideTicket, to: { name: 'Tickets' }, doctype: 'Ticket Commercial' },
				{ id: 'demandes', label: 'Demandes', icon: LucideClipboardList, to: { name: 'Demandes' }, doctype: 'Demande Faisabilite' },
				{ id: 'etudes', label: 'Études', icon: LucideClipboardCheck, to: { name: 'Etudes' }, doctype: ETUDE_DOCTYPES },
				{ id: 'devis', label: 'Devis', icon: LucideFileText, href: '/app/quotation', doctype: 'Quotation' },
				{ id: 'commandes', label: 'Commandes', icon: LucideShoppingCart, href: '/app/sales-order', doctype: 'Sales Order' },
				{ id: 'creances', label: 'Créances', icon: LucideWallet, href: '/app/suivi-creance', doctype: 'Suivi Creance' },
			],
		},
		REFERENTIEL,
	],
	etude: [
		{
			title: 'Mon travail',
			items: [
				{ id: 'accueil', label: 'Accueil', icon: LucideLayoutDashboard, to: { name: 'Home' } },
				{ id: 'etudes', label: 'Études', icon: LucideClipboardCheck, to: { name: 'Etudes' }, doctype: ETUDE_DOCTYPES },
				{ id: 'atelier', label: 'Atelier', icon: LucideScissors, to: { name: 'Atelier' }, doctype: 'Calcul Imposition' },
				{ id: 'traces', label: 'Tracés', icon: LucidePenTool, href: '/app/trace', doctype: 'Trace' },
				{ id: 'impositions', label: 'Impositions', icon: LucideGrid, href: '/app/imposition', doctype: 'Imposition' },
				{ id: 'machines', label: 'Machines', icon: LucidePrinter, href: '/app/machine', doctype: 'Machine' },
			],
		},
		{
			title: 'Consultation',
			items: [{ id: 'demandes', label: 'Demandes', icon: LucideClipboardList, to: { name: 'Demandes' }, doctype: 'Demande Faisabilite' }],
		},
		REFERENTIEL,
	],
}

function readStored() {
	try {
		return localStorage.getItem(STORAGE_KEY)
	} catch {
		return null
	}
}

const storedKey = ref(readStored())

/** Sans liste du serveur, le bureau garde son poste historique. */
export function availablePostes(): Poste[] {
	return window.postes?.length ? window.postes : [BACK_OFFICE]
}

/** Un choix retenu qui n'appartient plus à ce compte est ignoré. */
export function activePoste(): Poste {
	const postes = availablePostes()
	return postes.find((poste) => poste.key === storedKey.value) ?? postes[0]
}

export function setPoste(key: string) {
	storedKey.value = key
	try {
		localStorage.setItem(STORAGE_KEY, key)
	} catch {
		// Stockage indisponible : le choix vaut pour cette session.
	}
}

/** Menu d'un poste, sans les entrées que le rôle ne peut pas lire ni les groupes restés vides. */
export function navFor(key: string): PosteNavGroup[] {
	return (NAV[key] ?? [])
		.map((group) => ({ ...group, items: group.items.filter((item) => canRead(item.doctype)) }))
		.filter((group) => group.items.length)
}
