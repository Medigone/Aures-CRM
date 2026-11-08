/** File, tickets et actions. Les règles restent côté serveur (aurescrm/api/bureau.py). */
import type { AccueilData, AccueilScope } from './accueil'
import type { EtudeAccueilData } from './accueilEtude'
import type { DuplicateKeep } from './articleDuplicate'
import type { ListLayout } from './listViews'
import type { ActivityApi, ActivityFeedData, Mention } from '@shared/activity'
import { call, callForm } from '@shared/api'
import type { BulkItem, BulkOptions, BulkResult, CandidateDemande, ClientChoice, Option, QueueResponse, QueueTicket, QueueView, References, TicketDetail, TicketFormOptions } from '@/types'
import type { BatAnalysis } from './batImport'
import type { ArticleDetail, ArticleOptions, ArticlesResponse, ArticleValues, ArticleView, PantoneMatch } from './articles'
import type { ClientDetail, ClientOptions, ClientsResponse, ClientValues, ClientView, CommuneChoice } from './clients'
import type { EtudeDetail, EtudeOptions, EtudesResponse, EtudeView } from './etudes'
import type { ImpositionDetail, ImpositionOptions, ImpositionsResponse, ImpositionView } from './impositions'
import type { TraceAnalysis, TraceDetail, TraceOptions, TracePreview, TracesResponse, TraceVersionResult, TraceView } from './traces'
import type { GroupCandidate, GroupResult } from './groupage'
import type { AtelierCalcul, AtelierData, AtelierFormat, GabaritApercu, PropositionResult, Scenario } from './atelier'
import type { BatConfirmation, ClicheOptions, EtudePieces, ImpositionRow, MachineRow, PiecesResult, SaveTraceResult, TraceReference } from './etudePieces'
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

/** Une vue enregistrée d'une liste. `dropped` compte les colonnes et les filtres dont le champ n'est plus disponible. */
export interface SavedListView {
	name: string
	label: string
	is_global: boolean
	can_edit: boolean
	config: ListLayout
	dropped: number
}
export const getListViews = (doctype: string) => call<{ views: SavedListView[]; default: string | null; can_share: boolean }>(`${BUREAU}.get_list_views`, { doctype })
export const saveListView = (doctype: string, label: string, layout: ListLayout, isGlobal: boolean, name?: string) =>
	call<string>(
		`${BUREAU}.save_list_view`,
		{ doctype, label, config: { columns: layout.columns, sort: layout.sort, view: layout.view, conditions: conditionsForServer(layout.conditions.map((condition, id) => ({ ...condition, id }))) }, is_global: isGlobal ? 1 : 0, name },
		true,
	)
export const deleteListView = (name: string) => call(`${BUREAU}.delete_list_view`, { name }, true)
export const setDefaultListView = (doctype: string, name: string | null) => call(`${BUREAU}.set_default_list_view`, { doctype, name: name ?? undefined }, true)

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

export const getAccueil = (scope: AccueilScope) => call<AccueilData>('aurescrm.api.bureau_accueil.get_accueil', { scope })

export const getReferences = () => call<References>(`${BUREAU}.get_references`)

export const getTicket = (name: string) => call<TicketDetail>(`${BUREAU}.get_ticket`, { name })

export const getCandidates = (ticketName: string) =>
	call<{ candidates: CandidateDemande[] }>(`${TICKET}.get_quotation_candidates_for_ticket_bc`, { ticket_name: ticketName })

const action = (method: string, params: Record<string, unknown>) => call<TicketDetail>(`${BUREAU}.${method}`, params, true)

export const runAction = (ticket: Pick<TicketDetail, 'name' | 'modified'>, name: string) => action('run_action', { name: ticket.name, modified: ticket.modified, action: name })

export const setCreance = (ticket: TicketDetail, statut: string, motif?: string) =>
	action('set_creance', { name: ticket.name, modified: ticket.modified, statut, motif })

export const setArticlesVerified = (ticket: TicketDetail, verified: boolean) => action('set_articles_verified', { name: ticket.name, modified: ticket.modified, verified: verified ? 1 : 0 })

export const setQuantitesImpactees = (ticket: TicketDetail, value: string) => action('set_quantites_impactees', { name: ticket.name, modified: ticket.modified, value })

export const decideUrgence = (ticket: TicketDetail, decision: 'validate' | 'refuse', niveau: string | null, commentaire: string) =>
	action('decide_urgence', { name: ticket.name, modified: ticket.modified, action: decision, niveau, commentaire })

export const decideRapprochement = (ticket: TicketDetail, decision: string, devis: string | null, commentaire: string) =>
	action('decide_rapprochement', { name: ticket.name, modified: ticket.modified, decision, devis, commentaire })

