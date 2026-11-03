/**
 * Saisies hors-ligne : chaque action est mise en file, appliquée tout de suite à l'affichage
 * (`applyMutation`), puis envoyée au serveur (`aurescrm.api.commercial_mutations`).
 *
 * Un document créé sur l'appareil porte la clé `local:<id de l'action de création>` ; une action qui le
 * vise avant sa création serveur envoie `<champ>_ref` (l'id de cette action), résolu par le journal serveur.
 */
import type { Appel, Bundle, Client, RendezVous, Visite } from '@/types'

export type MutationType =
	| 'visite_create'
	| 'visite_start'
	| 'visite_update'
	| 'visite_finish'
	| 'visite_cancel'
	| 'rdv_create'
	| 'rdv_update'
	| 'appel_create'
	| 'appel_update'
	| 'prospect_create'
	| 'client_update_gps'

export type Mutation = {
	id: string
	type: MutationType
	payload: Record<string, any>
	/** Clé (locale ou serveur) du document concerné, pour l'affichage. */
	target: string
	created_at: string
	attempts: number
	next_at: number | null
	error?: string | null
}

export const LOCAL_PREFIX = 'local:'
export const isLocal = (key?: string | null) => Boolean(key && key.startsWith(LOCAL_PREFIX))
export const localKey = (mutationId: string) => `${LOCAL_PREFIX}${mutationId}`

/** Référence d'un document dans une charge utile : son nom serveur, ou l'action qui le crée. */
export function refTo(field: string, key: string | null | undefined): Record<string, string> {
	if (!key) return {}
	return isLocal(key) ? { [`${field}_ref`]: key.slice(LOCAL_PREFIX.length) } : { [field]: key }
}

/** Clé locale visée par `<champ>` / `<champ>_ref` d'une charge utile. */
export function keyFrom(payload: Record<string, any>, field: string): string | null {
	if (payload[field]) return payload[field]
	if (payload[`${field}_ref`]) return localKey(payload[`${field}_ref`])
	return null
}

/** Action dont la réussite crée un document (son résultat donne le nom serveur de la clé locale). */
export const CREATES: MutationType[] = ['visite_create', 'rdv_create', 'appel_create', 'prospect_create']

export const MUTATION_LABELS: Record<MutationType, string> = {
	visite_create: 'Nouvelle visite',
	visite_start: 'Début de visite',
	visite_update: 'Visite modifiée',
	visite_finish: 'Fin de visite',
	visite_cancel: 'Visite annulée',
	rdv_create: 'Nouveau rendez-vous',
	rdv_update: 'Rendez-vous modifié',
	appel_create: 'Appel noté',
	appel_update: 'Appel modifié',
	prospect_create: 'Nouveau prospect',
	client_update_gps: 'Position du client',
}

const VISITE_FIELDS = [
	'type_visite',
	'notes',
	'date_rdv',
	'creance_client',
	'resultat_recouvrement',
	'montant_reclame',
	'montant_encaisse',
	'type_paiement',
	'date_paiement_negociee',
	'date_prochaine_relance',
	'numero_document_paiement',
	'motif_non_paiement',
] as const

function pick(payload: Record<string, any>, fields: readonly string[]) {
	const out: Record<string, any> = {}
	for (const field of fields) if (field in payload) out[field] = payload[field]
	return out
}

function replaceRow<T extends { name: string }>(rows: T[], key: string | null, change: (row: T) => T | null): T[] {
	if (!key) return rows
	const index = rows.findIndex((row) => row.name === key)
	if (index < 0) return rows
	const next = change(rows[index])
	const copy = rows.slice()
	if (next) copy[index] = next
	else copy.splice(index, 1)
	return copy
}

function minutesBetween(start?: string | null, end?: string | null) {
	if (!start || !end) return null
	const ms = new Date(end.replace(' ', 'T')).getTime() - new Date(start.replace(' ', 'T')).getTime()
	return Number.isFinite(ms) ? String(Math.max(0, Math.round(ms / 60000))) : null
}

/**
 * Le bundle tel que l'appareil l'affiche après l'action. Immuable : seules les listes touchées sont copiées.
 * Rejouée sur chaque nouvel instantané tant que l'action n'est pas confirmée par le serveur.
 */
