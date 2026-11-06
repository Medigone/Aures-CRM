/** Accueil du poste de bureau : ce que renvoie le serveur et sa mise en forme. Sans composant ni appel serveur. */
import { statusDisplay, statusTone } from '@shared/status'
import { conditionsQuery, type Condition } from './filters'

export type AccueilScope = 'team' | 'mine'
export type RowActionKind = 'open' | 'run' | 'assign' | 'demande'
export type QueueGroupKey = 'decide' | 'take' | 'transform'

export interface StagePart {
	status: string
	count: number
}

export interface AccueilStage {
	key: string
	label: string
	to: string | null
	href: string | null
	third_party: boolean
	late: number
	parts: StagePart[]
	total: number
	stale: number
}

export interface AccueilRow {
	name: string
	modified: string
	request_type: string
	client: string
	commercial: string | null
	status: string
	urgence: string | null
	assigne_a: string | null
	assigne_a_nom: string | null
	mine: boolean
	echeance: string | null
	is_late: boolean
	idle_days: number
	action: { kind: RowActionKind; label: string; action?: string; reason?: string }
}

export interface QueueGroup {
	key: QueueGroupKey
	total: number
	rows: AccueilRow[]
}

type GapCondition = Pick<Condition, 'doctype' | 'field' | 'op' | 'value'>

export interface DataGap {
	key: string
	label: string
	count: number
	total: number
	conditions?: GapCondition[]
	view?: string
}

export interface DocumentGap {
	key: string
	label: string
	count: number
	href?: string
	to?: { name: string }
	conditions?: GapCondition[]
}

export interface Completeness {
	filled: number
	expected: number
	percent: number
}

export interface AccueilData {
	stale_days: number
	stages: AccueilStage[]
	trends: {
		months: { month: string; received: number; closed: number }[]
		ages: { label: string; count: number }[]
		completeness: { clients: Completeness | null; articles: Completeness | null }
	} | null
	queue: QueueGroup[]
	updates: { total: number; rows: { name: string; client: string; status: string; idle_days: number }[] }
	clients: { total: number; rows: DataGap[] } | null
	articles: { total: number; rows: DataGap[] } | null
	documents: DocumentGap[]
	max_rows: number
}

type StatusToneName = 'red' | 'amber' | 'orange' | 'green' | 'blue' | 'gray' | 'violet'

export const GROUP_TITLES: Record<QueueGroupKey, { title: string; hint: string }> = {
	decide: { title: 'À décider', hint: 'une décision vous attend' },
	take: { title: 'À prendre en charge', hint: 'requêtes pas encore démarrées' },
	transform: { title: 'À transformer en document', hint: 'démarrés, aucune demande créée' },
}

/** En pause sur un ticket : même teinte que `TicketStatus.vue`, le seul statut qui change selon le document. */
export function partPill(part: Pick<StagePart, 'status'>) {
	if (part.status === 'Pending') return { label: 'En pause', tone: 'violet' as StatusToneName }
	return { label: statusDisplay(part.status), tone: statusTone(statusDisplay(part.status)).replace('tone-', '') as StatusToneName }
}

/** La couleur de l'anneau. L'orange a sa propre nuance de marque ; les autres reprennent l'encre de la pastille. */
export function partColor(part: Pick<StagePart, 'status'>) {
	const { tone } = partPill(part)
	return tone === 'orange' ? 'var(--tone-orange-bar)' : `var(--tone-${tone}-ink)`
}

const RING_RADIUS = 34
const RING_GAP = 2

export interface RingSegment extends StagePart {
	color: string
	dash: string
	offset: string
}

/** Les parts d'un anneau, séparées par un petit espace. Une part seule en fait le tour complet. */
export function ringSegments(parts: StagePart[]): RingSegment[] {
	const total = parts.reduce((sum, part) => sum + part.count, 0)
	if (!total) return []
	const circle = 2 * Math.PI * RING_RADIUS
	const gap = parts.length > 1 ? RING_GAP : 0
	let done = 0
	return parts.map((part) => {
		const length = (part.count / total) * circle
		const segment = {
			...part,
			color: partColor(part),
			dash: `${Math.max(length - gap, 1).toFixed(2)} ${circle.toFixed(2)}`,
			offset: (-done).toFixed(2),
		}
		done += length
		return segment
	})
}

const plural = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`

/** Le commentaire sous un donut : ce qui mérite un regard dans cette étape. */
export function stageComment(stage: Pick<AccueilStage, 'key' | 'late' | 'stale'>, staleDays: number) {
	if (stage.key === 'devis') return stage.late ? plural(stage.late, 'périmé', 'périmés') : 'Aucun devis périmé'
	if (stage.key === 'commandes') return stage.late ? `${stage.late} date de livraison dépassée` : 'Aucune livraison en retard'
	return stage.stale ? `${stage.stale} sans mouvement depuis ${staleDays} j` : 'Tout a bougé récemment'
}

function day(value: string) {
	const [, month, date] = value.split('-')
	return `${date}/${month}`
}

/** Ce que la ligne attend : l'échéance si elle existe, sinon depuis quand rien n'a bougé. */
export function waitLabel(row: Pick<AccueilRow, 'status' | 'echeance' | 'is_late' | 'idle_days'>) {
	if (row.echeance) return `échéance ${day(row.echeance)}${row.is_late ? ' dépassée' : ''}`
	if (row.status === 'Pending') return `en pause depuis ${row.idle_days} j`
	if (row.status === 'Nouveau') return `attend depuis ${row.idle_days} j`
	return `immobile depuis ${row.idle_days} j`
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function monthShort(month: string) {
	return MONTHS[Number(month.split('-')[1]) - 1] ?? month
}

export function monthLong(month: string) {
	const [year] = month.split('-')
	const name = monthShort(month)
	return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

/** Le haut de l'axe : un multiple de 5, jamais moins de 5. */
export function chartMax(values: number[]) {
	return Math.max(5, Math.ceil(Math.max(0, ...values) / 5) * 5)
}

/** Les graduations de l'axe, du haut vers le bas : quatre valeurs entières quand c'est possible. */
export function chartTicks(max: number) {
	const step = max / 3
	const ticks = [max, max - step, max - 2 * step, 0]
	return ticks.map((tick) => Math.round(tick))
}

/** Le lien d'une ligne « données » vers la liste déjà filtrée. */
export function gapRoute(name: string, gap: Pick<DataGap, 'conditions' | 'view'>) {
	if (gap.view) return { name, query: { vue: gap.view } }
	return { name, query: gap.conditions?.length ? { filtres: conditionsQuery(gap.conditions) } : {} }
}

const CHARTS_KEY = 'bureau-accueil-tendances'

export function loadChartsVisible() {
	try {
		return localStorage.getItem(CHARTS_KEY) !== 'non'
	} catch {
		return true
	}
}

export function saveChartsVisible(visible: boolean) {
	try {
		localStorage.setItem(CHARTS_KEY, visible ? 'oui' : 'non')
	} catch {
		// Un confort : la page marche sans.
	}
}
