/** Règles de la page Clients : types, vues, colonnes, filtres et validation de la fenêtre. */
import type { CommentSummary, Option } from '@/types'
import type { FilterField } from './filters'
import { formatDay } from './display'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export type ClientView = 'all' | 'actif' | 'prospect' | 'dormant' | 'creance' | 'perdu'

export const CLIENT_VIEWS: { key: ClientView; label: string }[] = [
	{ key: 'all', label: 'Tous' },
	{ key: 'actif', label: 'Actifs' },
	{ key: 'prospect', label: 'Prospects' },
	{ key: 'dormant', label: 'Dormants' },
	{ key: 'creance', label: 'Avec créance' },
	{ key: 'perdu', label: 'Perdus ou exclus' },
]

export interface ClientRow {
	name: string
	modified: string
	creation: string
	date: string | null
	client: string
	status: string | null
	wilaya: string | null
	categorie: string | null
	commercial: string | null
	contact: string | null
	telephone: string | null
	grand_compte: number
	visite: string | null
	creance: number
	tickets: number
	tags: string[]
	cloche: boolean
}

export interface ClientsResponse extends ListResponse {
	clients: ClientRow[]
	counts: Record<ClientView, number>
	page_length: number
}

export interface ClientTicket {
	name: string
	request_type: string
	status: string
	niveau_urgence: string
	echeance: string | null
	is_open: boolean
	is_late: boolean
}

export interface ClientVente {
	name: string
	transaction_date: string
	grand_total: number
	status: string
	custom_statut_commande?: string | null
}

export interface ClientDetail {
	name: string
	modified: string
	tags: string[]
	client: string
	status: string | null
	forme_juridique: string | null
	categorie: string | null
	groupe: string | null
	depuis: string | null
	/** Identifiant de la commune, pour l'enregistrement ; `commune_label` est son nom. */
	commune: string | null
	commune_label: string | null
	wilaya: string | null
	map_url: string | null
	commercial: string | null
	commercial_user: string | null
	contact: string | null
	telephone: string | null
	email: string | null
	visite: string | null
	grand_compte: number
	prioritaire: number
	petites_quantites: number
	qualite: number | null
	satisfaction: number | null
	sensibilites: { prix: string | null; delais: string | null; qualite: string | null; process: string | null }
	pieces: { key: string; label: string; numero: string | null; fichier: string | null }[]
	attributions: { societe: string; commercial: string; principal: number }[]
	contacts: { nom: string | null; fonction: string | null; telephone: string | null; email: string | null; principal: number }[]
	adresses: { label: string; commune: string | null; wilaya: string | null; texte: string | null }[]
	tickets: ClientTicket[]
	creance: {
		name: string
		statut: string
		solde_restant: number
		date_prochaine_relance: string | null
		dernier_resultat_recouvrement: string | null
		mouvements: { name: string; date_mouvement: string; type_mouvement: string; type_paiement: string | null; sens: string | null; montant: number }[]
	} | null
	devis: ClientVente[]
	commandes: ClientVente[]
	articles: { name: string; designation: string; reference: string | null; procede: string | null; bat: string | null; derniere_commande: string | null }[]
	relation: { name: string; doctype: string; kind: string; date: string | null; objet: string | null; who: string | null; status: string | null; note: string }[]
	comments: CommentSummary
	can_edit: boolean
	can_view_activity: boolean
}

export interface ClientOptions {
	filter_fields?: FilterField[]
	statuses: string[]
	formes: string[]
	sensibilites: string[]
	categories: string[]
	groupes: string[]
	wilayas: string[]
	commercials: Option[]
	nobody: string
}

export interface CommuneChoice {
	name: string
	commune: string | null
	wilaya: string | null
}

export type ClientValues = Partial<Record<ClientField, string>>

export const CLIENT_FIELDS = [
	'customer_name',
	'status',
	'forme_juridique',
	'categorie',
	'commune',
	'commercial',
	'contact',
	'telephone',
	'email',
	'groupe',
	'sensibilite_prix',
	'sensibilite_delais',
	'sensibilite_qualite',
	'sensibilite_process',
	'rc',
	'nif',
	'nis',
	'ai',
] as const
export type ClientField = (typeof CLIENT_FIELDS)[number]

