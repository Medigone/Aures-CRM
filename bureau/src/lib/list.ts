/** Règles de la liste des tickets : colonnes, tri, cellules et actions groupées. */
import type { BulkResult, QueueTicket } from '@/types'

export interface Sort {
	key: string
	dir: 'asc' | 'desc'
}

const RANK: Record<string, number> = { U0: 0, U1: 1, U2: 2, U3: 3 }

/** Une demande d'urgence en attente compte déjà, comme dans le tri du serveur. */
function urgenceLevel(ticket: QueueTicket) {
	const level = RANK[ticket.niveau_urgence] ?? 0
	return ticket.urgence_en_attente ? Math.max(level, RANK[ticket.niveau_urgence_demande || ''] ?? 0) : level
}

// Ordre choisi pour le tiroir : il couvre la droite de la liste, l'essentiel reste donc à gauche.
export const COLUMNS: { key: string; label: string; value: (ticket: QueueTicket) => string | number }[] = [
	{ key: 'client', label: 'Client', value: (ticket) => ticket.client },
	{ key: 'type', label: 'Type', value: (ticket) => ticket.request_type },
	{ key: 'status', label: 'Statut', value: (ticket) => ticket.status },
	{ key: 'urgence', label: 'Urg.', value: urgenceLevel },
	{ key: 'echeance', label: 'Échéance', value: (ticket) => ticket.echeance || '9999' },
	{ key: 'step', label: 'Étape', value: ({ step }) => (step.current === null ? 99 : step.current / step.total) },
	{ key: 'name', label: 'N° ticket', value: (ticket) => ticket.name },
	{ key: 'creance', label: 'Créance', value: (ticket) => ticket.statut_creance || '' },
	{ key: 'commercial', label: 'Commercial', value: (ticket) => ticket.commercial || '' },
	{ key: 'assigne', label: 'Pris en charge', value: (ticket) => ticket.assigne_a_nom || '~' },
]

/** Sans tri choisi, l'ordre du serveur reste : urgence, puis échéance. */
export function sortTickets(tickets: QueueTicket[], sort: Sort | null) {
	const column = sort && COLUMNS.find((item) => item.key === sort.key)
	if (!column) return tickets
	const sign = sort!.dir === 'asc' ? 1 : -1
	return [...tickets].sort((a, b) => {
		const x = column.value(a)
		const y = column.value(b)
		return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr')) * sign
	})
}

/** Un clic trie, le deuxième inverse, le troisième revient à l'ordre du serveur. */
export function nextSort(sort: Sort | null, key: string): Sort | null {
	if (sort?.key !== key) return { key, dir: 'asc' }
	return sort.dir === 'asc' ? { key, dir: 'desc' } : null
}

export function stepText({ step }: QueueTicket) {
	return step.current === null ? step.label : `${step.current + 1}/${step.total} ${step.label}`
}

export function stepPercent({ step }: QueueTicket) {
	return step.total ? Math.round((step.done / step.total) * 100) : 0
}

/** La créance ne concerne que les bons de commande. */
export function creanceText(ticket: QueueTicket) {
	return ticket.request_type === 'Bon de commande' ? ticket.statut_creance || 'Non vérifiée' : '—'
}

export const isOpen = (ticket: QueueTicket) => !['Terminé', 'Annulé'].includes(ticket.status)
export const canStart = (ticket: QueueTicket) => ticket.status === 'Nouveau'
export const canPause = (ticket: QueueTicket) => ticket.status === 'En Cours'

/** « 3 tickets attribués à Amine · 1 non traité » */
export function bulkSummary(result: BulkResult, one: string, many: string) {
	const done = result.done.length
	const parts = done ? [`${done} ${done > 1 ? many : one}`] : []
	const skipped = result.skipped.length
	if (skipped) parts.push(`${skipped} non traité${skipped > 1 ? 's' : ''}`)
	return parts.join(' · ')
}