export const setAssignee = (ticket: Pick<TicketDetail, 'name'>, user: string) => action('set_assignee', { name: ticket.name, user })

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

export const duplicateArticle = (name: string, values: { designation: string; client: string; reference: string; groupe: string }, keep: DuplicateKeep) => call<{ name: string }>(`${ARTICLES}.duplicate_article`, { name, values, keep }, true)

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

/** Études de faisabilité : liste et aperçu. */
const ETUDES = 'aurescrm.api.bureau_etudes'

export const getEtudes = (view: EtudeView, conditions: Condition[], search: string, paging: QueuePaging = {}) =>
	call<EtudesResponse>(`${ETUDES}.get_etudes`, {
		view,
		conditions: conditionsForServer(conditions),
		search: search.trim() || undefined,
		start: paging.start,
		page_length: paging.pageLength,
		sort: paging.sort,
		direction: paging.direction,
	})

export const getEtudeAccueil = (scope: AccueilScope) => call<EtudeAccueilData>('aurescrm.api.bureau_etudes_accueil.get_etude_accueil', { scope })

export const getEtude = (name: string) => call<EtudeDetail>(`${ETUDES}.get_etude`, { name })

export const getEtudeOptions = () => call<EtudeOptions>(`${ETUDES}.get_etude_options`)

export const runEtudeAction = (etude: Pick<EtudeDetail, 'name' | 'modified'>, action: string) => call<EtudeDetail>(`${ETUDES}.run_etude_action`, { name: etude.name, modified: etude.modified, action }, true)

export const setEtudeAssignee = (etude: EtudeDetail, user: string) => call<EtudeDetail>(`${ETUDES}.set_etude_assignee`, { name: etude.name, modified: etude.modified, user }, true)

const PIECES = 'aurescrm.api.bureau_etudes_pieces'
type EtudeVersion = Pick<EtudeDetail, 'name' | 'modified'>
const versionOf = (etude: EtudeVersion) => ({ name: etude.name, modified: etude.modified })

export const getEtudePieces = (name: string) => call<EtudePieces>(`${PIECES}.get_etude_pieces`, { name })
export const getEtudeImpositions = (name: string) => call<ImpositionRow[]>(`${PIECES}.get_etude_impositions`, { name })
export const getEtudeMachines = (name: string) => call<MachineRow[]>(`${PIECES}.get_etude_machines`, { name })
export const getTraceReferences = (name: string) => call<TraceReference[]>(`${PIECES}.get_trace_references`, { name })
export const getClicheOptions = (name: string) => call<ClicheOptions>(`${PIECES}.get_cliche_options`, { name })
export const saveTrace = (etude: EtudeVersion, values: { dimensions: string; points_colle: number; confirm_bat: number }) => call<SaveTraceResult>(`${PIECES}.save_trace`, { ...versionOf(etude), ...values }, true)
export const duplicateTrace = (etude: EtudeVersion, values: { source: string; dimensions: string; points_colle: number; with_impositions: number; confirm_bat: number }) => call<SaveTraceResult>(`${PIECES}.duplicate_trace`, { ...versionOf(etude), ...values }, true)
export const newTraceVersion = (etude: EtudeVersion, values: { desc_changements: string; dimensions: string; points_colle: number; confirm_bat: number; copy_file: number }) => call<SaveTraceResult>(`${PIECES}.new_trace_version`, { ...versionOf(etude), ...values }, true)
export const chooseImposition = (etude: EtudeVersion, imposition: string) => call<PiecesResult>(`${PIECES}.choose_imposition`, { ...versionOf(etude), imposition }, true)
export const saveImposition = (etude: EtudeVersion, values: { laize_pal: string; format_laize_palette: string; format_imp: string; nbr_poses: string; taux_chutes: string; imposition?: string }) => call<PiecesResult>(`${PIECES}.save_imposition`, { ...versionOf(etude), ...values }, true)
export const setEtudeMachine = (etude: EtudeVersion, machine: string) => call<PiecesResult>(`${PIECES}.set_etude_machine`, { ...versionOf(etude), machine }, true)
export const setEtudeObservations = (etude: EtudeVersion, text: string) => call<PiecesResult>(`${PIECES}.set_etude_observations`, { ...versionOf(etude), text }, true)
export const setPieceFile = (etude: EtudeVersion, piece: string, file_url: string) => call<PiecesResult>(`${PIECES}.set_piece_file`, { ...versionOf(etude), piece, file_url }, true)
export const linkExistingPieces = (etude: EtudeVersion) => call<PiecesResult>(`${PIECES}.link_existing_pieces`, versionOf(etude), true)
export const savePlanFlexo = (etude: EtudeVersion, values: { dimensions: string; laize: string; sens_der: string }) => call<PiecesResult>(`${PIECES}.save_plan_flexo`, { ...versionOf(etude), ...values }, true)
export const createCliche = (etude: EtudeVersion, values: { laize: string; nbr_couleurs: string; developpement: string; hauteur_cliche: string; site_prod: string }) => call<PiecesResult>(`${PIECES}.create_cliche`, { ...versionOf(etude), ...values }, true)

