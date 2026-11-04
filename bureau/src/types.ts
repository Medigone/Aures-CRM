import type { CommentPart } from '@shared/activity'

export type QueueView = 'todo' | 'mine' | 'urgent' | 'creance' | 'closed'

export interface QueueStep {
	label: string
	/** Position de l'étape en cours ; `null` quand il n'y en a plus. */
	current: number | null
	done: number
	total: number
}

export interface QueueTicket {
	name: string
	modified: string
	client: string
	commercial: string | null
	request_type: string
	status: string
	statut_creance: string | null
	step: QueueStep
	echeance: string | null
	is_late: boolean
	niveau_urgence: string
	urgence_en_attente: boolean
	niveau_urgence_demande: string | null
	assigne_a: string | null
	assigne_a_nom: string | null
	mine: boolean
	comments: number
}

export interface QueueResponse {
	tickets: QueueTicket[]
	counts: Record<QueueView, number>
	/** Nombre de tickets de la vue, toutes pages confondues. */
	total: number
	start: number
	page_length: number
	/** Toute la vue, dans l'ordre affiché : pour aller au ticket voisin au-delà de la page. */
	names: string[]
}

/** Résultat d'une action groupée : chaque ticket est traité à part. */
export interface BulkResult {
	done: string[]
	skipped: { name: string; reason: string }[]
}

export interface Option {
	value: string
	label: string
}

export interface References {
	types: string[]
	statuses: string[]
	urgences: string[]
	creances: string[]
	assignees: Option[]
	nobody: string
}

export type StepState = 'done' | 'current' | 'paused' | 'blocked' | 'todo'

export interface Step {
	key: string
	label: string
	state: StepState
	detail: string
}

export interface TicketDocument {
	name: string
	file_name: string
	file_url: string
	owner_name: string
	creation: string
	can_remove: boolean
}

export interface CycleEtude {
	name: string
	status: string
	doctype?: string
	article?: string
	item_name?: string
}

export interface CycleSalesDocument {
	doctype: string
	name: string
	status: string
	docstatus?: number
}

export interface CycleGroup {
	name: string
	status: string
	type?: string
	etudes: CycleEtude[]
	sales_documents: CycleSalesDocument[]
}

export interface CommentSummary {
	count: number
	last: { who: string; at: string; parts: CommentPart[] } | null
}

export interface TicketDetail {
	name: string
	modified: string
	can_write: boolean
	actions: string[]
	request_type: string
	status: string
	customer: string
	client: string
	commercial: string | null
	site: string | null
	priority: string | null
	echeance: string | null
	is_late: boolean
	creation_date: string | null
	assigne_a: string | null
	assigne_a_nom: string | null
	mine: boolean
	description: string | null
	niveau_urgence: string
	niveau_urgence_demande: string | null
	statut_demande_urgence: string | null
	descr_urgence: string | null
	commentaire_validation_urgence: string | null
	statut_creance: string | null
	motif_blocage_creance: string | null
	creance_verifiee_par: string | null
	decision_rapprochement: string | null
	commentaire_rapprochement: string | null
	devis_rapproche: string | null
	demande_faisabilite_rapprochee: string | null
	checklist: { fieldname: string; label: string; checked: boolean }[]
	comments: CommentSummary
	steps: Step[]
	current_step: number | null
	documents: TicketDocument[]
	cycle: { demandes: CycleGroup[]; dossiers: CycleGroup[] }
	commande: { name: string; status: string; docstatus: number } | null
}

export interface CandidateQuotation {
	name: string
	transaction_date: string | null
	status: string
	grand_total: number
	currency: string
	command_analysis: { custom_status: string; percentage: number }
	items: { item_code: string; item_name: string; qty: number; uom: string }[]
}

export interface CandidateDemande {
	name: string
	demande_status: string
	demande_type: string
	date_creation: string | null
	quotations: CandidateQuotation[]
}

/** Lance une écriture : met le ticket à jour, ou affiche le refus. Renvoie `true` si elle a réussi. */
export type Perform = (action: () => Promise<TicketDetail>) => Promise<boolean>

declare global {
	interface Window {
		can_access?: boolean
		user_fullname?: string | null
	}
}

export interface TicketFormOptions {
	types: { value: string; urgence: string }[]
	channels: string[]
	sites: Option[]
	commercials: Option[]
}

export interface ClientChoice {
	name: string
	label: string
	wilaya: string | null
	commercial: string | null
	commercial_name: string | null
	open_tickets: number
}
