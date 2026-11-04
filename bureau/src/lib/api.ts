/** File, tickets et actions. Les règles restent côté serveur (aurescrm/api/bureau.py). */
import { call, uploadFile } from '@shared/api'
import type { BulkResult, CandidateDemande, QueueResponse, QueueTicket, QueueView, References, TicketDetail } from '@/types'
import type { Condition } from './filters'
import { conditionsForServer } from './filters'

const BUREAU = 'aurescrm.api.bureau'
const TICKET = 'aurescrm.aures_crm.doctype.ticket_commercial.ticket_commercial'

export const getQueue = (view: QueueView, conditions: Condition[], search: string) =>
	call<QueueResponse>(`${BUREAU}.get_queue`, { view, conditions: conditionsForServer(conditions), search: search.trim() || undefined })

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

/** Une action groupée enregistre jusqu'à 100 tickets : elle a droit à plus de temps qu'une requête ordinaire. */
const BULK_TIMEOUT_MS = 120 * 1000
const bulkItems = (tickets: QueueTicket[]) => tickets.map(({ name, modified }) => ({ name, modified }))

export const bulkAssign = (tickets: QueueTicket[], user: string) =>
	call<BulkResult>(`${BUREAU}.bulk_assign`, { items: bulkItems(tickets), user }, true, BULK_TIMEOUT_MS)

export const bulkAction = (tickets: QueueTicket[], name: string) =>
	call<BulkResult>(`${BUREAU}.bulk_action`, { items: bulkItems(tickets), action: name }, true, BULK_TIMEOUT_MS)

/** Joint les fichiers l'un après l'autre : un refus n'empêche pas de garder ceux déjà envoyés. */
export async function attachFiles(ticket: TicketDetail, files: File[]) {
	for (const file of files) await uploadFile(file, 'Ticket Commercial', ticket.name)
	return getTicket(ticket.name)
}
