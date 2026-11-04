/** Page Suivi : onglets, filtres, tri et contenu des cartes (tickets, devis, commandes, réclamations). */
import type { Commande, Devis, Reclamation, Ticket } from '@/types'
import { commandeEnCours, devisOuvert, fabricationProgress, reclamationOuverte, ticketAlerte, ticketOuvert } from '@/lib/affaires'
import { formatDay, normalizeSearch, parseServerDate, relativeDays } from '@/lib/format'
import { formatMoney } from '@/lib/text'

export type Segment = 'tickets' | 'devis' | 'commandes' | 'reclamations'
export type Tone = 'red' | 'amber' | 'green' | 'blue' | 'gray'
export type SuiviData = { tickets: Ticket[]; devis: Devis[]; commandes: Commande[]; reclamations: Reclamation[] }

export type SuiviRow = {
	key: string
	to: { name: string; params: { id: string } }
	title: string
	sub: string
	status: string
	/** Teinte imposée quand `status` est un libellé calculé (« Retard 18 j »). */
	tone?: Tone
	urgence?: string | null
	note?: { text: string; tone: Tone | 'muted'; alert?: boolean } | null
	amount?: string | null
	pending?: boolean
	files?: number
	progress?: { percent: number; label: string } | null
}
export type SuiviGroup = { title: string | null; hint: string | null; rows: SuiviRow[] }

/** `client` : vue d'un seul client, le nom du client n'a plus à servir de titre. */
type Ctx = { today: string; client?: string }
type Filtre<T> = { key: string; label: string; test: (item: T, today: string) => boolean }
type SegmentDef<T> = {
	label: string
	items: (data: SuiviData) => T[]
	ouvert: (item: T) => boolean
	alerte?: (item: T) => boolean
	filtres: Filtre<T>[]
	searchText: (item: T) => (string | null | undefined)[]
	trier?: (items: T[], filtre: string) => T[]
	/** Rappel du tri, quand il n'est pas déjà évident. */
	legende?: (filtre: string) => string | null
	row: (item: T, ctx: Ctx) => SuiviRow
}

/** Jours écoulés entre `value` et `today` (« YYYY-MM-DD… ») : positif dans le passé, négatif à venir. */
export function ecartJours(value: string | null | undefined, today: string): number | null {
	const from = parseServerDate(value ? `${value.slice(0, 10)} 00:00:00` : null)
	const to = parseServerDate(`${today} 00:00:00`)
	return from && to ? Math.round((to.getTime() - from.getTime()) / 86400000) : null
}

const parDate = (get: (item: any) => string | null | undefined, sens: 1 | -1 = 1) => (a: any, b: any) => {
	const [da, db] = [get(a), get(b)]
	if (!da || !db) return da ? -1 : db ? 1 : 0
	return da.localeCompare(db) * sens
}

/** Commande en cours pas encore livrée, dont la date de livraison est passée. */
export function commandeEnRetard(c: Commande, today: string): boolean {
	return commandeEnCours(c) && (c.per_delivered || 0) < 100 && (ecartJours(c.delivery_date, today) ?? 0) > 0
}

/** Pastille d'une commande : le délai de livraison, seule information qui varie d'une commande à l'autre. */
export function commandeDelai(c: Commande, today: string): { status: string; tone?: Tone } {
	const ecart = ecartJours(c.delivery_date, today)
	if (!commandeEnCours(c) || (c.per_delivered || 0) >= 100 || ecart == null) return { status: c.status }
	if (ecart > 0) return { status: `Retard ${ecart} j`, tone: 'red' }
	return { status: ecart === 0 ? "Aujourd'hui" : `Dans ${-ecart} j`, tone: ecart === 0 ? 'amber' : 'blue' }
}

const JOURS_EXPIRE_BIENTOT = 7
const devisExpire = (d: Devis) => d.status === 'Expired'
const devisCommande = (d: Devis) => d.status === 'Ordered' || d.statut_commande === 'Entièrement commandé'
const devisExpireBientot = (d: Devis, today: string) => {
	const ecart = ecartJours(d.valid_till, today)
	return devisOuvert(d) && ecart != null && ecart <= 0 && -ecart <= JOURS_EXPIRE_BIENTOT
}