/** Atelier d'imposition : les règles du bureau d'un côté, le moteur tel quel de l'autre. */
const ATELIER = 'aurescrm.api.bureau_atelier'
const MOTEUR = 'aurescrm.imposition.api'
export const getAtelier = (etude?: string, calcul?: string, trace?: string) => call<AtelierData>(`${ATELIER}.get_atelier`, { etude, calcul, trace })
export const getAtelierCalcul = (calcul: string) => call<AtelierCalcul>(`${ATELIER}.get_atelier_calcul`, { calcul })
export const getSupportFormats = (support: string) => call<{ grammage: number; pont_mini: number; prix_tonne?: number; formats: AtelierFormat[] }>(`${ATELIER}.get_support_formats`, { support })
export const previewGabarit = (values: { modele: string; longueur: number; largeur: number; hauteur: number; support?: string | null }) => call<GabaritApercu>(`${ATELIER}.preview_gabarit`, values)
export const createGabarit = (values: { modele: string; longueur: number; largeur: number; hauteur: number; support?: string | null }) => call<{ file_url: string }>(`${ATELIER}.create_gabarit`, values, true)
export const groupCandidates = (etude: string) => call<{ support: string | null; etudes: GroupCandidate[] }>(`${ATELIER}_groupage.group_candidates`, { etude })
export const simulateGroup = (values: { etude: string; calcul: string; membres: { etude: string; poses: number }[]; formats: object[]; lisiere: number; pince: number; marge_arriere: number }) =>
	call<GroupResult>(`${ATELIER}_groupage.simulate_group`, { ...values, membres: JSON.stringify(values.membres), formats: JSON.stringify(values.formats) }, true)
export const createGroupImposition = (values: { etude: string; calcul: string; membres: { etude: string; poses: number }[]; laize: number; depl: number; lisiere: number; pince: number; marge_arriere: number }) =>
	call<{ groupage: string; impositions: { etude: string; imposition: string }[]; nb_feuilles: number }>(`${ATELIER}_groupage.create_group_imposition`, { ...values, membres: JSON.stringify(values.membres) }, true)
export const saveAtelierTiers = (calcul: string, values: { paliers: number[]; prix_tonne: number; grammage: number; refente: object }) => call<{ saved: boolean }>(`${ATELIER}.save_atelier_tiers`, { calcul, paliers: JSON.stringify(values.paliers), prix_tonne: values.prix_tonne, grammage: values.grammage, refente: JSON.stringify(values.refente) }, true)
export const prepareAtelier = (values: object) => call<AtelierCalcul>(`${ATELIER}.prepare_atelier`, { values: JSON.stringify(values) }, true)
export const runAtelier = (values: object) => call<AtelierCalcul>(`${ATELIER}.run_atelier`, { values: JSON.stringify(values) }, true)
export const createAtelierImposition = (etude: string, calcul: string, scenario_idx: number) => call<{ imposition: string; remplacee: string | null; avertissement: string | null; taux_chutes: number }>(`${ATELIER}.create_atelier_imposition`, { etude, calcul, scenario_idx }, true)
export const proposeFormats = (calcul: string, values: object) => call<PropositionResult>(`${ATELIER}.propose_formats`, { calcul, ...values })
export const getRollCuts = (calcul: string, values: object) => call<Scenario[]>(`${ATELIER}.get_roll_cuts`, { calcul, ...values })
export const simulateFormat = (calcul: string, values: object) => call<{ scenario: Scenario | null; scenarios?: Scenario[]; message?: string }>(`${MOTEUR}.simuler`, { calcul, ...values })
export const keepAtelierScenario = (calcul: string, scenario: object) => call<{ idx: number }>(`${MOTEUR}.enregistrer_scenario`, { calcul, scenario: JSON.stringify(scenario) }, true)
export const exportAtelier = (calcul: string, scenarios: Scenario[], format_export: string) => call<{ file_url: string; file_name: string }>(`${MOTEUR}.exporter_simulations`, { calcul, scenarios: JSON.stringify(scenarios), format_export }, true)