/** Montant en dinars, avec une espace insécable pour les milliers : « 1 240 000 ». */
export function formatAmount(value?: number | null) {
	return Math.round(value ?? 0)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export const CLIENT_COLUMNS: Column<ClientRow>[] = [
	{ key: 'client', label: 'Client', width: 210, grow: 2, sortable: true, text: (row) => row.client },
	{ key: 'status', label: 'Statut', width: 104, sortable: true, text: (row) => row.status || '' },
	{ key: 'wilaya', label: 'Wilaya', width: 110, grow: 0.6, sortable: true, text: (row) => row.wilaya || '' },
	{ key: 'commercial', label: 'Commercial', width: 130, grow: 0.8, sortable: true, text: (row) => row.commercial || '' },
	{ key: 'visite', label: 'Dernière visite', width: 112, sortable: true, text: (row) => formatDay(row.visite) },
	{ key: 'creance', label: 'Créance (DA)', width: 108, sortable: true, end: true, text: (row) => Math.round(row.creance) },
	{ key: 'tickets', label: 'Tickets', width: 64, sortable: true, end: true, text: (row) => row.tickets },
	{ key: 'tags', label: 'Tags', width: 190, grow: 1, sortable: false, text: (row) => tagsText(row) },
	{ key: 'categorie', label: 'Catégorie', width: 110, sortable: true, optional: true, text: (row) => row.categorie || '' },
	{ key: 'contact', label: 'Contact principal', width: 150, sortable: true, optional: true, text: (row) => row.contact || '' },
	{ key: 'telephone', label: 'Téléphone', width: 112, sortable: true, optional: true, text: (row) => row.telephone || '' },
	// Masquée par défaut : les codes actuels sont mélangés et n'aident pas à repérer un client.
	{ key: 'name', label: 'Code', width: 110, sortable: true, optional: true, text: (row) => row.name },
	{ key: 'date', label: 'Client depuis', width: 100, sortable: true, optional: true, text: (row) => formatDay(row.date) },
	{ key: 'creation', label: 'Créé le', width: 92, sortable: true, optional: true, text: (row) => formatDay(row.creation) },
	{ key: 'modified', label: 'Modifié le', width: 92, sortable: true, optional: true, text: (row) => formatDay(row.modified) },
]
export const DEFAULT_CLIENT_COLUMNS = CLIENT_COLUMNS.filter((column) => !column.optional).map((column) => column.key)

export function clientSortText(sort: Sort | null) {
	const column = sort && CLIENT_COLUMNS.find((item) => item.key === sort.key)
	return column ? `Tri : ${column.label.toLowerCase()}` : 'Tri : nom'
}

const REQUIRED: { field: ClientField; message: string }[] = [
	{ field: 'customer_name', message: 'Saisissez la raison sociale.' },
	{ field: 'forme_juridique', message: 'Choisissez la forme juridique.' },
	{ field: 'categorie', message: 'Choisissez la catégorie.' },
	{ field: 'commune', message: 'Choisissez la commune.' },
	{ field: 'commercial', message: 'Choisissez le commercial.' },
]

export function validateClient(values: ClientValues) {
	const errors: Partial<Record<ClientField, string>> = {}
	for (const { field, message } of REQUIRED) if (!values[field]?.trim()) errors[field] = message
	return errors
}

/** Valeurs de la fenêtre pour un client existant. */
export function clientFormValues(client: ClientDetail): Required<ClientValues> {
	const number = (key: string) => client.pieces.find((piece) => piece.key === key)?.numero ?? ''
	return {
		customer_name: client.client,
		status: client.status ?? '',
		forme_juridique: client.forme_juridique ?? '',
		categorie: client.categorie ?? '',
		commune: client.commune ?? '',
		commercial: client.commercial_user ?? '',
		contact: client.contact ?? '',
		telephone: client.telephone ?? '',
		email: client.email ?? '',
		groupe: client.groupe ?? '',
		sensibilite_prix: client.sensibilites.prix ?? '',
		sensibilite_delais: client.sensibilites.delais ?? '',
		sensibilite_qualite: client.sensibilites.qualite ?? '',
		sensibilite_process: client.sensibilites.process ?? '',
		rc: number('rc'),
		nif: number('nif'),
		nis: number('nis'),
		ai: number('ai'),
	}
}

/** Seuls les champs changés partent au serveur : une fiche ouverte ne réécrit pas ce qu'elle n'a pas touché. */
export function changedValues(initial: ClientValues, current: ClientValues) {
	const changes: ClientValues = {}
	for (const field of CLIENT_FIELDS) {
		if ((current[field] ?? '').trim() !== (initial[field] ?? '').trim()) changes[field] = (current[field] ?? '').trim()
	}
	return changes
}

/** Recherche sans accents ni casse, comme le contrôle des doublons de la PWA. */
export function normalizeName(value: string) {
	return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}
