/** Atelier d'imposition : ce que renvoie le serveur et les calculs d'affichage, sans composant. */
import { formatDay } from './display'
import { dimensionsLabel, percentLabel } from './etudePieces'
import { formatQuantity } from './etudes'
import type { Option } from '@/types'

export interface AtelierFormat {
	laize: number
	depl: number
	origine: string
	libelle: string
	bobine: number
	coche: boolean
}
export interface Scenario {
	idx?: number
	retenu?: number
	libelle: string
	origine: string
	laize: number
	depl: number
	nb_poses: number
	n_col: number
	n_rang: number
	rotation: number
	taux_chutes: number
	pas_laize: number
	pas_depl: number
	trait_commun_laize: number | boolean
	trait_commun_depl: number | boolean
	reste_laize: number
	reste_depl: number
	surface_par_pose: number
	nb_feuilles: number
	tonnage: number
	alerte?: string | null
	/** Grille droite, ou motif de deux poses : la seconde retournée (tête-bêche) ou décalée (quinconce). */
	motif?: string | null
	axe_motif?: string | null
	decalage_laize?: number
	decalage_depl?: number
	pas_paire?: number
	/** Les poses placées par le moteur : x et y depuis la lisière et la pince, puis la rotation. */
	poses?: Pose[]
	/** Essai pas encore gardé : il reste sur cet écran. */
	cle?: string
}
export type Pose = [number, number, number]
export interface SilhouetteVue {
	path_coupe: string
	path_rainage: string | null
	l: number
	d: number
}
export interface AtelierCalcul {
	name: string
	fichier_trace: string | null
	statut_calcul: string | null
	developpe_l: number
	developpe_d: number
	surface_utile: number
	remplissage_bbox: number
	scenarios: Scenario[]
	formats_etudies: Omit<AtelierFormat, 'coche'>[]
	imposition_creee: string | null
	log_calcul: string | null
	bornes: { lisiere?: number; pince?: number; marge_arriere?: number } | null
	silhouette: Record<string, SilhouetteVue> | null
	cache_disponible: boolean
}
export interface AtelierPresse {
	nom: string
	laize: number
	depl: number
}
export interface AtelierEtude {
	name: string
	status: string
	designation: string
	client_label: string
	quantite: number
	trace: string | null
	trace_fichier: string | null
	trace_lisible: boolean
	imposition: string | null
	presse: AtelierPresse | null
	ecriture: boolean
}
export interface AtelierReglages {
	pont: number
	sens_fibre: string
	motifs: string
	trait_commun: number
	quantite: number
	lisiere: number
	pince: number
	marge_arriere: number
}
export interface AtelierHistorique {
	name: string
	creation: string
	statut_calcul: string | null
	developpe_l: number | null
	developpe_d: number | null
	imposition_creee: string | null
	scenario_retenu: string | null
	fichier_trace: string | null
	quantite: number | null
}
export interface AtelierData {
	droits: { calculer: boolean; creer_imposition: boolean }
	etude: AtelierEtude | null
	calcul: AtelierCalcul | null
	fichier_trace: string | null
	support: string | null
	grammage: number
	supports: Option[]
	formats: AtelierFormat[]
	reglages: AtelierReglages
	historique: AtelierHistorique[]
}
export interface AtelierAlert {
	tone: 'amber' | 'red'
	text: string
}

const EN_COURS = 'En cours'
export const isRunning = (calcul?: Pick<AtelierCalcul, 'statut_calcul'> | null) => calcul?.statut_calcul === EN_COURS
export const isPdf = (url?: string | null) => /\.pdf(\?|$)/i.test(url ?? '')
export const fileLabel = (url?: string | null) => {
	const name = (url ?? '').split('?')[0].split('/').pop() ?? ''
	try {
		return decodeURIComponent(name)
	} catch {
		return name
	}
}
export const mm = (value?: number | null) => (value == null ? '—' : String(Math.round(value * 100) / 100).replace('.', ','))
export const sheetLabel = (row: Pick<Scenario, 'laize' | 'depl'>) => `${mm(row.laize)} × ${mm(row.depl)}`
export const tabLabel = (row: Scenario) => `${mm(row.laize)}×${mm(row.depl)} · ${row.n_col}×${row.n_rang}${isMotif(row) ? ` · ${motifShort(row)}` : ''}`
export { dimensionsLabel, formatDay, percentLabel }

