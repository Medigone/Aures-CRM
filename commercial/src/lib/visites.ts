/** Page Visites et fiche de visite : filtres, groupes, contenu des cartes, contexte du client. */
import type { Client, Commande, Creance, Reclamation, Ticket, Visite } from '@/types'
import { commandeEnCours, reclamationOuverte, ticketOuvert } from '@/lib/affaires'
import { addDays, formatDay, formatTime, normalizeSearch, parseServerDate, weekStart } from '@/lib/format'
import { commandeEnRetard, type SuiviGroup, type SuiviRow } from '@/lib/suivi'
import { formatMoney, htmlToText } from '@/lib/text'

/** Visite prévue dont la date est passée sans qu'elle ait démarré. */
export const visiteARePlanifier = (v: Visite, today: string) => v.status === 'Nouveau' && v.date < today
/** Visite démarrée un jour précédent et jamais terminée. */
export const visiteOubliee = (v: Visite, today: string) => v.status === 'En Cours' && v.date < today
const visiteAFaire = (v: Visite) => v.docstatus === 0

const FILTRES: { key: string; label: string; test: (v: Visite, today: string) => boolean }[] = [
	{ key: 'afaire', label: 'À faire', test: visiteAFaire },
	{ key: 'retard', label: 'En retard', test: (v, today) => visiteARePlanifier(v, today) || visiteOubliee(v, today) },
	{ key: 'terminees', label: 'Terminées', test: (v) => v.status === 'Terminé' },
	{ key: 'toutes', label: 'Toutes', test: () => true },
]

export function visitesFiltres(visites: Visite[], today: string) {
	return FILTRES.map((f) => ({ key: f.key, label: f.label, count: visites.filter((v) => f.test(v, today)).length }))
}

/** Durée lisible : le champ serveur (minutes), sinon l'écart entre début et fin. */
export function dureeVisite(v: Pick<Visite, 'duree' | 'debut' | 'fin'>): string | null {
	let minutes = v.duree != null && v.duree !== '' ? Number(v.duree) : NaN
	if (Number.isNaN(minutes)) {
		const [debut, fin] = [parseServerDate(v.debut), parseServerDate(v.fin)]
		if (!debut || !fin) return null
		minutes = Math.round((fin.getTime() - debut.getTime()) / 60000)
	}
	if (minutes < 1) return "moins d'1 min"
	return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

const joindre = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(' · ')
const majuscule = (text: string) => text.replace(/^./, (c) => c.toUpperCase())

type Ctx = { today: string; now?: number; lieu?: (v: Visite) => string | null; nomClient?: (client: string) => string | null | undefined }

function visiteRow(v: Visite, ctx: Ctx): SuiviRow {
	const type = v.type_visite || 'Visite'
	const row: SuiviRow = {
		key: v.name,
		to: { name: 'Visit', params: { id: v.name } },
		title: v.nom_client || ctx.nomClient?.(v.client) || v.client,
		sub: joindre(type, ctx.lieu?.(v)),
		status: v.status,
		pending: v._pending,
	}
	if (visiteOubliee(v, ctx.today)) {
		return { ...row, tone: 'red', note: { text: `Commencée le ${formatDay(v.date)}, à terminer`, tone: 'red', alert: true } }
	}
	if (v.status === 'En Cours') {
		const debut = parseServerDate(v.debut)
		const depuis = debut ? Math.max(0, Math.round(((ctx.now ?? Date.now()) - debut.getTime()) / 60000)) : null
		const text = debut ? `Démarrée à ${formatTime(v.debut)}${depuis != null ? ` · ${dureeVisite({ duree: String(depuis), debut: null, fin: null })}` : ''}` : 'Démarrée'
		return { ...row, note: { text, tone: 'green' } }
	}
	if (visiteARePlanifier(v, ctx.today)) {
		return { ...row, tone: 'amber', note: { text: `Prévue le ${formatDay(v.date)}`, tone: 'amber' } }
	}
	if (v.docstatus === 1) {
		row.sub = joindre(type, formatDay(v.date), dureeVisite(v))
		if (v.resultat_recouvrement) {
			return { ...row, note: { text: v.resultat_recouvrement, tone: 'muted' }, amount: v.montant_encaisse ? formatMoney(v.montant_encaisse) : null }
		}
		const compteRendu = htmlToText(v.notes).trim().split('\n')[0]
		return { ...row, note: compteRendu ? { text: compteRendu, tone: 'muted' } : { text: 'Sans compte rendu', tone: 'amber' } }
	}
	return row
}

/** Groupe d'une visite à faire, et sa position : en cours, à replanifier, aujourd'hui, demain, puis par date. */
function groupeAFaire(v: Visite, today: string): { title: string; rang: string } {
	if (v.status === 'En Cours') return { title: 'En cours', rang: '0' }
	if (v.date < today) return { title: 'À replanifier', rang: '1' }
	if (v.date === today) return { title: "Aujourd'hui", rang: '2' }
	if (v.date === addDays(today, 1)) return { title: 'Demain', rang: '3' }
	return { title: formatDay(v.date), rang: `4${v.date}` }
}

/** Groupe d'une visite passée : la semaine en cours, puis par mois. */
function groupeHistorique(v: Visite, today: string): { title: string; rang: string } {
	if (v.date >= weekStart(today)) return { title: 'Cette semaine', rang: '5' }
	const mois = parseServerDate(`${v.date} 00:00:00`)
	const label = mois ? majuscule(mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })) : '—'
	// Les mois les plus récents d'abord : rang décroissant quand la date croît.
	return { title: label, rang: `6${999999 - Number(v.date.slice(0, 7).replace('-', ''))}` }
}

