/** Pièces d'une étude dans sa fiche : ce que renvoie le serveur et les textes qui en découlent. */
import { formatDay } from './display'
import type { EtudeDetail } from './etudes'
import { formatQuantity } from './etudes'
import type { Option } from '@/types'

export interface PieceFile {
	url: string
	name: string
}
export interface PieceAlert {
	tone: 'red' | 'amber'
	text: string
}
export interface TracePiece {
	name: string | null
	linked: boolean
	can_edit: boolean
	can_create: boolean
	dimensions?: string | null
	points_colle?: number
	fichier?: PieceFile | null
	ecart?: boolean
}
export interface SheetDrawing {
	laize: number
	developpement: number
	n_col: number
	n_rang: number
	pas_laize: number
	pas_depl: number
	lisiere: number
	pince: number
	coupe: string
	rainage: string | null
	/** Les poses placées par le moteur, [x, y, rotation] depuis la lisière et la pince. Absentes d'un ancien serveur. */
	poses?: [number, number, number][]
	pose_l?: number
	pose_d?: number
	/** « Tête-bêche en colonnes, décalage 12,5 mm », vide pour une grille droite. */
	motif?: string
}
export interface ImpositionRow {
	name: string
	format: string | null
	format_imp: string | null
	laize_pal: string | null
	format_laize_palette: string | null
	nbr_poses: number
	taux_chutes: number | null
	ideale: boolean
	origine: string
	calcul: string | null
	feuilles: number
	fichier: PieceFile | null
	alertes: PieceAlert[]
	dessin?: SheetDrawing | null
}
export interface ImpositionPiece {
	can_edit: boolean
	can_create: boolean
	atelier: boolean
	nombre: number
	courante: (Partial<ImpositionRow> & { name: string }) | null
}
export interface MachinePiece {
	can_change: boolean
	name: string | null
	status?: string | null
	format?: string | null
	passages?: number
	charge?: number
	alertes?: PieceAlert[]
	detail?: string | null
}
export interface MachineRow {
	name: string
	nom: string
	modele: string | null
	status: string
	format: string | null
	couleurs: number
	vernis: boolean
	passages: number
	passages_raison: string | null
	charge: number
	alertes: PieceAlert[]
}
export interface CotationsOrigin {
	bat: string
	bat_par: string | null
	bat_le: string | null
	etat: 'bat' | 'trace' | 'fiche'
	trace: string | null
	trace_par: string | null
	trace_le: string | null
}
export interface FlexoPiece {
	name: string | null
	linked: boolean
	can_edit: boolean
	can_create: boolean
	status?: string | null
	dimensions?: string | null
	laize?: string | null
	sens_der?: string | null
	fichier?: PieceFile | null
}
export interface EtudePieces {
	travail: boolean
	ouverte: boolean
	manque: string[]
	trace: TracePiece
	imposition?: ImpositionPiece
	machine?: MachinePiece
	nbr_feuilles?: number
	cotations?: { valeur: string | null; origine: CotationsOrigin | null }
	plan_flexo?: FlexoPiece
	maquette?: FlexoPiece
	cliche?: FlexoPiece
}
export interface BatConfirmation {
	actuelles: string
	nouvelles: string
	par: string | null
	le: string | null
}
export interface PiecesResult {
	etude: EtudeDetail
	pieces: EtudePieces
	piece?: string
	fichier_copie?: boolean
	impositions?: number
}
export type SaveTraceResult = PiecesResult | { confirmation: BatConfirmation }
export interface TraceReference {
	name: string
	article: string
	designation: string
	dimensions: string | null
	points_colle: number | null
	impositions: number
}
export interface ClicheOptions {
	developpements: Option[]
	sites: Option[]
}

const MACHINE_LABELS: Record<string, string> = { Operationnelle: 'Opérationnelle', 'En Maintenance': 'En maintenance', 'En Panne': 'En panne' }
export const machineStatusLabel = (status?: string | null) => (status ? (MACHINE_LABELS[status] ?? status) : '')
export const machineStatusTone = (status?: string | null) => (status === 'Operationnelle' ? 'green' : 'orange') as 'green' | 'orange'

