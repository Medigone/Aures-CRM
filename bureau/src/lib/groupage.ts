/** Groupage dans l'atelier : plusieurs articles d'un même support sur une feuille, poses saisies à la main. */
import { silhouetteKey, poseTransform, type SilhouetteVue } from './atelier'

export interface GroupCandidate {
	name: string
	designation: string
	client_label: string
	quantite: number
	status: string
	lisible: boolean
}
export interface GroupMember {
	etude: string
	designation: string
	client_label: string
	quantite: number
	status: string
	calcul: string
	silhouette: Record<string, SilhouetteVue>
}
export interface GroupBlock {
	etude: string
	poses: number
	n_col: number
	n_rang: number
	rotation: number
	motif: string
	x: number
	y: number
	feuilles_necessaires: number
	surproduction: number
}
export interface GroupLine {
	laize: number
	depl: number
	libelle: string
	sens: 'laize' | 'depl'
	nb_poses: number
	nb_feuilles: number
	taux_chutes: number
	reste_laize: number
	reste_depl: number
	/** [article, x, y, rotation] depuis la lisière et la pince. */
	poses: [number, number, number, number][]
	blocs: GroupBlock[]
}
export interface GroupResult {
	membres: GroupMember[]
	lignes: GroupLine[]
	refus: string[]
	lisiere: number
	pince: number
}
/** Ce que l'écran envoie : l'étude ouverte d'abord, puis les autres, chacune avec ses poses. */
export interface GroupEntry {
	etude: string
	designation: string
	client_label: string
	quantite: number
	poses: number
}

export const GROUP_MAX = 4
/** Une teinte par article, dans l'ordre de la feuille. */
export const GROUP_TONES = ['blue', 'green', 'violet', 'orange'] as const

export function groupPoses(result: GroupResult, line: GroupLine) {
	return line.poses.map(([article, x, y, rotation], index) => {
		const silhouettes = result.membres[article]?.silhouette ?? {}
		const paths = silhouettes[silhouetteKey(rotation)] ?? silhouettes['0']
		return { key: index, article, paths, transform: paths ? poseTransform([x, y, rotation], result.lisiere, result.pince, paths.l, paths.d) : '' }
	})
}
/** « Surproduit 5 000 » ou rien : l'article le plus demandé au regard de ses poses fixe le tirage. */
export const surplusLabel = (value: number) => (value > 0 ? `+${new Intl.NumberFormat('fr-FR').format(value).replace(/ /g, ' ')}` : '—')
/** Vérifie la saisie avant d'appeler le moteur. */
export function groupError(entries: GroupEntry[]) {
	if (entries.length < 2) return 'Ajoutez au moins un autre article.'
	if (entries.length > GROUP_MAX) return `${GROUP_MAX} articles au plus sur une feuille.`
	const bad = entries.find((entry) => !Number.isInteger(entry.poses) || entry.poses < 1)
	return bad ? `Indiquez les poses de ${bad.designation}.` : ''
}
