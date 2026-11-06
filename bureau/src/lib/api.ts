/** File, tickets et actions. Les règles restent côté serveur (aurescrm/api/bureau.py). */
import type { ActivityApi, ActivityFeedData, Mention } from '@shared/activity'
import { call, callForm } from '@shared/api'
import type { BulkItem, BulkOptions, BulkResult, CandidateDemande, ClientChoice, Option, QueueResponse, QueueTicket, QueueView, References, TicketDetail, TicketFormOptions } from '@/types'
import type { BatAnalysis } from './batImport'
import type { ArticleDetail, ArticleOptions, ArticlesResponse, ArticleValues, ArticleView, PantoneMatch } from './articles'
import type { ClientDetail, ClientOptions, ClientsResponse, ClientValues, ClientView, CommuneChoice } from './clients'
import type { ArticleChoice, DemandeDetail, DemandeOptions, DemandesResponse, DemandeValues, DemandeView, TicketDemandeContext } from './demandes'
import type { Condition } from './filters'
import { conditionsForServer } from './filters'

const BUREAU = 'aurescrm.api.bureau'
const TICKET = 'aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial'

export interface QueuePaging {
	start?: number
	pageLength?: number
	sort?: string
	direction?: 'asc' | 'desc'
}

export const HOME_PATH = '/bureau'
export const LOGIN_PATH = '/bureau/connexion'

