import { computed } from 'vue'
import { useCommercialStore } from '@/stores/commercial'
import { ticketAlerte } from '@/lib/affaires'
import { todayIso } from '@/lib/text'

/**
 * Ce qui attend le commercial hors visites et tickets du jour : décisions sur ses tickets, réclamations en retard,
 * relances de créances dues, appels à rappeler. Affiché sur la page « À traiter », compté sur la cloche de l'accueil.
 */
export function useATraiter() {
	const store = useCommercialStore()
	const today = todayIso()
	const ticketsAlerte = computed(() => store.tickets.map((t) => ({ t, alerte: ticketAlerte(t) })).filter((x) => x.alerte))
	const reclamationsRetard = computed(() => store.reclamations.filter((r) => r.status === 'En retard'))
	const relances = computed(() =>
		store.creances
			.filter((c) => c.date_prochaine_relance && c.date_prochaine_relance <= today && (c.solde_restant || 0) > 0)
			.sort((a, b) => (a.date_prochaine_relance || '').localeCompare(b.date_prochaine_relance || '')),
	)
	const rappels = computed(() =>
		store.appels
			.filter((a) => a.status === 'À Rappeler' && (!a.date_rappel || a.date_rappel.slice(0, 10) <= today))
			.sort((a, b) => (a.date_rappel || '').localeCompare(b.date_rappel || '')),
	)
	const total = computed(() => ticketsAlerte.value.length + reclamationsRetard.value.length + relances.value.length + rappels.value.length)
	return { ticketsAlerte, reclamationsRetard, relances, rappels, total }
}
