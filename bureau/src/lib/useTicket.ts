/** Chargement et écritures d'un ticket, communs à l'aperçu et à la fiche. */
import { computed, onMounted, ref, watch } from 'vue'
import { getReferences, getTicket, setAssignee } from './api'
import type { Option, TicketDetail } from '@/types'

export function useTicket(id: () => string, changed: () => void) {
	const ticket = ref<TicketDetail | null>(null)
	const error = ref('')
	const notFound = ref(false)
	const actionError = ref('')
	const notice = ref('')
	const busy = ref(false)
	const assignees = ref<Option[]>([])

	let lastRequest = 0
	async function load() {
		const request = ++lastRequest
		error.value = ''
		notFound.value = false
		try {
			const response = await getTicket(id())
			if (request === lastRequest) ticket.value = response
		} catch (e) {
			if (request !== lastRequest) return
			const status = (e as { status?: number }).status
			// Rechargement en arrière-plan raté : on garde ce qui est affiché.
			if (ticket.value && status !== 404) return
			ticket.value = null
			if (status === 404) notFound.value = true
			else error.value = (e as Error).message
		}
	}
	watch(
		id,
		() => {
			ticket.value = null
			actionError.value = ''
			notice.value = ''
			load()
		},
		{ immediate: true },
	)
	onMounted(async () => {
		try {
			assignees.value = (await getReferences()).assignees
		} catch {
			/* la liste reste vide : « Me l'attribuer » et le Desk restent disponibles */
		}
	})

	/** Une écriture à la fois. La saisie en cours reste dans les cartes tant que le serveur ne l'a pas acceptée. */
	async function perform(action: () => Promise<TicketDetail>) {
		if (busy.value) return false
		busy.value = true
		actionError.value = ''
		notice.value = ''
		const request = ++lastRequest
		try {
			const response = await action()
			if (request === lastRequest) ticket.value = response
			changed()
			return true
		} catch (e) {
			actionError.value = (e as Error).message
			// Le refus peut venir d'un changement fait ailleurs : l'écran repart du serveur.
			await load()
			changed()
			return false
		} finally {
			busy.value = false
		}
	}

	/** Changement arrivé par le temps réel. Pendant une écriture, c'est sa réponse qui fera foi. */
	function refresh(message = '') {
		if (busy.value) return
		if (message) notice.value = message
		load()
	}

	const isClosed = computed(() => ['Terminé', 'Annulé'].includes(ticket.value?.status || ''))
	const followIndex = computed(() => {
		const value = ticket.value
		if (!value) return 0
		return value.current_step ?? value.steps.length - 1
	})
	const urgencePending = computed(() => ticket.value?.statut_demande_urgence === 'En attente' && !isClosed.value)

	const banner = computed(() => {
		const value = ticket.value
		if (!value) return null
		if (value.status === 'Pending') return { text: 'Ticket en pause : reprenez-le pour continuer.', style: 'tone-violet' }
		if (value.status === 'Blocage Créance') {
			const allowed = value.actions.includes('Débloquer Créance')
			const motif = value.motif_blocage_creance ? `Blocage créance : ${value.motif_blocage_creance}` : 'Blocage créance.'
			return { text: allowed ? `${motif} La créance est autorisée : débloquez le ticket pour continuer.` : motif, style: 'bg-surface-red-2 text-ink-red-3' }
		}
		if (value.status === 'Terminé') return { text: 'Ticket terminé : consultation seule.', style: 'bg-surface-green-2 text-ink-green-3' }
		if (value.status === 'Annulé') return { text: 'Ticket annulé : consultation seule.', style: 'bg-surface-gray-3 text-ink-gray-7' }
		return null
	})

	const assigneeOptions = computed<Option[]>(() => {
		const options = [...assignees.value]
		const add = (value?: string | null, label?: string | null) => {
			if (value && !options.some((option) => option.value === value)) options.push({ value, label: label || value })
		}
		add(ticket.value?.assigne_a, ticket.value?.assigne_a_nom)
		add(window.user, window.user_fullname)
		return options
	})
	const canAssign = computed(() => Boolean(ticket.value?.can_write) && !isClosed.value)
	function assign(user: string) {
		const value = ticket.value
		if (value && user && user !== value.assigne_a) perform(() => setAssignee(value, user))
	}

	return { ticket, error, notFound, actionError, notice, busy, load, perform, refresh, isClosed, followIndex, urgencePending, banner, assigneeOptions, canAssign, assign }
}