/** Une feuille de la quantité saisie, sans relancer le moteur : feuilles et tonnage n'en dépendent que par une division. */
export function sheetsFor(row: Pick<Scenario, 'nb_poses'>, quantite: number) {
	return row.nb_poses > 0 && quantite > 0 ? Math.ceil(quantite / row.nb_poses) : 0
}
export function tonnageFor(row: Pick<Scenario, 'nb_poses' | 'laize' | 'depl'>, quantite: number, grammage: number) {
	return (sheetsFor(row, quantite) * row.laize * row.depl * grammage) / 1e12
}
export const sheetsLabel = (value: number) => (value ? formatQuantity(value) : '—')
export const tonnageLabel = (value: number) => (value ? `${String(Math.round(value * 100) / 100).replace('.', ',')} t` : '—')

export function commonCutLabel(row: Pick<Scenario, 'trait_commun_laize' | 'trait_commun_depl'>) {
	const parts = [row.trait_commun_laize && 'laize', row.trait_commun_depl && 'déplacement'].filter(Boolean)
	return parts.length ? String(parts.join(' et ')).replace(/^./, (first) => first.toUpperCase()) : 'Aucun'
}

/** Le moteur ne tient pas compte de la presse : l'écran compare, sans bloquer. */
export function presseAlert(row: Pick<Scenario, 'laize' | 'depl'>, presse?: AtelierPresse | null): AtelierAlert | null {
	if (!presse || (row.laize <= presse.laize && row.depl <= presse.depl)) return null
	return { tone: 'red', text: `Dépasse le format max de ${presse.nom} (${mm(presse.laize)} × ${mm(presse.depl)} mm).` }
}

/** Les alertes du moteur, une par ligne, puis celle de la presse. */
export function scenarioAlerts(row: Scenario, presse?: AtelierPresse | null): AtelierAlert[] {
	const engine = (row.alerte ?? '').split(';').map((text) => text.trim()).filter(Boolean).map((text) => ({ tone: 'amber' as const, text: text.charAt(0).toUpperCase() + text.slice(1) + '.' }))
	const press = presseAlert(row, presse)
	return press ? [...engine, press] : engine
}

export type ScenarioSort = 'taux_chutes' | 'nb_poses' | 'laize'
export function sortScenarios(rows: Scenario[], key: ScenarioSort, direction: 1 | -1) {
	return [...rows].sort((left, right) => (left[key] - right[key]) * direction)
}

/** Un format ajouté à la main : une feuille a ses deux dimensions, une bobine sa laize et son maximum de coupe. Jamais deux fois le même. */
export function manualFormat(laize: string, depl: string, existing: AtelierFormat[], bobine = false): AtelierFormat | string {
	const width = Number(laize.replace(',', '.'))
	const length = Number(depl.replace(',', '.'))
	if (!(width > 0)) return 'Indiquez une laize en mm.'
	if (!(length > 0)) return bobine ? 'Indiquez le maximum de coupe en mm : sans lui, le moteur retient une coupe de 12 rangs.' : 'Indiquez un déplacement en mm.'
	if (existing.some((row) => Boolean(row.bobine) === bobine && Math.abs(row.laize - width) < 2 && Math.abs(row.depl - length) < 2)) return 'Ce format est déjà dans la liste.'
	const libelle = bobine ? `Bobine ${mm(width)} mm (max ${mm(length)})` : `${mm(width)} × ${mm(length)}`
	return { laize: width, depl: length, origine: 'Manuel', libelle, bobine: bobine ? 1 : 0, coche: true }
}

/** La bobine dont vient une feuille, pour comparer ses coupes : son maximum n'est écrit que sur le format. */
export function rollOf(row: Pick<Scenario, 'origine' | 'laize' | 'libelle'> | null | undefined, formats: AtelierFormat[]) {
	if (row?.origine !== 'Bobine') return null
	const rolls = formats.filter((format) => format.bobine && Math.abs(format.laize - row.laize) < 2)
	const named = rolls.find((format) => format.depl > 0 && row.libelle.includes(`(max ${Math.round(format.depl)})`))
	return named ?? rolls.find((format) => !format.depl) ?? rolls[0] ?? { laize: row.laize, depl: 0 }
}

/** La même feuille, déjà dans la liste : on la montre au lieu d'en créer un essai. Même grille et même motif. */
export const sameSheet = (left: Scenario, right: Scenario) =>
	Math.abs(left.laize - right.laize) < 0.1 &&
	Math.abs(left.depl - right.depl) < 0.1 &&
	left.n_col === right.n_col &&
	left.n_rang === right.n_rang &&
	left.rotation === right.rotation &&
	motifKey(left) === motifKey(right)