export function applyMutation(bundle: Bundle, mutation: Mutation, user: { name: string; full_name: string }): Bundle {
	const p = mutation.payload
	const now = mutation.created_at
	const clientName = (key: string | null) => (key && bundle.clients.find((c) => c.name === key)?.customer_name) || null

	switch (mutation.type) {
		case 'visite_create': {
			const client = keyFrom(p, 'client')
			const visite: Visite = {
				name: localKey(mutation.id),
				_pending: true,
				status: 'Nouveau',
				docstatus: 0,
				date: p.date || now.slice(0, 10),
				client: client || '',
				nom_client: clientName(client),
				type_visite: p.type_visite ?? null,
				debut: null,
				fin: null,
				duree: null,
				wilaya: null,
				commune: null,
				notes: p.notes ?? null,
				date_rdv: p.date_rdv ?? null,
				utilisateur: user.name,
				nom_utilisateur: user.full_name,
				resultat_recouvrement: null,
				montant_encaisse: null,
				date_prochaine_relance: null,
				modified: now,
				...pick(p, VISITE_FIELDS),
			}
			return { ...bundle, visites: [visite, ...bundle.visites] }
		}
		case 'visite_start':
			return {
				...bundle,
				visites: replaceRow(bundle.visites, keyFrom(p, 'visite'), (v) =>
					v.status !== 'Nouveau'
						? v
						: { ...v, _pending: true, status: 'En Cours', debut: p.debut || now, date: (p.debut || now).slice(0, 10), gps_visite: p.gps ?? v.gps_visite },
				),
			}
		case 'visite_update':
			return {
				...bundle,
				visites: replaceRow(bundle.visites, keyFrom(p, 'visite'), (v) => ({
					...v,
					...pick(p, VISITE_FIELDS),
					...(p.date && v.status === 'Nouveau' ? { date: p.date } : {}),
					_pending: true,
				})),
			}
		case 'visite_finish':
			return {
				...bundle,
				visites: replaceRow(bundle.visites, keyFrom(p, 'visite'), (v) => {
					const debut = v.debut || p.debut || p.fin || now
					const fin = p.fin || now
					return {
						...v,
						...pick(p, VISITE_FIELDS),
						_pending: true,
						status: 'Terminé',
						docstatus: 1,
						debut,
						fin,
						duree: minutesBetween(debut, fin),
						photo_locale: p.photo_document_paiement?.data ?? v.photo_locale ?? null,
					}
				}),
			}
		case 'visite_cancel':
			// Une visite annulée (ou un brouillon supprimé) sort de la liste, comme côté serveur.
			return { ...bundle, visites: replaceRow(bundle.visites, keyFrom(p, 'visite'), () => null) }

		case 'rdv_create': {
			const client = keyFrom(p, 'client')
			const rdv: RendezVous = {
				name: localKey(mutation.id),
				_pending: true,
				status: p.status || 'En Attente',
				date_heure: p.date_heure ?? null,
				client,
				raison_sociale: clientName(client),
				statut_client: null,
				details: p.details ?? null,
				commercial: user.name,
				nom_commercial: user.full_name,
				modified: now,
			}
			return { ...bundle, rdv: [...bundle.rdv, rdv] }
		}
		case 'rdv_update':
			return {
				...bundle,
				rdv: replaceRow(bundle.rdv, keyFrom(p, 'rdv'), (r) => ({ ...r, ...pick(p, ['status', 'date_heure', 'details']), _pending: true })),
			}

		case 'appel_create': {
			const appel: Appel = {
				name: localKey(mutation.id),
				_pending: true,
				status: p.status || 'Répondu',
				type: p.type ?? null,
				date: (p.heure || now).slice(0, 10),
				heure: p.heure || now,
				client: keyFrom(p, 'client'),
				notes: p.notes ?? null,
				date_rappel: p.date_rappel ?? null,
				modified: now,
			}
			return { ...bundle, appels: [appel, ...bundle.appels] }
		}
		case 'appel_update':
			return {
				...bundle,
				appels: replaceRow(bundle.appels, keyFrom(p, 'appel'), (a) => ({ ...a, ...pick(p, ['status', 'type', 'notes', 'date_rappel']), _pending: true })),
			}

		case 'prospect_create': {
			const [lat, lon] = parseLatLon(p.gps)
			const client: Client = {
				name: localKey(mutation.id),
				_pending: true,
				customer_name: String(p.customer_name || '').toUpperCase(),
				statut: 'Prospect',
				groupe: null,
				wilaya: p.wilaya ?? null,
				commune: p.commune ?? null,
				region: null,
				lat,
				lon,
				telephone: p.telephone ?? null,
				telephone_principal: null,
				email: p.email ?? null,
				contact_principal: p.contact ?? null,
				grand_compte: 0,
				groupe_societes: null,
				qualite: null,
				satisfaction: null,
				commercial: user.full_name,
				image: null,
				derniere_visite: null,
				nb_articles: 0,
				modified: now,
			}
			return { ...bundle, clients: [client, ...bundle.clients] }
		}
		case 'client_update_gps': {
			const [lat, lon] = parseLatLon(p.gps)
			return { ...bundle, clients: replaceRow(bundle.clients, keyFrom(p, 'client'), (c) => ({ ...c, lat, lon, _pending: true })) }
		}
	}
	return bundle
}

function parseLatLon(value?: string | null): [number | null, number | null] {
	const numbers = (value || '').match(/-?\d+(?:\.\d+)?/g)
	return numbers && numbers.length >= 2 ? [Number(numbers[0]), Number(numbers[1])] : [null, null]
}

/** Délai avant le prochain essai : 15 s, 30 s, 1 min… plafonné à 30 min. */
export function retryDelayMs(attempts: number) {
	return Math.min(30 * 60 * 1000, 15000 * 2 ** Math.max(0, attempts - 1))
}

/** Au-delà, une action qui échoue encore passe dans « à corriger ». */
export const MAX_ATTEMPTS = 5