/** Validité d'un devis : à relancer s'il a expiré, à surveiller s'il expire bientôt. */
export function devisValidite(d: Devis, today: string): SuiviRow['note'] {
	const ecart = ecartJours(d.valid_till, today)
	if (devisExpire(d)) return { text: ecart != null && ecart > 0 ? `Expiré depuis ${ecart} j, à relancer` : 'Expiré, à relancer', tone: 'muted' }
	if (!devisOuvert(d) || ecart == null) return null
	if (ecart > 0) return { text: `Validité dépassée de ${ecart} j`, tone: 'amber', alert: true }
	if (-ecart <= JOURS_EXPIRE_BIENTOT) return { text: ecart === 0 ? "Expire aujourd'hui" : `Expire dans ${-ecart} j`, tone: 'amber', alert: true }
	return { text: `Valable ${-ecart} j`, tone: 'muted' }
}

/** Échéance d'une réclamation ouverte, ou date de résolution. */
export function reclamationEcheance(r: Reclamation, today: string): SuiviRow['note'] {
	if (r.date_resolution) return { text: `Résolue le ${formatDay(r.date_resolution)}`, tone: 'muted' }
	if (!reclamationOuverte(r)) return null
	const ecart = ecartJours(r.date_echeance, today)
	if (ecart == null) return r.status === 'En retard' ? { text: 'Échéance dépassée', tone: 'red', alert: true } : null
	if (ecart > 0) return { text: `Échéance dépassée de ${ecart} j`, tone: 'red', alert: true }
	return { text: ecart === 0 ? "Échéance aujourd'hui" : `Échéance dans ${-ecart} j`, tone: 'muted' }
}

const ticketNote = (t: Ticket): SuiviRow['note'] => {
	const text = ticketAlerte(t)
	if (!text) return null
	if (t.status === 'Blocage Créance') return { text, tone: 'red', alert: true }
	return t.statut_demande_urgence === 'Refusée' ? { text, tone: 'amber', alert: true } : { text, tone: 'green' }
}

/** Ce qui demande une action passe en tête : blocages, puis urgences refusées, puis urgences validées. */
const rangAlerte = (t: Ticket) => (t.status === 'Blocage Créance' ? 0 : t.statut_demande_urgence === 'Refusée' ? 1 : 2)

const articles = (lignes: { item_code: string; item_name: string | null }[]) => {
	if (!lignes.length) return ''
	const premier = lignes[0].item_name || lignes[0].item_code
	return lignes.length > 1 ? `${premier} +${lignes.length - 1}` : premier
}
const joindre = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')
const sansPrefixe = (name: string) => name.replace(/^SAL-/, '')
const anciennete = (value?: string | null) => (value ? relativeDays(value).replace(/^./, (c) => c.toLowerCase()) : null)

const tickets: SegmentDef<Ticket> = {
	label: 'Tickets',
	items: (data) => data.tickets,
	ouvert: ticketOuvert,
	alerte: (t) => ticketOuvert(t) && !!ticketAlerte(t),
	filtres: [
		{ key: 'ouvert', label: 'Ouverts', test: ticketOuvert },
		{ key: 'prio', label: 'À traiter', test: (t) => ticketOuvert(t) && !!ticketAlerte(t) },
		{ key: 'cours', label: 'En cours', test: (t) => ticketOuvert(t) && t.status === 'En Cours' },
		{ key: 'nouveau', label: 'Nouveaux', test: (t) => ticketOuvert(t) && t.status === 'Nouveau' },
		{ key: 'fini', label: 'Terminés', test: (t) => t.status === 'Terminé' },
		{ key: 'tout', label: 'Tous', test: () => true },
	],
	searchText: (t) => [t.customer_name, t.client, t.request_type, t.name, t.description],
	row: (t, { client }) => ({
		key: t.name,
		to: { name: 'Ticket', params: { id: t.name } },
		title: client ? t.request_type || 'Ticket' : t.customer_name || t.client,
		sub: joindre(client ? null : t.request_type || 'Ticket', anciennete(t.creation_date)),
		status: t.status,
		urgence: t.niveau_urgence && t.niveau_urgence !== 'U0' ? t.niveau_urgence : null,
		note: ticketNote(t),
		pending: t._pending,
		files: t.pieces_locales || 0,
	}),
}