const SANS_DATE = ''
const parDateDesc = (a: Visite, b: Visite) => (b.date || SANS_DATE).localeCompare(a.date || SANS_DATE)

export function visitesGroupes(visites: Visite[], filtre: string, query: string, ctx: Ctx): SuiviGroup[] {
	const f = FILTRES.find((x) => x.key === filtre) ?? FILTRES[0]
	const q = normalizeSearch(query)
	const found = visites
		.filter((v) => f.test(v, ctx.today))
		.filter((v) => !q || normalizeSearch([v.nom_client, v.client, v.type_visite, ctx.lieu?.(v), v.name].join(' ')).includes(q))

	const groupes = new Map<string, { title: string; rang: string; visites: Visite[] }>()
	for (const v of found) {
		const { title, rang } = visiteAFaire(v) ? groupeAFaire(v, ctx.today) : groupeHistorique(v, ctx.today)
		if (!groupes.has(rang)) groupes.set(rang, { title, rang, visites: [] })
		groupes.get(rang)!.visites.push(v)
	}
	return [...groupes.values()]
		.sort((a, b) => a.rang.localeCompare(b.rang))
		.map((g) => ({ title: g.title, hint: String(g.visites.length), rows: [...g.visites].sort(parDateDesc).map((v) => visiteRow(v, ctx)) }))
}

/** Sous-titre de la page : ce qui attend le commercial. */
export function visitesResume(visites: Visite[], today: string): string {
	const enCours = visites.filter((v) => v.status === 'En Cours').length
	const duJour = visites.filter((v) => v.status === 'Nouveau' && v.date === today).length
	const aReplanifier = visites.filter((v) => visiteARePlanifier(v, today)).length
	const parts = [enCours && `${enCours} en cours`, duJour && `${duJour} aujourd'hui`, aReplanifier && `${aReplanifier} à replanifier`].filter(Boolean)
	return parts.length ? parts.join(', ') : "Rien de prévu aujourd'hui"
}

/** Ce qu'il faut savoir du client avant et pendant une visite, à partir des données de l'appareil. */
export function visiteContexte(
	visite: Pick<Visite, 'name' | 'client'>,
	data: { visites: Visite[]; tickets: Ticket[]; commandes: Commande[]; reclamations: Reclamation[]; creances: Creance[] },
	today: string,
) {
	const du = <T extends { client: string }>(rows: T[]) => rows.filter((r) => r.client === visite.client)
	const commandes = du(data.commandes).filter(commandeEnCours)
	const derniere = du(data.visites)
		.filter((v) => v.status === 'Terminé' && v.name !== visite.name)
		.sort(parDateDesc)[0]
	return {
		derniereVisite: derniere ?? null,
		tickets: du(data.tickets).filter(ticketOuvert).length,
		commandes: commandes.length,
		commandesEnRetard: commandes.filter((c) => commandeEnRetard(c, today)).length,
		reclamations: du(data.reclamations).filter(reclamationOuverte).length,
		solde: du(data.creances).reduce((total, c) => total + (c.solde_restant || 0), 0),
	}
}

/** Tickets ouverts depuis une visite : le ticket n'a pas de lien dédié, sa description cite la visite d'origine. */
export const ticketsDeVisite = (tickets: Ticket[], visite: string) => tickets.filter((t) => t.description?.includes(visite))

export const clientTelephone = (c: Pick<Client, 'telephone' | 'telephone_principal'> | null | undefined) => c?.telephone_principal || c?.telephone || null

export function clientItineraire(c: Pick<Client, 'lat' | 'lon' | 'commune' | 'wilaya' | 'customer_name'> | null | undefined): string | null {
	if (!c) return null
	if (c.lat != null && c.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`
	const place = [c.commune, c.wilaya].filter(Boolean).join(' ')
	return place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.customer_name} ${place}`)}` : null
}
