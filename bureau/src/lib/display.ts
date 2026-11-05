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
export function stepHelp(key: string, ticket: { request_type: string; status: string; checklist: unknown[] }) {
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
			return 'Cochez cet élément dans la liste de contrôle.'
		case 'fin':
			if (closed) return 'Ce ticket est clos.'
			return ticket.checklist.length ? 'Cochez la liste de contrôle, puis terminez le ticket.' : 'Terminez le ticket une fois la demande traitée.'
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

/** Boutons du workflow : le serveur dit lesquels sont permis, l'écran grise ce qu'il sait déjà refusé. */
export function ticketActions(ticket: { actions: string[]; checklist: { checked: boolean }[] }): TicketAction[] {
	const incomplete = ticket.checklist.some((item) => !item.checked)
	return Object.keys(ACTIONS)
		.filter((action) => ticket.actions.includes(action))
		.map((action) => ({ action, ...ACTIONS[action], disabled: action === 'Terminer' && incomplete }))
}

/** Éléments de la liste de contrôle qui empêchent de terminer. */
export function missingChecklist(ticket: { actions: string[]; checklist: { label: string; checked: boolean }[] }) {
	if (!ticket.actions.includes('Terminer')) return ''
	const missing = ticket.checklist.filter((item) => !item.checked).map((item) => item.label)
	return missing.length ? `Pour terminer, cochez : ${missing.join(', ')}.` : ''
}

export function urgenceNote(level: string, requested?: string | null) {
	if (level === requested) return 'Demandé'
	return level < (requested || '') ? 'Inférieur' : 'Supérieur'
}