/** Retour après connexion : une page du poste seulement (même règle que `safe_redirect` côté serveur). */
export function safeRedirect(target: string | null | undefined) {
	const value = (target || '').trim()
	if (!/^\/bureau(?:[/?#]|$)/.test(value) || value.startsWith(LOGIN_PATH)) return HOME_PATH
	return value
}

/** Session expirée : connexion, avec la page en cours pour y revenir ensuite. */
export function redirectToLogin() {
	const { pathname, search, hash } = window.location
	const target = safeRedirect(pathname + search + hash)
	window.location.assign(target === HOME_PATH ? LOGIN_PATH : `${LOGIN_PATH}?redirect-to=${encodeURIComponent(target)}`)
}

/** La cloche d'une ligne : même écriture que le cœur du Desk, sans toucher à `modified`. */
export const setBell = (doctype: string, name: string, on: boolean) => call('frappe.desk.like.toggle_like', { doctype, name, add: on ? 'Yes' : 'No' }, true)

/** Connexion Frappe (même méthode que la page /login du site). */
export const login = (usr: string, pwd: string) => call<string>('login', { usr, pwd }, true)

/** Envoi du lien de réinitialisation : réponse identique que le compte existe ou non. */
export const resetPassword = (user: string) => call('frappe.core.doctype.user.user.reset_password', { user }, true)

/** Déconnexion (la session du Desk est la même), puis retour à la connexion du poste. */
export async function logout() {
	await call('logout', {}, true)
	window.location.href = LOGIN_PATH
}

/** Un filtre de `List Filter`, partagé avec le Desk. `dropped` compte les conditions dont le champ n'est plus disponible. */
export interface SavedFilter {
	name: string
	label: string
	is_global: boolean
	can_delete: boolean
	conditions: Omit<Condition, 'id'>[]
	dropped: number
}
export const getSavedFilters = (doctype: string) => call<{ filters: SavedFilter[]; can_share: boolean }>(`${BUREAU}.get_saved_filters`, { doctype })
export const saveFilter = (doctype: string, label: string, conditions: Condition[], isGlobal: boolean) =>
	call<string>(`${BUREAU}.save_filter`, { doctype, label, conditions: conditionsForServer(conditions), is_global: isGlobal ? 1 : 0 }, true)
export const deleteSavedFilter = (name: string) => call(`${BUREAU}.delete_saved_filter`, { name }, true)
export const searchFilterLink = (listDoctype: string, doctype: string, field: string, search: string) =>
	call<Option[]>(`${BUREAU}.search_filter_link`, { list_doctype: listDoctype, doctype, field, search: search.trim() || undefined })

/** Champs du doctype qui ne figurent pas dans la liste, pour les lignes exportées : { ligne: { « doctype.champ »: valeur } }. */
export const getExportValues = (doctype: string, names: string[], fields: { doctype: string; field: string }[]) =>
	call<Record<string, Record<string, string | number>>>(`${BUREAU}.get_export_values`, { doctype, names, fields }, true)

/** Classeur Excel des lignes données, en base 64. */
export const exportXlsx = (title: string, headers: string[], rows: (string | number)[][]) => call<string>(`${BUREAU}.export_xlsx`, { title, headers, rows }, true)

export const getQueue = (view: QueueView, conditions: Condition[], search: string, paging: QueuePaging = {}) =>
	call<QueueResponse>(`${BUREAU}.get_queue`, {
		view,
		conditions: conditionsForServer(conditions),
		search: search.trim() || undefined,
		start: paging.start,
		page_length: paging.pageLength,
		sort: paging.sort,
		direction: paging.direction,
	})

export const getReferences = () => call<References>(`${BUREAU}.get_references`)

export const getTicket = (name: string) => call<TicketDetail>(`${BUREAU}.get_ticket`, { name })

export const getCandidates = (ticketName: string) =>
	call<{ candidates: CandidateDemande[] }>(`${TICKET}.get_quotation_candidates_for_ticket_bc`, { ticket_name: ticketName })

const action = (method: string, params: Record<string, unknown>) => call<TicketDetail>(`${BUREAU}.${method}`, params, true)

export const runAction = (ticket: TicketDetail, name: string) => action('run_action', { name: ticket.name, modified: ticket.modified, action: name })

export const setCreance = (ticket: TicketDetail, statut: string, motif?: string) =>
	action('set_creance', { name: ticket.name, modified: ticket.modified, statut, motif })

export const setChecklist = (ticket: TicketDetail, fieldname: string, checked: boolean) =>
	action('set_checklist', { name: ticket.name, modified: ticket.modified, fieldname, checked: checked ? 1 : 0 })

export const decideUrgence = (ticket: TicketDetail, decision: 'validate' | 'refuse', niveau: string | null, commentaire: string) =>
	action('decide_urgence', { name: ticket.name, modified: ticket.modified, action: decision, niveau, commentaire })

export const decideRapprochement = (ticket: TicketDetail, decision: string, devis: string | null, commentaire: string) =>
	action('decide_rapprochement', { name: ticket.name, modified: ticket.modified, decision, devis, commentaire })

export const setAssignee = (ticket: TicketDetail, user: string) => action('set_assignee', { name: ticket.name, user })

export const removeDocument = (ticket: TicketDetail, file: string) => action('remove_document', { name: ticket.name, file })

/** Un lot d'action groupée enregistre plusieurs documents : il a droit à plus de temps qu'une requête ordinaire. */
const BULK_TIMEOUT_MS = 120 * 1000
const bulkItems = (rows: BulkItem[]) => rows.map(({ name, modified }) => ({ name, modified }))

export const bulkAssign = (tickets: BulkItem[], user: string) =>
	call<BulkResult>(`${BUREAU}.bulk_assign`, { items: bulkItems(tickets), user }, true, BULK_TIMEOUT_MS)

export const bulkAction = (tickets: BulkItem[], name: string) =>
	call<BulkResult>(`${BUREAU}.bulk_action`, { items: bulkItems(tickets), action: name }, true, BULK_TIMEOUT_MS)

/** Actions communes à toutes les listes : les droits et les champs permis sont décidés par le serveur. */
const BULK = 'aurescrm.api.bureau_bulk'

export const getBulkOptions = (doctype: string) => call<BulkOptions>(`${BULK}.get_bulk_options`, { doctype })

export const bulkUpdate = (doctype: string, rows: BulkItem[], fieldname: string, value: string) =>
	call<BulkResult>(`${BULK}.bulk_update`, { doctype, items: bulkItems(rows), fieldname, value }, true, BULK_TIMEOUT_MS)

export const bulkDelete = (doctype: string, rows: BulkItem[]) =>
	call<BulkResult>(`${BULK}.bulk_delete`, { doctype, items: bulkItems(rows) }, true, BULK_TIMEOUT_MS)

export const bulkAddTags = (doctype: string, rows: BulkItem[], tags: string[]) =>
	call<BulkResult>(`${BULK}.bulk_add_tags`, { doctype, items: bulkItems(rows), tags }, true, BULK_TIMEOUT_MS)

export const addDocTag = (doctype: string, row: BulkItem, tag: string) =>
	call<{ tags: string[] }>(`${BULK}.add_doc_tag`, { doctype, name: row.name, modified: row.modified, tag }, true)

export const removeDocTag = (doctype: string, row: BulkItem, tag: string) =>
	call<{ tags: string[] }>(`${BULK}.remove_doc_tag`, { doctype, name: row.name, modified: row.modified, tag }, true)

export const getBulkTags = (search: string) => call<string[]>(`${BULK}.get_bulk_tags`, { search: search.trim() || undefined })

export const searchBulkLink = (doctype: string, fieldname: string, search: string) =>
	call<Option[]>(`${BULK}.search_bulk_link`, { doctype, fieldname, search: search.trim() || undefined })

/** Joint les fichiers l'un après l'autre : un refus n'empêche pas de garder ceux déjà envoyés. */
/** Commentaires et activité d'un ticket, pour le fil commun. */
export function ticketActivity(name: string): ActivityApi {
	return {
		load: () => call<ActivityFeedData>(`${BUREAU}.get_activity`, { name }),
		add: (text, mentions) => call<ActivityFeedData>(`${BUREAU}.add_comment`, { name, text, mentions }, true),
		update: (comment, text, mentions) => call<ActivityFeedData>(`${BUREAU}.update_comment`, { name, comment, text, mentions }, true),
		remove: (comment) => call<ActivityFeedData>(`${BUREAU}.delete_comment`, { name, comment }, true),
		mentionCandidates: () => call<Mention[]>(`${BUREAU}.get_mention_candidates`),
	}
}

export const getTicketFormOptions = () => call<TicketFormOptions>(`${BUREAU}.get_ticket_form_options`)

export const searchClients = (search: string) => call<ClientChoice[]>(`${BUREAU}.search_clients`, { search: search.trim() || undefined })

export const createTicket = (values: { customer: string; request_type: string; site: string; description: string; commercial?: string; channel?: string; echeance?: string }) =>
	call<{ name: string }>(`${BUREAU}.create_ticket`, values, true)

/** Clients : liste, fiche, création et modification. */
const CLIENTS = 'aurescrm.api.bureau_clients'

export const getClients = (view: ClientView, conditions: Condition[], search: string, paging: QueuePaging = {}) =>
	call<ClientsResponse>(`${CLIENTS}.get_clients`, {
		view,
		conditions: conditionsForServer(conditions),
		search: search.trim() || undefined,
		start: paging.start,
		page_length: paging.pageLength,
		sort: paging.sort,
		direction: paging.direction,
	})

export const getClient = (name: string) => call<ClientDetail>(`${CLIENTS}.get_client`, { name })

export const getClientOptions = () => call<ClientOptions>(`${CLIENTS}.get_client_options`)

export const searchCommunes = (search: string) => call<CommuneChoice[]>(`${CLIENTS}.search_communes`, { search: search.trim() || undefined })

export const createProspect = (values: ClientValues) => call<{ name: string }>(`${CLIENTS}.create_prospect`, { values }, true)

export const updateClient = (client: ClientDetail, values: ClientValues) => call<ClientDetail>(`${CLIENTS}.update_client`, { name: client.name, modified: client.modified, values }, true)

/** Range un fichier déjà joint dans la pièce administrative choisie. */
export const setClientPiece = (client: ClientDetail, piece: string, fileUrl: string) => call<ClientDetail>(`${CLIENTS}.set_client_piece`, { name: client.name, modified: client.modified, piece, file_url: fileUrl }, true)

/** Commentaires et activité d'un client, pour le fil commun. */
export function clientActivity(name: string): ActivityApi {
	return {
		load: () => call<ActivityFeedData>(`${CLIENTS}.get_client_activity`, { name }),
		add: (text, mentions) => call<ActivityFeedData>(`${CLIENTS}.add_client_comment`, { name, text, mentions }, true),
		update: (comment, text, mentions) => call<ActivityFeedData>(`${CLIENTS}.update_client_comment`, { name, comment, text, mentions }, true),
		remove: (comment) => call<ActivityFeedData>(`${CLIENTS}.delete_client_comment`, { name, comment }, true),
		mentionCandidates: () => call<Mention[]>(`${BUREAU}.get_mention_candidates`),
	}
}

/** Articles : liste, fiche, création et modification. */
const ARTICLES = 'aurescrm.api.bureau_articles'

export const getArticles = (view: ArticleView, conditions: Condition[], search: string, paging: QueuePaging = {}) =>
	call<ArticlesResponse>(`${ARTICLES}.get_articles`, {
		view,
		conditions: conditionsForServer(conditions),
		search: search.trim() || undefined,
		start: paging.start,
		page_length: paging.pageLength,
		sort: paging.sort,
		direction: paging.direction,
	})

export const getArticle = (name: string) => call<ArticleDetail>(`${ARTICLES}.get_article`, { name })

export const getArticleOptions = () => call<ArticleOptions>(`${ARTICLES}.get_article_options`)

export const checkArticleDesignation = (designation: string, client?: string) => call<{ message: string | null }>(`${ARTICLES}.check_article_designation`, { designation, client })

export function analyzeBat(name: string, file: File) {
	const form = new FormData()
	form.append('name', name)
	form.append('file', file, file.name)
	return callForm<BatAnalysis>(`${ARTICLES}.analyze_bat`, form)
}

export const searchPantone = (query: string) => call<{ exact: PantoneMatch | null; suggestions: PantoneMatch[] }>(`${ARTICLES}.search_pantone`, { query })

export const createArticle = (values: ArticleValues) => call<{ name: string }>(`${ARTICLES}.create_article`, { values }, true)

export const updateArticle = (article: ArticleDetail, values: ArticleValues) => call<ArticleDetail>(`${ARTICLES}.update_article`, { name: article.name, modified: article.modified, values }, true)

export const makeComposed = (article: ArticleDetail) => call<ArticleDetail>(`${ARTICLES}.make_composed`, { name: article.name, modified: article.modified }, true)

export const addSousArticle = (article: ArticleDetail, designation: string, quantite: number) => call<{ name: string; article: ArticleDetail }>(`${ARTICLES}.add_sous_article`, { name: article.name, designation, quantite }, true)

/** Range un fichier déjà joint dans le champ choisi. Sans fichier, le champ se vide. */
export const setArticleFile = (article: ArticleDetail, piece: string, fileUrl: string) => call<ArticleDetail>(`${ARTICLES}.set_article_file`, { name: article.name, modified: article.modified, piece, file_url: fileUrl }, true)

export const removeArticleFile = (article: ArticleDetail, fileUrl: string) => call<ArticleDetail>(`${ARTICLES}.remove_article_file`, { name: article.name, modified: article.modified, file_url: fileUrl }, true)

export const referenceMaquette = (article: ArticleDetail, maquette: string) => call<ArticleDetail>(`${ARTICLES}.reference_maquette`, { name: article.name, maquette }, true)

export const activateMaquette = (article: ArticleDetail, maquette: string) => call<ArticleDetail>(`${ARTICLES}.activate_maquette`, { name: article.name, maquette }, true)

export const newMaquetteVersion = (article: ArticleDetail, maquette: string, changes: string) => call<{ name: string; article: ArticleDetail }>(`${ARTICLES}.new_maquette_version`, { name: article.name, maquette, changes }, true)

export const setMaquetteFile = (article: ArticleDetail, maquette: string, fileUrl: string) => call<ArticleDetail>(`${ARTICLES}.set_maquette_file`, { name: article.name, maquette, file_url: fileUrl }, true)

export const createArticleBat = (article: ArticleDetail, etude: string) => call<ArticleDetail>(`${ARTICLES}.create_article_bat`, { name: article.name, etude }, true)

/** Commentaires et activité d'un article, pour le fil commun. */
export function articleActivity(name: string): ActivityApi {
	return {
		load: () => call<ActivityFeedData>(`${ARTICLES}.get_article_activity`, { name }),
		add: (text, mentions) => call<ActivityFeedData>(`${ARTICLES}.add_article_comment`, { name, text, mentions }, true),
		update: (comment, text, mentions) => call<ActivityFeedData>(`${ARTICLES}.update_article_comment`, { name, comment, text, mentions }, true),
		remove: (comment) => call<ActivityFeedData>(`${ARTICLES}.delete_article_comment`, { name, comment }, true),
		mentionCandidates: () => call<Mention[]>(`${BUREAU}.get_mention_candidates`),
	}
}

/** Demandes de faisabilité : liste, fiche, création et cycle. */
const DEMANDES = 'aurescrm.api.bureau_demandes'

export const getDemandes = (view: DemandeView, conditions: Condition[], search: string, paging: QueuePaging = {}) =>
	call<DemandesResponse>(`${DEMANDES}.get_demandes`, {
		view,
		conditions: conditionsForServer(conditions),
		search: search.trim() || undefined,
		start: paging.start,
		page_length: paging.pageLength,
		sort: paging.sort,
		direction: paging.direction,
	})

export const getDemande = (name: string) => call<DemandeDetail>(`${DEMANDES}.get_demande`, { name })

export const getDemandeOptions = () => call<DemandeOptions>(`${DEMANDES}.get_demande_options`)

export const getDemandeArticles = (client: string) => call<ArticleChoice[]>(`${DEMANDES}.get_demande_articles`, { client })

export const getTicketDemandeContext = (ticket: string) => call<TicketDemandeContext>(`${DEMANDES}.get_ticket_demande_context`, { ticket })

export const createDemande = (values: DemandeValues, ticket?: string) => call<{ name: string }>(`${DEMANDES}.create_demande`, { values, ticket }, true)

export const updateDemande = (demande: DemandeDetail, values: DemandeValues) => call<DemandeDetail>(`${DEMANDES}.update_demande`, { name: demande.name, modified: demande.modified, values }, true)

export const confirmDemande = (demande: DemandeDetail) => call<DemandeDetail>(`${DEMANDES}.confirm_demande`, { name: demande.name, modified: demande.modified }, true)

export const cancelDemande = (demande: DemandeDetail) => call<DemandeDetail>(`${DEMANDES}.cancel_demande`, { name: demande.name, modified: demande.modified }, true)

export const closeDemande = (demande: DemandeDetail) => call<DemandeDetail>(`${DEMANDES}.close_demande`, { name: demande.name, modified: demande.modified }, true)

export const createDevis = (demande: DemandeDetail) => call<{ quotation: string; demande: DemandeDetail }>(`${DEMANDES}.create_devis`, { name: demande.name, modified: demande.modified }, true)

export const createRetirage = (demande: DemandeDetail, dateLivraison: string) => call<{ name: string }>(`${DEMANDES}.create_retirage`, { name: demande.name, modified: demande.modified, date_livraison: dateLivraison }, true)

/** Commentaires et activité d'une demande, pour le fil commun. */
export function demandeActivity(name: string): ActivityApi {
	return {
		load: () => call<ActivityFeedData>(`${DEMANDES}.get_demande_activity`, { name }),
		add: (text, mentions) => call<ActivityFeedData>(`${DEMANDES}.add_demande_comment`, { name, text, mentions }, true),
		update: (comment, text, mentions) => call<ActivityFeedData>(`${DEMANDES}.update_demande_comment`, { name, comment, text, mentions }, true),
		remove: (comment) => call<ActivityFeedData>(`${DEMANDES}.delete_demande_comment`, { name, comment }, true),
		mentionCandidates: () => call<Mention[]>(`${BUREAU}.get_mention_candidates`),
	}
}