/** Dimensions pour la lecture : 72x46.5x107 devient 72 × 46,5 × 107. */
export const dimensionsLabel = (value?: string | null) => (value ? value.replace(/\s*[x×]\s*/gi, ' × ').replace(/\./g, ',') : '')
export const percentLabel = (value?: number | null) => (value == null ? '—' : `${String(value).replace('.', ',')} %`)
export const quantityLabel = (value?: number | null) => formatQuantity(Math.ceil(value ?? 0))

/** Forme comparable de cotations, comme le serveur : ni mm, ni espaces, x et point partout. */
export function sameCotations(left?: string | null, right?: string | null) {
	const plain = (value?: string | null) => (value ?? '').toLowerCase().replace(/mm/g, '').replace(/\s/g, '').replace(/×/g, 'x').replace(/,/g, '.')
	return plain(left) === plain(right)
}

/** L'historique gardé sur l'article : importées d'un BAT, et par qui elles ont été modifiées depuis. */
export function cotationsOriginText(origin?: CotationsOrigin | null) {
	if (!origin) return ''
	const imported = [`Importées du BAT (${dimensionsLabel(origin.bat)})`, origin.bat_par && `par ${origin.bat_par}`, origin.bat_le && `le ${formatDay(origin.bat_le)}`].filter(Boolean).join(' ')
	if (origin.etat === 'bat') return `${imported}.`
	if (origin.etat === 'fiche') return `${imported}, modifiées depuis sur la fiche.`
	return `${imported}, puis modifiées ${[origin.trace_par && `par ${origin.trace_par}`, origin.trace_le && `le ${formatDay(origin.trace_le)}`].filter(Boolean).join(' ')} depuis le tracé ${origin.trace}.`
}

export function batConfirmationText(confirmation: BatConfirmation) {
	const from = [confirmation.par && `par ${confirmation.par}`, confirmation.le && `le ${formatDay(confirmation.le)}`].filter(Boolean).join(' ')
	return `Les cotations ${dimensionsLabel(confirmation.actuelles)} de cet article viennent du BAT importé${from ? ` ${from}` : ''}. Ce tracé les remplace par ${dimensionsLabel(confirmation.nouvelles)}.`
}

/** Bandeau de la carte : ce qu'exige le workflow, ou à qui revient la suite. */
export function piecesBanner(etude: Pick<EtudeDetail, 'status' | 'actions'>, pieces: EtudePieces): { tone: 'orange' | 'blue'; text: string } | null {
	if (etude.status !== 'En étude') return null
	if (pieces.manque.length) return { tone: 'orange', text: `Pour passer à Réalisable, il manque : ${pieces.manque.join(', ').toLowerCase()}.` }
	if (pieces.plan_flexo) {
		const missing = [!pieces.plan_flexo.name && 'plan', !pieces.maquette?.name && 'maquette activée', !pieces.cliche?.name && 'cliché'].filter(Boolean)
		return missing.length ? { tone: 'blue', text: `Le workflow Flexo n'exige aucune pièce pour conclure. Manque encore : ${missing.join(', ')}.` } : null
	}
	if (!etude.actions.includes('Réalisable')) return { tone: 'blue', text: "Tout ce qui est exigé est là. Le responsable d'étude peut conclure." }
	return null
}

/** Valeurs de départ de la fenêtre d'imposition : le format s'écrit 720x450, comme le contrôle du serveur l'attend. */
export function impositionFormValues(row?: Partial<ImpositionRow> | null) {
	const sheet = (row?.format ?? '').replace(/\s*×\s*/g, 'x').replace(/,/g, '.')
	return {
		laize_pal: row?.laize_pal || 'Laize',
		format_laize_palette: row?.format_laize_palette || sheet.split('x')[0] || '',
		format_imp: sheet,
		nbr_poses: row?.nbr_poses ? String(row.nbr_poses) : '',
		taux_chutes: row?.taux_chutes != null ? String(row.taux_chutes).replace('.', ',') : '',
	}
}
