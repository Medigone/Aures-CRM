/**
 * Saisies hors-ligne : chaque action est mise en file, appliquée tout de suite à l'affichage
 * (`applyMutation`), puis envoyée au serveur (`aurescrm.api.commercial_mutations`).
 *
 * Un document créé sur l'appareil porte la clé `local:<id de l'action de création>` ; une action qui le
 * vise avant sa création serveur envoie `<champ>_ref` (l'id de cette action), résolu par le journal serveur.
 */
import type { Appel, Article, Bundle, Client, RendezVous, Ticket, Visite } from '@/types'

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
	| 'article_create'
	| 'article_update'
	| 'client_update_gps'
	| 'ticket_create'
	| 'ticket_update'
	| 'ticket_urgence_request'
	| 'ticket_urgence_cancel'

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
export const CREATES: MutationType[] = ['visite_create', 'rdv_create', 'appel_create', 'prospect_create', 'article_create', 'ticket_create']

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
	article_create: 'Nouvel article',
	article_update: 'Article modifié',
	client_update_gps: 'Position du client',
	ticket_create: 'Nouveau ticket',
	ticket_update: 'Ticket modifié',
	ticket_urgence_request: "Demande d'urgence",
	ticket_urgence_cancel: "Urgence retirée",
}

/** Niveau d'urgence imposé à la création (même règle que ticket_commercial.default_niveau_urgence_pour_creation). */
export function defaultUrgence(requestType?: string | null) {
	if (requestType === 'Bon de commande') return 'U2'
	if (requestType === 'Essai Blanc') return 'U3'
	return 'U0'
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
		case 'article_create': {
			const client = keyFrom(p, 'client')
			const offset = p.procede === 'Offset'
			const cotations = offset ? [p.largeur, p.hauteur, p.longueur].filter((v) => Number(v) > 0).join('x') : ''
			const photo = (p.attachments || []).find((a: { data: string }) => a.data.startsWith('data:image'))
			const article: Article = {
				name: localKey(mutation.id),
				_pending: true,
				designation: String(p.designation || '').toUpperCase(),
				description: null,
				client: client || '',
				code_client: p.code_client || null,
				procede: p.procede ?? null,
				dimensions: offset ? cotations || null : p.dimensions || null,
				support: null,
				image: photo?.data ?? null,
				groupe: null,
				parent: null,
				sous_article: 0,
				compose: 0,
				fiche_technique: null,
				trace_decoupe: null,
				consommation_annuelle: Number(p.consommation_annuelle) || null,
				bat: null,
				fiche: offset
					? Object.fromEntries(
							[
								['custom_largeur', Number(p.largeur) || null],
								['custom_hauteur', Number(p.hauteur) || null],
								['custom_longueur', Number(p.longueur) || null],
								['custom_cotations_article', cotations || null],
							].filter(([, v]) => v),
						)
					: p.dimensions
						? { custom_dimensions_h_x_l: p.dimensions }
						: {},
				modified: now,
			}
			return {
				...bundle,
				articles: [article, ...bundle.articles],
				clients: replaceRow(bundle.clients, client, (c) => ({ ...c, nb_articles: (c.nb_articles || 0) + 1 })),
			}
		}
		case 'article_update':
			return {
				...bundle,
				articles: replaceRow(bundle.articles, keyFrom(p, 'article'), (a) => {
					const fiche: Record<string, string | number> = { ...(a.fiche ?? {}) }
					for (const [field, value] of Object.entries(p.fiche || {})) {
						if (value == null || value === '' || value === 0) delete fiche[field]
						else fiche[field] = value as string | number
					}
					return {
						...a,
						_pending: true,
						fiche,
						...('designation' in p ? { designation: String(p.designation || '').toUpperCase() } : {}),
						...('procede' in p ? { procede: p.procede } : {}),
						...('code_client' in p ? { code_client: p.code_client || null } : {}),
						...('consommation_annuelle' in p ? { consommation_annuelle: Number(p.consommation_annuelle) || null } : {}),
						dimensions: ((('procede' in p ? p.procede : a.procede) === 'Offset' ? fiche.custom_cotations_article : fiche.custom_dimensions_h_x_l) as string) ?? null,
						modified: now,
					}
				}),
			}
		case 'ticket_create': {
			const client = keyFrom(p, 'client')
			const ticket: Ticket = {
				name: localKey(mutation.id),
				_pending: true,
				status: 'Nouveau',
				docstatus: 0,
				client: client || '',
				customer_name: clientName(client),
				request_type: p.request_type ?? null,
				priority: p.priority || 'Moyenne',
				channel: p.channel ?? null,
				description: p.description ?? null,
				echeance: p.echeance ?? null,
				site: p.site ?? null,
				niveau_urgence: defaultUrgence(p.request_type),
				niveau_urgence_demande: null,
				statut_demande_urgence: 'Aucune',
				commentaire_validation_urgence: null,
				statut_creance: p.request_type === 'Bon de commande' ? 'Non vérifiée' : null,
				motif_blocage_creance: null,
				assigne_a_nom: null,
				commercial: user.name,
				nom_commercial: user.full_name,
				creation_date: now.slice(0, 10),
				creation: now,
				modified: now,
				pieces_locales: (p.attachments || []).length,
			}
			return { ...bundle, tickets: [ticket, ...(bundle.tickets ?? [])] }
		}
		case 'ticket_update':
			return {
				...bundle,
				tickets: replaceRow(bundle.tickets ?? [], keyFrom(p, 'ticket'), (t) => ({ ...t, ...pick(p, ['priority', 'channel', 'description', 'echeance']), _pending: true })),
			}
		case 'ticket_urgence_request':
			return {
				...bundle,
				tickets: replaceRow(bundle.tickets ?? [], keyFrom(p, 'ticket'), (t) => ({
					...t,
					_pending: true,
					niveau_urgence_demande: p.niveau ?? null,
					statut_demande_urgence: 'En attente',
					commentaire_validation_urgence: null,
				})),
			}
		case 'ticket_urgence_cancel':
			return {
				...bundle,
				tickets: replaceRow(bundle.tickets ?? [], keyFrom(p, 'ticket'), (t) => ({
					...t,
					_pending: true,
					niveau_urgence: defaultUrgence(t.request_type),
					niveau_urgence_demande: null,
					statut_demande_urgence: 'Aucune',
				})),
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
