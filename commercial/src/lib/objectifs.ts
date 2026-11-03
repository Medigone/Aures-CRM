/** Affichage des objectifs Pilotage Commercial : libellés, valeurs selon l'unité, progression. */
import { formatMoney } from '@/lib/text'
import type { CibleObjectif, Visite } from '@/types'

export const METRIC_LABELS: Record<string, string> = {
	revenue: "Chiffre d'affaires",
	visits: 'Visites',
	new_customers: 'Nouveaux clients',
	coverage: 'Couverture du portefeuille',
	conversion: 'Taux de conversion',
}

export const PERIOD_LABELS: Record<string, string> = { Monthly: 'Ce mois', Quarterly: 'Ce trimestre', Yearly: 'Cette année' }

export function formatMetric(value: number | null | undefined, unit?: string | null): string {
	if (value == null) return '—'
	if (unit === 'currency') return formatMoney(value)
	if (unit === 'percent') return `${Math.round(value)} %`
	return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)
}

/** Avancement en % (borné à 100 pour la barre ; la valeur réelle reste affichée à côté). */
export function progressOf(cible: Pick<CibleObjectif, 'target_value' | 'achieved_value' | 'achievement_pct'>): number {
	if (cible.achievement_pct != null && cible.achievement_pct > 0) return Math.min(100, Math.round(cible.achievement_pct))
	if (!cible.target_value) return 0
	return Math.min(100, Math.round(((cible.achieved_value || 0) / cible.target_value) * 100))
}

/** Visites terminées sur l'appareil depuis `from` (YYYY-MM-DD), y compris celles pas encore envoyées. */
export function visitsDoneSince(visites: Visite[], from: string): number {
	return visites.filter((v) => v.status === 'Terminé' && v.date >= from).length
}