const devis: SegmentDef<Devis> = {
	label: 'Devis',
	items: (data) => data.devis,
	ouvert: devisOuvert,
	filtres: [
		{ key: 'ouvert', label: 'Ouverts', test: devisOuvert },
		{ key: 'bientot', label: 'Expire bientôt', test: devisExpireBientot },
		{ key: 'expire', label: 'Expirés', test: devisExpire },
		{ key: 'commande', label: 'Commandés', test: devisCommande },
		{ key: 'tout', label: 'Tous', test: () => true },
	],
	searchText: (d) => [d.customer_name, d.client, d.name, ...d.lignes.map((l) => l.item_name)],
	trier: (items, filtre) => [...items].sort(parDate((d: Devis) => d.valid_till, filtre === 'ouvert' || filtre === 'bientot' ? 1 : -1)),
	legende: (filtre) => (filtre === 'ouvert' || filtre === 'bientot' ? "Les plus proches d'expirer d'abord" : null),
	row: (d, { today, client }) => ({
		key: d.name,
		to: { name: 'Devis', params: { id: d.name } },
		title: client ? sansPrefixe(d.name) : d.customer_name || d.client,
		sub: joindre(client ? null : sansPrefixe(d.name), articles(d.lignes)),
		status: d.statut_commande || d.status,
		note: devisValidite(d, today),
		amount: formatMoney(d.grand_total, d.currency),
	}),
}

const commandes: SegmentDef<Commande> = {
	label: 'Commandes',
	items: (data) => data.commandes,
	ouvert: commandeEnCours,
	filtres: [
		{ key: 'ouvert', label: 'En cours', test: commandeEnCours },
		{ key: 'retard', label: 'En retard', test: commandeEnRetard },
		{ key: 'prod', label: 'En production', test: (c) => commandeEnCours(c) && !!c.fabrication?.ordres.some((o) => o.status === 'En Production') },
		{ key: 'fini', label: 'Terminées', test: (c) => c.status === 'Completed' },
		{ key: 'tout', label: 'Toutes', test: () => true },
	],
	searchText: (c) => [c.customer_name, c.client, c.name, c.bon_commande_client, ...c.lignes.map((l) => l.item_name)],
	trier: (items, filtre) => [...items].sort(parDate((c: Commande) => c.delivery_date, filtre === 'fini' || filtre === 'tout' ? -1 : 1)),
	legende: (filtre) => (filtre === 'ouvert' || filtre === 'retard' || filtre === 'prod' ? "Les plus en retard d'abord" : null),
	row: (c, { today, client }) => {
		const reference = c.bon_commande_client ? `BC ${c.bon_commande_client}` : sansPrefixe(c.name)
		return {
			key: c.name,
			to: { name: 'Commande', params: { id: c.name } },
			title: client ? reference : c.customer_name || c.client,
			sub: joindre(client ? null : reference, articles(c.lignes)),
			...commandeDelai(c, today),
			progress: commandeEnCours(c) ? fabricationProgress(c.fabrication) : null,
		}
	},
}

