/** Libellés, dates et liens affichés dans le poste de bureau. */

const STATUS_LABELS: Record<string, string> = { Pending: 'En pause' }

export function statusLabel(status?: string | null) {
	return STATUS_LABELS[status || ''] || status || ''
}

export function formatDay(value?: string | null) {
	if (!value) return ''
	const [year, month, day] = value.slice(0, 10).split('-')
	return year && month && day ? `${day}/${month}/${year}` : value
}

export function shortDay(value?: string | null) {
	return formatDay(value).slice(0, 5)
}

export function echeanceLabel(ticket: { echeance: string | null; is_late: boolean }) {
	if (!ticket.echeance) return 'Sans échéance'
	return ticket.is_late ? `Retard ${shortDay(ticket.echeance)}` : shortDay(ticket.echeance)
}

/** Lien vers le formulaire du Desk : « Sales Order » devient « sales-order ». */
export function deskUrl(doctype: string, name: string) {
	return `/app/${doctype.toLowerCase().replace(/ /g, '-')}/${encodeURIComponent(name)}`
}

export { fileExtension } from '@shared/text'

export function initials(name?: string | null) {
	const words = (name || '').trim().split(/\s+/).filter(Boolean)
	return words.length ? words.slice(0, 2).map((word) => word[0].toUpperCase()).join('') : '?'
}

/** Consigne de l'encart d'étape. */
export function stepHelp(key: string, ticket: { request_type: string; status: string; pieces: { required: boolean }[] }) {
	const closed = ticket.status === 'Terminé' || ticket.status === 'Annulé'
	switch (key) {
		case 'recu':
			return 'Le ticket est arrivé : lisez la demande du commercial.'
		case 'charge':
			return ticket.status === 'Nouveau' ? 'Démarrez le ticket pour pouvoir le traiter.' : 'Le ticket est pris en charge.'
		case 'creance':
			return ticket.status === 'Blocage Créance'
				? 'Passez la créance à OK ou Déblocage autorisé, puis débloquez le ticket.'
				: 'Vérifiez la créance du client avant toute commande.'
		case 'rappro':
			return 'Ouvrez le bon de commande, comparez-le aux devis du client, puis décidez.'
		case 'doc':
			if (ticket.request_type === 'Essai Blanc') return 'Créez le dossier essai à blanc lié à ce ticket.'
			if (ticket.request_type === 'Bon de commande') return 'Créez le document qui suit votre décision de rapprochement.'
			return 'Créez la demande de faisabilité liée à ce ticket.'
		case 'confirm':
			return 'Confirmez la demande : une étude de faisabilité sera générée par article.'
		case 'check':
			return 'Réunissez cette pièce : la carte Pièces du dossier dit ce qui manque.'
		case 'fin':
			if (closed) return 'Ce ticket est clos.'
			return ticket.pieces.some((piece) => piece.required) ? 'Réunissez les pièces du dossier, puis terminez le ticket.' : 'Terminez le ticket une fois la demande traitée.'
		default:
			return ''
	}
}

export interface TicketAction {
	action: string
	label: string
	style: 'btn-primary' | 'btn-secondary' | 'btn-danger'
	disabled: boolean
	confirm?: string
}

const ACTIONS: Record<string, Pick<TicketAction, 'label' | 'style' | 'confirm'>> = {
	Pause: { label: 'Mettre en pause', style: 'btn-secondary' },
	Démarrer: { label: 'Démarrer', style: 'btn-primary' },
	Reprendre: { label: 'Reprendre', style: 'btn-primary' },
	'Débloquer Créance': { label: 'Débloquer', style: 'btn-primary' },
	Terminer: { label: 'Terminer', style: 'btn-primary', confirm: 'Terminer ce ticket ?' },
	Annuler: { label: 'Annuler le ticket', style: 'btn-danger', confirm: 'Annuler ce ticket ? Cette action est définitive.' },
}

/** L'action principale selon l'étape en cours : toutes les autres restent secondaires. */
export function primaryTicketActions(stepKey?: string) {
	return ['Reprendre', ...(stepKey === 'charge' ? ['Démarrer'] : stepKey === 'creance' ? ['Débloquer Créance'] : stepKey === 'fin' ? ['Terminer'] : [])]
}

type WithPieces = { pieces: { label: string; required: boolean; state: string }[] }
const missingOf = ({ pieces }: WithPieces) => pieces.filter((piece) => piece.required && piece.state === 'missing')

/** Boutons du workflow : le serveur dit lesquels sont permis, l'écran grise ce qu'il sait déjà refusé. */
export function ticketActions(ticket: WithPieces & { actions: string[] }): TicketAction[] {
	const incomplete = missingOf(ticket).length > 0
	return Object.keys(ACTIONS)
		.filter((action) => ticket.actions.includes(action))
		.map((action) => ({ action, ...ACTIONS[action], disabled: action === 'Terminer' && incomplete }))
}

/** Les pièces qui empêchent de terminer. */
export function missingPieces(ticket: WithPieces & { actions: string[] }) {
	if (!ticket.actions.includes('Terminer')) return ''
	const missing = missingOf(ticket).map((piece) => piece.label)
	return missing.length ? `Pour terminer, il manque : ${missing.join(', ')}.` : ''
}

export function piecesProgress(ticket: WithPieces) {
	const required = ticket.pieces.filter((piece) => piece.required)
	return { total: required.length, done: required.length - missingOf(ticket).length }
}

export function urgenceNote(level: string, requested?: string | null) {
	if (level === requested) return 'Demandé'
	return level < (requested || '') ? 'Inférieur' : 'Supérieur'
}
