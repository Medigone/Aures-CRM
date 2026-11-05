/** File, tickets et actions. Les règles restent côté serveur (aurescrm/api/bureau.py). */
import type { ActivityApi, ActivityFeedData, Mention } from '@shared/activity'
import { call, uploadFile } from '@shared/api'
import type { BulkItem, BulkOptions, BulkResult, CandidateDemande, ClientChoice, Option, QueueResponse, QueueTicket, QueueView, References, TicketDetail, TicketFormOptions } from '@/types'
import type { ClientDetail, ClientOptions, ClientsResponse, ClientValues, ClientView, CommuneChoice } from './clients'
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

export const getBulkTags = (search: string) => call<string[]>(`${BULK}.get_bulk_tags`, { search: search.trim() || undefined })

export const searchBulkLink = (doctype: string, fieldname: string, search: string) =>
	call<Option[]>(`${BULK}.search_bulk_link`, { doctype, fieldname, search: search.trim() || undefined })

/** Joint les fichiers l'un après l'autre : un refus n'empêche pas de garder ceux déjà envoyés. */
export async function attachFiles(ticket: TicketDetail, files: File[]) {
	for (const file of files) await uploadFile(file, 'Ticket Commercial', ticket.name)
	return getTicket(ticket.name)
}

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

/** Envoie le fichier, puis le range dans la pièce administrative : un échec laisse le fichier joint au client. */
export async function attachClientPiece(client: ClientDetail, piece: string, file: File) {
	const uploaded = await uploadFile(file, 'Customer', client.name)
	return call<ClientDetail>(`${CLIENTS}.set_client_piece`, { name: client.name, modified: client.modified, piece, file_url: uploaded.file_url }, true)
}

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