/** Réglage « Tête-bêche et quinconce » du calcul. */
export const MOTIF_OPTIONS = ['Décalé autorisé', 'Aligné seulement', 'Non']
export const motifsSummary = (value?: string | null) => (value === 'Non' ? 'sans tête-bêche' : value === 'Aligné seulement' ? 'tête-bêche aligné' : 'tête-bêche décalé')

const DROITE = 'Grille droite'
type MotifFields = Pick<Scenario, 'motif' | 'axe_motif' | 'decalage_laize' | 'decalage_depl'>
export const isMotif = (row: MotifFields) => Boolean(row.motif && row.motif !== DROITE)
/** « tête-bêche » ou « quinconce », à la suite d'une grille. */
export const motifShort = (row: MotifFields) => (isMotif(row) ? String(row.motif).toLowerCase() : '')
const motifKey = (row: MotifFields) => (isMotif(row) ? `${row.motif}-${row.axe_motif}-${Math.round((row.decalage_laize ?? 0) * 10)}-${Math.round((row.decalage_depl ?? 0) * 10)}` : DROITE)
/** « Tête-bêche en colonnes, décalage 12,5 mm », ou « Grille droite ». */
export function motifLabel(row: MotifFields) {
	if (!isMotif(row)) return DROITE
	const rangs = row.axe_motif === 'Rangs'
	const decalage = Math.abs((rangs ? row.decalage_laize : row.decalage_depl) ?? 0)
	return `${row.motif} en ${rangs ? 'rangs' : 'colonnes'}, ${decalage < 0.05 ? 'alignés' : `décalage ${mm(Math.round(decalage * 10) / 10)} mm`}`
}
/** Le pas affiché : pour un motif, celui de la paire sur son axe. */
export function pitchLabel(row: Pick<Scenario, 'pas_laize' | 'pas_depl' | 'pas_paire'> & MotifFields) {
	if (!isMotif(row)) return `${mm(row.pas_laize)} × ${mm(row.pas_depl)}`
	return row.axe_motif === 'Rangs' ? `${mm(row.pas_laize)} × ${mm(row.pas_paire)} la paire` : `${mm(row.pas_paire)} la paire × ${mm(row.pas_depl)}`
}
export const gridLabel = (row: Pick<Scenario, 'n_col' | 'n_rang'> & MotifFields) => `${row.n_col} × ${row.n_rang}${isMotif(row) ? ` · ${motifShort(row)}` : ''}`

/** Les poses d'un scénario telles que le moteur les place ; à défaut (ancien calcul), la grille droite. */
export function posesOf(row: Pick<Scenario, 'n_col' | 'n_rang' | 'pas_laize' | 'pas_depl' | 'rotation' | 'poses'>): Pose[] {
	if (row.poses?.length) return row.poses
	const list: Pose[] = []
	for (let col = 0; col < row.n_col; col++) for (let rang = 0; rang < row.n_rang; rang++) list.push([col * row.pas_laize, rang * row.pas_depl, row.rotation || 0])
	return list
}
/** La silhouette d'une pose est celle de sa rotation à 0° ou 90° ; une pose à 180° ou 270° est la même, retournée. */
export const silhouetteKey = (rotation: number) => String((((rotation || 0) % 180) + 180) % 180)
/** Transformation SVG d'une pose, l × d étant l'encombrement de sa silhouette. */
export function poseTransform(pose: Pose, lisiere: number, pince: number, l: number, d: number) {
	const place = `translate(${lisiere + pose[0]} ${pince + pose[1]})`
	return (((pose[2] || 0) % 360) + 360) % 360 >= 180 ? `${place} rotate(180 ${l / 2} ${d / 2})` : place
}

/** Texte de la création : ce que devient l'étude, et l'imposition qu'on remplace. */
export function replacementText(etude: Pick<AtelierEtude, 'name' | 'imposition'>) {
	return etude.imposition ? `Elle remplacera ${etude.imposition} sur l'étude ${etude.name}, qui reprendra son taux de chutes et son nombre de feuilles. L'ancienne imposition reste dans la liste du tracé.` : `Elle sera liée à l'étude ${etude.name}, qui reprendra son taux de chutes et son nombre de feuilles.`
}

/** Télécharge sans ouvrir de fenêtre : un PDF met plusieurs secondes à se préparer, et le navigateur bloque alors toute fenêtre ouverte après le clic. */
export function downloadFile(url: string, name: string) {
	const link = document.createElement('a')
	link.href = url
	link.download = name
	document.body.append(link)
	link.click()
	link.remove()
}

/** Message à montrer sur la fiche au retour de l'atelier. */
let pending = ''
export function setPendingNotice(message: string) {
	pending = message
}
export function takePendingNotice() {
	const message = pending
	pending = ''
	return message
}