export function etudeActivity(name: string): ActivityApi {
	return {
		load: () => call<ActivityFeedData>(`${ETUDES}.get_etude_activity`, { name }),
		add: (text, mentions) => call<ActivityFeedData>(`${ETUDES}.add_etude_comment`, { name, text, mentions }, true),
		update: (comment, text, mentions) => call<ActivityFeedData>(`${ETUDES}.update_etude_comment`, { name, comment, text, mentions }, true),
		remove: (comment) => call<ActivityFeedData>(`${ETUDES}.delete_etude_comment`, { name, comment }, true),
		mentionCandidates: () => call<Mention[]>(`${BUREAU}.get_mention_candidates`),
	}
}

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

type ListPaging = { start?: number; pageLength?: number; sort?: string; direction?: string }
const listParams = (view: string, conditions: Condition[], search: string, paging: ListPaging) => ({
	view,
	conditions: conditionsForServer(conditions),
	search: search.trim() || undefined,
	start: paging.start,
	page_length: paging.pageLength,
	sort: paging.sort,
	direction: paging.direction,
})
function recordActivity(module: string, noun: string, name: string): ActivityApi {
	return {
		load: () => call<ActivityFeedData>(`${module}.get_${noun}_activity`, { name }),
		add: (text, mentions) => call<ActivityFeedData>(`${module}.add_${noun}_comment`, { name, text, mentions }, true),
		update: (comment, text, mentions) => call<ActivityFeedData>(`${module}.update_${noun}_comment`, { name, comment, text, mentions }, true),
		remove: (comment) => call<ActivityFeedData>(`${module}.delete_${noun}_comment`, { name, comment }, true),
		mentionCandidates: () => call<Mention[]>(`${BUREAU}.get_mention_candidates`),
	}
}

/** Tracés : liste, fiche et versions. */
const TRACES = 'aurescrm.api.bureau_traces'
type TraceVersionRef = Pick<TraceDetail, 'name' | 'modified'>
export const getTraces = (view: TraceView, conditions: Condition[], search: string, paging: ListPaging = {}) => call<TracesResponse>(`${TRACES}.get_traces`, listParams(view, conditions, search, paging))
export const getTraceOptions = () => call<TraceOptions>(`${TRACES}.get_trace_options`)
export const getTrace = (name: string) => call<TraceDetail>(`${TRACES}.get_trace`, { name })
export function analyzeTracePdf(file: File) {
	const form = new FormData()
	form.append('file', file, file.name)
	return callForm<TraceAnalysis>(`${TRACES}.analyze_trace_pdf`, form)
}
export const getTracePreview = (name: string) => call<TracePreview | null>(`${TRACES}.get_trace_preview`, { name })
export const createTraceVersion = (trace: TraceVersionRef, values: { desc_changements: string; dimensions: string; points_colle: number; confirm_bat: number; copy_file: number }) =>
	call<TraceVersionResult | { confirmation: BatConfirmation }>(`${TRACES}.create_trace_version`, { name: trace.name, modified: trace.modified, ...values }, true)
export const setTraceFile = (trace: TraceVersionRef, file_url: string) => call<TraceDetail>(`${TRACES}.set_trace_file`, { name: trace.name, modified: trace.modified, file_url }, true)
export const traceActivity = (name: string) => recordActivity(TRACES, 'trace', name)

/** Impositions : liste et fiche, en lecture ; le choix de l'idéale. */
const IMPOSITIONS = 'aurescrm.api.bureau_impositions'
type ImpositionRef = Pick<ImpositionDetail, 'name' | 'modified'>
export const getImpositions = (view: ImpositionView, conditions: Condition[], search: string, paging: ListPaging = {}) => call<ImpositionsResponse>(`${IMPOSITIONS}.get_impositions`, listParams(view, conditions, search, paging))
export const getImpositionOptions = () => call<ImpositionOptions>(`${IMPOSITIONS}.get_imposition_options`)
export const getImposition = (name: string) => call<ImpositionDetail>(`${IMPOSITIONS}.get_imposition`, { name })
export const setImpositionIdeale = (imposition: ImpositionRef) => call<ImpositionDetail>(`${IMPOSITIONS}.set_imposition_ideale`, { name: imposition.name, modified: imposition.modified }, true)
export const setImpositionAuto = (imposition: ImpositionRef) => call<ImpositionDetail>(`${IMPOSITIONS}.set_imposition_auto`, { name: imposition.name, modified: imposition.modified }, true)
export const impositionActivity = (name: string) => recordActivity(IMPOSITIONS, 'imposition', name)
