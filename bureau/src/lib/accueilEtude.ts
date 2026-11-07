/** Accueil du poste Étude : ce que renvoie le serveur et les titres de la file. Sans composant ni appel serveur. */
import type { AccueilScope, AccueilStage, DataGap } from './accueil'
import type { EtudeRow } from './etudes'

export type EtudeGroupKey = 'urgent' | 'ready' | 'start' | 'missing'

export interface EtudeAccueilRow extends EtudeRow {
	manque: string[]
	idle_days: number
	group: EtudeGroupKey
	action: { kind: 'run' | 'link' | 'open'; label: string; action?: string }
}

export interface EtudeGroup {
	key: EtudeGroupKey
	total: number
	rows: EtudeAccueilRow[]
}

export interface EtudeWatch extends Omit<DataGap, 'total' | 'conditions'> {
	total: number | null
	conditions?: DataGap['conditions'] | null
	alert?: boolean
}

export interface EtudeAccueilData {
	stages: AccueilStage[]
	queue: EtudeGroup[]
	counts: Record<AccueilScope, number>
	can_conclude: boolean
	both: boolean
	watch: EtudeWatch[]
	max_rows: number
}

export function etudeGroupTitle(key: EtudeGroupKey, canConclude: boolean) {
	if (key === 'urgent') return { title: 'Urgentes', hint: 'à traiter avant le reste' }
	if (key === 'ready') return canConclude ? { title: 'Prêtes à conclure', hint: 'tout ce qui est exigé est là' } : { title: 'Prêtes, en attente du responsable', hint: 'tout ce qui est exigé est là' }
	if (key === 'start') return { title: 'À démarrer', hint: 'pas encore prises en charge' }
	return { title: 'Pièces manquantes', hint: 'à compléter avant de conclure' }
}

/** La fin de la deuxième ligne : ce qu'il reste à renseigner. */
export function etudeRowDetail(row: Pick<EtudeAccueilRow, 'designation' | 'procede' | 'quantite' | 'manque'>, both: boolean) {
	const parts = [row.designation ?? '', `${row.quantite.toLocaleString('fr-FR')} ex.`].filter(Boolean)
	if (both && row.procede) parts.unshift(row.procede)
	if (row.manque.length) parts.push(`manque ${row.manque.join(', ').toLowerCase()}`)
	return parts.join(' · ')
}