const reclamations: SegmentDef<Reclamation> = {
	label: 'Réclamations',
	items: (data) => data.reclamations,
	ouvert: reclamationOuverte,
	alerte: (r) => r.status === 'En retard',
	filtres: [
		{ key: 'ouvert', label: 'Ouvertes', test: reclamationOuverte },
		{ key: 'retard', label: 'En retard', test: (r) => r.status === 'En retard' },
		{ key: 'fini', label: 'Traitées', test: (r) => r.status === 'Traité' },
		{ key: 'tout', label: 'Toutes', test: () => true },
	],
	searchText: (r) => [r.nom_client, r.client, r.type_reclamation, r.procede, r.name],
	trier: (items, filtre) => [...items].sort(parDate((r: Reclamation) => r.date_echeance, filtre === 'fini' || filtre === 'tout' ? -1 : 1)),
	legende: (filtre) => (filtre === 'ouvert' || filtre === 'retard' ? "Les plus en retard d'abord" : null),
	row: (r, { today, client }) => ({
		key: r.name,
		to: { name: 'Reclamation', params: { id: r.name } },
		title: client ? r.type_reclamation || 'Réclamation' : r.nom_client || r.client,
		sub: client ? r.procede || '' : joindre(r.type_reclamation || 'Réclamation', r.procede),
		status: r.status,
		note: reclamationEcheance(r, today),
	}),
}

const SEGMENTS: Record<Segment, SegmentDef<any>> = { tickets, devis, commandes, reclamations }
export const SEGMENT_KEYS: Segment[] = ['tickets', 'devis', 'commandes', 'reclamations']
export const isSegment = (value: unknown): value is Segment => SEGMENT_KEYS.includes(value as Segment)

/** Une tuile par onglet : nombre d'éléments ouverts, et s'il y a quelque chose à traiter. */
export function suiviTuiles(data: SuiviData) {
	return SEGMENT_KEYS.map((key) => {
		const def = SEGMENTS[key]
		const items = def.items(data)
		return { key, label: def.label, count: items.filter(def.ouvert).length, alertes: def.alerte ? items.filter(def.alerte).length : 0 }
	})
}

/** Filtres d'un onglet avec leur compte ; le premier est le filtre par défaut. */
export function suiviFiltres(data: SuiviData, segment: Segment, today: string) {
	const def = SEGMENTS[segment]
	const items = def.items(data)
	return def.filtres.map((f) => ({ key: f.key, label: f.label, count: items.filter((item) => f.test(item, today)).length }))
}

/** Cartes affichées, en groupes : les tickets à traiter passent avant les autres dans la vue par défaut. */
export function suiviGroupes(data: SuiviData, segment: Segment, filtre: string, query: string, ctx: Ctx): SuiviGroup[] {
	const def = SEGMENTS[segment]
	const f = def.filtres.find((x) => x.key === filtre) ?? def.filtres[0]
	const q = normalizeSearch(query)
	const found = def
		.items(data)
		.filter((item) => f.test(item, ctx.today))
		.filter((item) => !q || normalizeSearch(def.searchText(item).join(' ')).includes(q))
	const rows = (items: unknown[]) => items.map((item) => def.row(item, ctx))
	if (!found.length) return []

	if (segment === 'tickets' && f.key === 'ouvert') {
		const prio = (found as Ticket[]).filter((t) => ticketAlerte(t)).sort((a, b) => rangAlerte(a) - rangAlerte(b))
		const reste = (found as Ticket[]).filter((t) => !ticketAlerte(t))
		if (!prio.length) return [{ title: null, hint: null, rows: rows(reste) }]
		const groups: SuiviGroup[] = [{ title: "À traiter d'abord", hint: String(prio.length), rows: rows(prio) }]
		if (reste.length) groups.push({ title: 'Le reste', hint: String(reste.length), rows: rows(reste) })
		return groups
	}
	return [{ title: def.legende?.(f.key) ?? null, hint: null, rows: rows(def.trier ? def.trier(found, f.key) : found) }]
}

/** Sous-titre de la page : ce qui attend le commercial. */
export function suiviResume(data: SuiviData): string {
	const [t, r] = [SEGMENTS.tickets, SEGMENTS.reclamations].map((def) => def.items(data).filter(def.alerte!).length)
	const parts = [t && `${t} ticket${t > 1 ? 's' : ''}`, r && `${r} réclamation${r > 1 ? 's' : ''}`].filter(Boolean)
	return parts.length ? `${parts.join(' et ')} à traiter` : 'Rien à traiter en priorité'
}
