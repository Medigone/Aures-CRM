/** Règles de la page Articles : types, vues, colonnes, filtres, fiche technique et validation de la fenêtre. */
import { fieldVisible, isEmptyValue, type FicheDoc, type FicheField, type FicheSchema } from '@shared/fiche'
import type { CommentSummary, Option } from '@/types'
import type { ClientTicket } from './clients'
import type { FilterField } from './filters'
import { deskUrl, formatDay } from './display'
import { tagsText, type Column, type Sort } from './list'
import type { ListResponse } from './useServerList'

export type ArticleView = 'all' | 'offset' | 'flexo' | 'salle_blanche' | 'sans_bat' | 'compose' | 'general'

export const ARTICLE_VIEWS: { key: ArticleView; label: string }[] = [
	{ key: 'all', label: 'Tous' },
	{ key: 'offset', label: 'Offset' },
	{ key: 'flexo', label: 'Flexo' },
	{ key: 'salle_blanche', label: 'Salle blanche' },
	{ key: 'sans_bat', label: 'Sans BAT validé' },
	{ key: 'compose', label: 'Composés' },
	{ key: 'general', label: 'Généraux' },
]

export const PROCEDE_FLEXO = 'Flexo'
export const TYPE_GENERAL = 'Général'

export interface ArticleRow {
	name: string
	modified: string
	creation: string
	tags: string[]
	cloche: boolean
	designation: string
	type: string | null
	client: string | null
	client_label: string | null
	commercial: string | null
	procede: string | null
	support: string | null
	format: string | null
	bat: string | null
	commande: string | null
	reference: string | null
	groupe: string | null
	couleurs: string | null
	consommation: number
	compose: number
	sous_article: number
	parent: string | null
}

export interface ArticlesResponse extends ListResponse {
	articles: ArticleRow[]
	counts: Record<ArticleView, number>
	page_length: number
}

export interface ArticleVente {
	name: string
	transaction_date: string
	status: string
	custom_statut_commande?: string | null
	qty: number
	rate: number
	amount: number
}

export interface ArticlePrepresse {
	maquettes: { name: string; status: string; ver: number | null; resume_couleurs: string | null; date_creation: string | null; date_activation?: string | null; desc_changements: string | null; fichier_maquette: string | null; nom_reference_par?: string | null }[]
	bats: { name: string; status: string; date: string | null; maquette: string | null; valide_par_nom: string | null; fichier_valide: string | null; image: string | null }[]
	traces: { name: string; dimensions: string | null; fichier_trace: string | null }[]
	impositions: { name: string; machine_impression: string | null; nbr_poses: number | null; taux_chutes: number | null; defaut: number; fichier_imp: string | null }[]
	cliches: { name: string; status: string; date: string | null; version: number | null; version_active: number; nbr_couleurs: string | null }[]
	plans_flexo: { name: string; date: string | null; dimensions: string | null; laize: string | null; fichier: string | null }[]
	etudes_techniques: { name: string; status: string; date: string | null; nom_utilisateur: string | null; machine: string | null; nb_passages: number | null; maquette?: string | null; bat?: string | null }[]
}

export interface ArticleDocument {
	file_name: string
	file_url: string
	file_size: number
	owner_name: string
	creation: string
	roles: string[]
}

export interface ArticleDetail {
	name: string
	modified: string
	tags: string[]
	designation: string
	type: string | null
	procede: string | null
	support: string | null
	resume_technique: { support: string | null; mesure_label: string; mesure: string | null }
	format: string | null
	reference: string | null
	ancien_code: string | null
	groupe: string | null
	unite: string | null
	consommation: number
	couleurs: string | null
	compose: number
	sous_article: number
	parent: string | null
	parent_label: string | null
	quantite_parent: number
	client: string | null
	client_label: string | null
	wilaya: string | null
	commercial: string | null
	commercial_user: string | null
	bat: string | null
	image: string | null
	own_image: boolean
	fichiers: { image: string | null; fiche_technique: string | null; trace_decoupe: string | null }
	documents: ArticleDocument[]
	droits_prepresse: { maquette: boolean; nouvelle_version: boolean; bat: boolean }
	fiche: Record<string, string | number>
	teintes?: ArticleTeinte[]
	prepresse: ArticlePrepresse
	ecart_bat: { bat: string; maquette_bat: string; maquette_active: string } | null
	commandes: ArticleVente[]
	devis: ArticleVente[]
	etudes: { name: string; doctype: string; date_creation: string | null; status: string; quantite: number | null }[]
	tickets: ClientTicket[]
	sous_articles: { name: string; designation: string; quantite: number; support: string | null; format: string | null; bat: string | null }[]
	comments: CommentSummary
	can_edit: boolean
}

export interface ArticleOptions {
	filter_fields?: FilterField[]
	procedes: string[]
	types: string[]
	groupes: string[]
	supports: string[]
	clients: Option[]
	groupe_defaut: string
	can_create: boolean
	schema: FicheSchema
}

export const CMJN_CHANNELS = ['c', 'm', 'j', 'n'] as const

export interface PantoneMatch {
	code: string
	label: string
	hex: string | null
	approximative: number
	needs_suffix: number
}

export interface TeintePayload {
	type_couleur: 'Pantone' | 'CMJN'
	code: string
	nom: string
	c: number
	m: number
	j: number
	n: number
}

/** Ligne de couleur d'un article. Pour une ligne Pantone, le serveur ajoute le libellé et le carré. */
export interface ArticleTeinte extends TeintePayload, Partial<Omit<PantoneMatch, 'code'>> {
	/** Repère d'affichage dans la fenêtre de saisie, jamais envoyé au serveur. */
	key?: number
}

let teinteKey = 0
export function newTeinte(type_couleur: TeintePayload['type_couleur']): ArticleTeinte {
	return { key: ++teinteKey, type_couleur, code: '', nom: '', c: 0, m: 0, j: 0, n: 0 }
}
export function teintesForEdit(teintes: ArticleTeinte[] | undefined) {
	return (teintes ?? []).map((teinte) => ({ ...teinte, key: ++teinteKey }))
}

/** Couleur d'écran d'une teinte CMJN, calculée sans profil : indicative seulement. */
export function cmjnHex(c: number, m: number, j: number, n: number) {
	const channel = (ink: number) => Math.round(255 * (1 - ink / 100) * (1 - n / 100)).toString(16).padStart(2, '0')
	return `#${channel(c)}${channel(m)}${channel(j)}`
}

export function teinteHex(teinte: ArticleTeinte) {
	return teinte.type_couleur === 'CMJN' ? cmjnHex(teinte.c, teinte.m, teinte.j, teinte.n) : (teinte.hex ?? null)
}

/** Ce qu'on lit sous le code d'une couleur dans le tiroir : sa nature, puis son nom. */
export function teinteDetail(teinte: ArticleTeinte) {
	if (teinte.needs_suffix) return 'Précisez C ou U'
	return [teinte.type_couleur, teinte.nom].filter(Boolean).join(' · ')
}

/** Les couleurs d'un article sans détail : le champ tel quel, « CMJN » par exemple, ou le nombre annoncé. */
export function couleursSansDetail(couleurs: string | null | undefined) {
	const value = (couleurs ?? '').trim()
	if (!/^\d+$/.test(value)) return value || null
	return `${value} ${Number(value) > 1 ? 'couleurs' : 'couleur'}, détail non renseigné`
}

/** Ce qui part au serveur : sans les lignes laissées vides ni ce qui ne sert qu'à l'affichage. */
export function teintesPayload(teintes: ArticleTeinte[]): TeintePayload[] {
	return teintes
		.filter((teinte) => (teinte.type_couleur === 'Pantone' ? teinte.code.trim() : CMJN_CHANNELS.some((channel) => teinte[channel])))
		.map(({ type_couleur, code, nom, c, m, j, n }) => ({ type_couleur, code: type_couleur === 'Pantone' ? code.trim() : '', nom: nom.trim(), c, m, j, n }))
}

/** La rubrique Couleurs suit l'impression ; un procédé sans cette rubrique la range après le format, puis après le support. */
export function colorsAfterCard(titles: string[]) {
	return ['Impression', 'Format', 'Support'].find((title) => titles.includes(title)) ?? null
}

/** Champs que le serveur déduit des lignes de couleur : plus de saisie à la main tant qu'il y en a. */
export const COLOR_DERIVED_FIELDS = new Set(['custom_impression', 'custom_nbr_couleurs', 'custom_nombre_de_couleurs'])

export interface ArticleValues {
	type?: string
	designation?: string
	client?: string
	procede?: string
	reference?: string
	groupe?: string
	ancien_code?: string
	consommation?: string
	fiche?: Record<string, string>
	teintes?: TeintePayload[]
}

export const ARTICLE_COLUMNS: Column<ArticleRow>[] = [
	{ key: 'designation', label: 'Article', width: 216, grow: 2, sortable: true, text: (row) => row.designation },
	{ key: 'name', label: 'Code', width: 118, sortable: true, text: (row) => row.name },
	{ key: 'client_label', label: 'Client', width: 152, grow: 1, sortable: true, text: (row) => row.client_label || '' },
	{ key: 'procede', label: 'Procédé', width: 100, sortable: true, text: (row) => row.procede || '' },
	{ key: 'support', label: 'Support', width: 110, sortable: true, text: (row) => row.support || '' },
	{ key: 'format', label: 'Format (mm)', width: 96, sortable: true, text: (row) => row.format || '' },
	{ key: 'bat', label: 'Dernier BAT', width: 112, sortable: true, text: (row) => row.bat || '' },
	{ key: 'commande', label: 'Commande', width: 92, sortable: true, text: (row) => formatDay(row.commande) },
	{ key: 'tags', label: 'Tags', width: 100, sortable: false, text: (row) => tagsText(row) },
	{ key: 'reference', label: 'Réf. client', width: 100, sortable: true, optional: true, text: (row) => row.reference || '' },
	{ key: 'commercial', label: 'Commercial', width: 130, sortable: true, optional: true, text: (row) => row.commercial || '' },
	{ key: 'groupe', label: 'Groupe', width: 110, sortable: true, optional: true, text: (row) => row.groupe || '' },
	{ key: 'couleurs', label: 'Couleurs', width: 90, sortable: true, optional: true, text: (row) => row.couleurs || '' },
	{ key: 'consommation', label: 'Conso. annuelle', width: 110, sortable: true, optional: true, end: true, text: (row) => row.consommation },
	{ key: 'creation', label: 'Créé le', width: 92, sortable: true, optional: true, text: (row) => formatDay(row.creation) },
	{ key: 'modified', label: 'Modifié le', width: 92, sortable: true, optional: true, text: (row) => formatDay(row.modified) },
]
export const DEFAULT_ARTICLE_COLUMNS = ARTICLE_COLUMNS.filter((column) => !column.optional).map((column) => column.key)

/** La colonne Article reste toujours affichée ; une clé inconnue, venue d'un ancien réglage, est ignorée. */
export function visibleArticleColumns(keys: string[]) {
	return ARTICLE_COLUMNS.filter((column) => column.key === 'designation' || keys.includes(column.key))
}

/** Repères de couleur de la liste : les teintes d'Aures Pli, sans le rouge, réservé à ce qui bloque. */
const PROCEDE_REPERES: Record<string, { tone: string; sigle: string; label?: string }> = {
	Offset: { tone: 'tone-blue', sigle: 'OF' },
	Flexo: { tone: 'tone-green', sigle: 'FL' },
	'Salle Blanche Pharma': { tone: 'tone-violet', sigle: 'SB', label: 'Salle blanche' },
	Numérique: { tone: 'tone-amber', sigle: 'NU' },
}
const CLIENT_TONES = ['tone-blue', 'tone-green', 'tone-violet', 'tone-amber', 'tone-gray']

export function procedeTone(procede?: string | null) {
	return PROCEDE_REPERES[procede || '']?.tone ?? 'tone-gray'
}
export function procedeLabel(procede?: string | null) {
	return PROCEDE_REPERES[procede || '']?.label ?? procede ?? ''
}
/** Le carré d'une ligne : le sigle du procédé, sinon les deux premières lettres de la désignation. */
export function articleSigle(row: Pick<ArticleRow, 'procede' | 'designation'>) {
	return PROCEDE_REPERES[row.procede || '']?.sigle ?? (row.designation || '').slice(0, 2).toUpperCase()
}
/** Un client garde sa teinte d'une ligne et d'une page à l'autre. */
export function clientTone(client: string) {
	let sum = 0
	for (const letter of client) sum = (sum * 31 + letter.charCodeAt(0)) % 9973
	return CLIENT_TONES[sum % CLIENT_TONES.length]
}

export function articleSortText(sort: Sort | null) {
	const column = sort && ARTICLE_COLUMNS.find((item) => item.key === sort.key)
	return column ? `Tri : ${column.label.toLowerCase()}` : 'Tri : désignation'
}

/** Prix unitaire : deux décimales et une virgule, avec une espace pour les milliers : « 1 240,50 ». */
export function formatRate(value?: number | null) {
	const [whole, decimals] = (value ?? 0).toFixed(2).split('.')
	return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')},${decimals}`
}

/** Quantité entière avec une espace pour les milliers ; une quantité fractionnaire garde sa virgule. */
export function formatQuantity(value?: number | null) {
	const amount = value ?? 0
	const [whole, decimals] = String(amount).split('.')
	return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${decimals ? `,${decimals}` : ''}`
}

/** Ce qu'un fichier joint représente pour l'article. */
export const ROLE_LABELS: Record<string, string> = { image: "Image de l'article", fiche_technique: 'BAT', trace_decoupe: 'Tracé de découpe' }

export function isImageFile(name: string) {
	return /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(name)
}
export function isPdfFile(name: string) {
	return /\.pdf(\?|#|$)/i.test(name)
}

const BAT_VALIDES = ['BAT-E Validé', 'BAT-P Validé']
const MAQUETTE_ACTIVE = 'Version Activée'
const ETUDES_EN_COURS = ['Nouveau', 'En Cours']

export interface PrepresseStep {
	key: string
	label: string
	sub: string
	done: boolean
	lineTodo: boolean
}
export interface PrepresseNext {
	title: string
	text: string
	action?: 'bat' | 'maquette'
	actionLabel?: string
	etude?: string
	maquette?: string
	desk?: string
	deskLabel?: string
}

/** L'état de la chaîne de prépresse, et la prochaine chose à faire. */
export function prepresseState(article: ArticleDetail) {
	const { maquettes, bats, traces, impositions, cliches, etudes_techniques: etudesRaw } = article.prepresse
	const flexo = article.procede === PROCEDE_FLEXO
	const trace = traces[0]
	const active = maquettes.find((row) => row.status === MAQUETTE_ACTIVE)
	const older = maquettes.filter((row) => row !== active)
	const waiting = maquettes.find((row) => row.status === 'A référencer')
	const ready = maquettes.find((row) => row.status === 'Référencée')
	const imposition = impositions.find((row) => row.defaut) ?? impositions[0]
	const otherImpositions = impositions.filter((row) => row !== imposition)
	const cliche = cliches.find((row) => row.version_active) ?? cliches[0]
	const currentBat = bats.find((row) => row.status !== 'Obsolète')
	const oldBats = bats.filter((row) => row !== currentBat)
	const batValidated = Boolean(currentBat && BAT_VALIDES.includes(currentBat.status))
	const batCovers = Boolean(currentBat && active && currentBat.maquette === active.name)
	const activeBat = active ? bats.find((row) => row.maquette === active.name && row.status !== 'Obsolète') : undefined
	const etudes = [...etudesRaw].sort((a, b) => Number(ETUDES_EN_COURS.includes(b.status)) - Number(ETUDES_EN_COURS.includes(a.status)))
	const usableEtudes = etudes.filter((row) => row.status !== 'Annulée')
	const etude = usableEtudes.find((row) => row.maquette && row.maquette === active?.name) ?? usableEtudes[0]
	const batDone = batValidated && !article.ecart_bat

	const toolDone = flexo ? Boolean(cliche) : Boolean(imposition)
	const toolSub = flexo
		? cliche?.version
			? `Version ${cliche.version}`
			: cliche?.name ?? 'À créer'
		: imposition
			? [imposition.nbr_poses ? posesLabel(imposition.nbr_poses) : '', imposition.taux_chutes ? `chutes ${String(imposition.taux_chutes).replace('.', ',')} %` : ''].filter(Boolean).join(' · ') || imposition.name
			: 'À créer'
	const batSub = batDone ? (currentBat?.status === 'BAT-P Validé' ? 'BAT-P validé' : 'BAT-E validé') : article.ecart_bat ? 'À refaire' : currentBat ? 'À valider' : 'À créer'
	const steps: PrepresseStep[] = [
		{ key: 'trace', label: 'Tracé', sub: trace?.dimensions ? `${trace.dimensions} mm` : trace?.name ?? 'À créer', done: Boolean(trace), lineTodo: false },
		{ key: 'maquette', label: 'Maquette', sub: active ? `Version ${active.ver ?? '?'} activée` : waiting ? 'À référencer' : ready || maquettes.length ? 'À activer' : 'À créer', done: Boolean(active), lineTodo: false },
		{ key: 'outil', label: flexo ? 'Cliché' : 'Imposition', sub: toolSub, done: toolDone, lineTodo: false },
		{ key: 'bat', label: 'BAT', sub: batSub, done: batDone, lineTodo: false },
	]
	// Le trait qui mène à une étape à faire reste gris.
	steps.forEach((step, index) => {
		step.lineTodo = !step.done || !steps[index + 1]?.done
	})

	const deskNew = (doctype: string) => `${deskUrl(doctype, 'new')}?article=${encodeURIComponent(article.name)}`
	function nextStep(): PrepresseNext | null {
		if (!trace) return { title: 'Créer le tracé', text: "Aucun tracé pour cet article : il sert à la maquette et à l'imposition.", desk: deskNew('Trace'), deskLabel: 'Créer sur le Desk' }
		if (!active) {
			if (waiting) return { title: 'Référencer la maquette', text: `${waiting.name} attend d'être référencée avant de pouvoir être activée.`, action: 'maquette', actionLabel: 'Ouvrir la maquette', maquette: waiting.name }
			const candidate = ready ?? maquettes[0]
			if (candidate) return { title: 'Activer une maquette', text: `Aucune version n'est en service. ${candidate.name} peut être activée.`, action: 'maquette', actionLabel: 'Ouvrir la maquette', maquette: candidate.name }
			return { title: 'Créer la maquette', text: 'Aucune maquette pour cet article.', desk: deskNew('Maquette'), deskLabel: 'Créer sur le Desk' }
		}
		if (!toolDone) return { title: flexo ? 'Créer le cliché' : "Créer l'imposition", text: flexo ? 'Aucun cliché pour cet article.' : 'Aucune imposition pour cet article.', desk: deskNew(flexo ? 'Cliche' : 'Imposition'), deskLabel: 'Créer sur le Desk' }
		if (batDone) return null
		if (currentBat && !batValidated && !article.ecart_bat) return { title: 'Valider le BAT', text: `${currentBat.name} attend sa validation.`, desk: deskUrl('BAT', currentBat.name), deskLabel: 'Valider sur le Desk' }
		const title = article.ecart_bat ? 'Refaire le BAT' : 'Créer le BAT'
		const reason = article.ecart_bat
			? `${article.ecart_bat.bat} porte sur ${article.ecart_bat.maquette_bat}, la version activée est ${article.ecart_bat.maquette_active}.`
			: `Le tracé, la maquette et ${flexo ? 'le cliché' : "l'imposition"} sont en place.`
		if (!etude) return { title, text: `${reason} Il manque une étude technique pour lancer le BAT.`, desk: deskNew('Etude Technique'), deskLabel: "Créer l'étude sur le Desk" }
		const since = ETUDES_EN_COURS.includes(etude.status) && etude.date ? `, en cours depuis le ${formatDay(etude.date)},` : ''
		if (!etude.maquette) return { title, text: `${reason} L'étude technique ${etude.name} n'a pas de maquette : renseignez-la pour lancer le BAT.`, desk: deskUrl('Etude Technique', etude.name), deskLabel: "Ouvrir l'étude" }
		return { title, text: `${reason} L'étude technique ${etude.name}${since} sert à lancer le BAT.`, action: 'bat', actionLabel: title, etude: etude.name, desk: deskUrl('Etude Technique', etude.name), deskLabel: "Ouvrir l'étude" }
	}

	return { flexo, trace, active, older, imposition, otherImpositions, cliche, currentBat, oldBats, batCovers, activeBat, etudes, steps, next: nextStep() }
}

/** Ce que l'activation d'une version entraîne, à annoncer avant. */
export function activationConsequence(article: ArticleDetail, maquette: string) {
	const { maquettes, bats } = article.prepresse
	const active = maquettes.find((row) => row.status === MAQUETTE_ACTIVE && row.name !== maquette)
	if (!active) return "Elle devient la version en service."
	const linked = bats.filter((row) => row.maquette === active.name && row.status !== 'Obsolète')
	const effect = linked.length ? `${linked.map((row) => row.name).join(', ')} ${linked.length > 1 ? 'deviennent obsolètes' : 'devient obsolète'}.` : "Aucun BAT n'est concerné."
	return `${active.name} passe en obsolète. ${effect}`
}

export function posesLabel(count: number) {
	return `${count} pose${count > 1 ? 's' : ''}`
}

// Cartes de la fiche technique : le Desk range ces champs par section de formulaire, on les lit par sujet.
const CARD_OF: Record<string, string> = {
	custom_support_fourni: 'Support',
	custom_support: 'Support',
	custom_grammage: 'Support',
	custom_tolérance_: 'Support',
	custom_type_support: 'Support',
	custom_complexage: 'Support',
	custom_epaisseur: 'Support',
	custom_grammage_support: 'Support',
	custom_epaisseur_2: 'Support',
	custom_autre_epaisseur: 'Support',
	custom_cotations_article: 'Format',
	custom_dimensions_h_x_l: 'Format',
	custom_impression: 'Impression',
	custom_nbr_couleurs: 'Impression',
	custom_recto_verso: 'Impression',
	custom_nombre_de_poses: 'Impression',
	custom_nombre_passages: 'Impression',
	custom_pelliculage: 'Finitions',
	custom_marquage_à_chaud: 'Finitions',
	custom_marquage_à_froid: 'Finitions',
	custom_couleur_marquage_à_chaud: 'Finitions',
	custom_notice: 'Finitions',
	custom_finition: 'Finitions',
	custom_perforation: 'Finitions',
	custom_type_perforation: 'Finitions',
	custom_diametre_mandrin: 'Bobine',
	custom_autre_diamètre_mandrin: 'Bobine',
	custom_diamètre_bobine: 'Bobine',
	custom_sens_deroulement: 'Bobine',
	custom_sense_défilement_: 'Bobine',
	custom_poids_bobine: 'Bobine',
	custom_conditionnement: 'Conditionnement et essais',
	custom_certification_fsc: 'Conditionnement et essais',
	custom_essai_blanc: 'Conditionnement et essais',
	custom_essai_imprimé: 'Conditionnement et essais',
}
const GROUP_CARD: Record<string, string> = { 'Options Vernis': 'Vernis', 'Finition Offset': 'Finitions', 'Salle Blanche': 'Salle blanche' }
const CARD_ORDER = ['Support', 'Format', 'Impression', 'Salle blanche', 'Vernis', 'Finitions', 'Bobine', 'Conditionnement et essais']

export interface FicheCard {
	title: string
	fields: FicheField[]
}

/** Champs visibles pour ce procédé, rangés par carte. Sert à la saisie, et de base à la lecture. */
export function ficheCards(schema: FicheSchema | undefined, doc: FicheDoc): FicheCard[] {
	const cards = new Map<string, FicheField[]>()
	for (const group of schema?.groups ?? []) {
		for (const field of group.fields) {
			if (!fieldVisible(field, doc)) continue
			const title = CARD_OF[field.fieldname] ?? GROUP_CARD[group.label] ?? group.label
			cards.set(title, [...(cards.get(title) ?? []), field])
		}
	}
	const rank = (title: string) => {
		const index = CARD_ORDER.indexOf(title)
		return index < 0 ? CARD_ORDER.length : index
	}
	return [...cards.entries()].sort((left, right) => rank(left[0]) - rank(right[0])).map(([title, fields]) => ({ title, fields }))
}

export interface FicheCardValues {
	title: string
	rows: { label: string; value: string }[]
	checks: string[]
}

/** Lecture : seuls les champs renseignés. Une carte sans valeur disparaît. */
export function ficheCardValues(schema: FicheSchema | undefined, doc: FicheDoc): FicheCardValues[] {
	return creationCards(schema, doc)
		.map(({ title, fields }) => ({
			title,
			rows: fields.filter((field) => field.fieldtype !== 'Check' && !isEmptyValue(doc[field.fieldname])).map((field) => ({ label: field.label, value: String(doc[field.fieldname]) })),
			checks: fields.filter((field) => field.fieldtype === 'Check' && Number(doc[field.fieldname])).map((field) => field.label),
		}))
		.filter((card) => card.rows.length || card.checks.length)
}

/** Document évalué par les conditions du Desk : l'identité de l'article et les valeurs de sa fiche. */
export function articleDoc(article: Pick<ArticleDetail, 'type' | 'procede' | 'compose' | 'sous_article' | 'designation' | 'fiche'>): FicheDoc {
	return {
		custom_type_article: article.type,
		custom_procédé: article.procede,
		custom_article_compose: article.compose,
		custom_sous_article: article.sous_article,
		item_code: article.designation,
		item_name: article.designation,
		...article.fiche,
	}
}

/** Résumé des finitions pour l'aperçu : pelliculage et vernis. */
export function finishesSummary(cards: FicheCardValues[]) {
	const pelliculage = cards.find((card) => card.title === 'Finitions')?.rows.find((row) => row.label === 'Pelliculage')?.value
	const vernis = cards.find((card) => card.title === 'Vernis')?.checks ?? []
	return [pelliculage && `Pelliculage ${pelliculage.toLowerCase()}`, ...vernis.map((label) => `Vernis ${label.toLowerCase()}`)].filter(Boolean).join(' · ')
}

const CREATION_LAST_FIELDS = new Set(['custom_tolérance_', 'custom_nombre_passages'])

/** Fiche technique de la phase 2 et de la lecture : les cartes du procédé, dans le même ordre. */
export function creationCards(schema: FicheSchema | undefined, doc: FicheDoc): FicheCard[] {
	return ficheCards(schema, doc)
		// Ces champs communs à tous les procédés passent après ceux du procédé, comme dans la maquette.
		.map(({ title, fields }) => ({ title, fields: [...fields.filter((field) => !CREATION_LAST_FIELDS.has(field.fieldname)), ...fields.filter((field) => CREATION_LAST_FIELDS.has(field.fieldname))] }))
}

export type ArticleField = 'designation' | 'client' | 'procede' | 'groupe'

export function validateArticle(values: ArticleValues, editing: boolean) {
	const errors: Partial<Record<ArticleField, string>> = {}
	const general = values.type === TYPE_GENERAL
	if (!values.designation?.trim()) errors.designation = 'Saisissez la désignation.'
	if (!values.groupe?.trim()) errors.groupe = "Choisissez le groupe d'article."
	if (!general && !values.procede?.trim()) errors.procede = 'Choisissez le procédé.'
	if (!general && !editing && !values.client?.trim()) errors.client = 'Choisissez le client.'
	return errors
}

/** Valeurs de saisie de la fiche : du texte partout, « 1 » ou « 0 » pour une case. */
export function ficheFormValues(fiche: Record<string, string | number>, schema?: FicheSchema) {
	const values: Record<string, string> = {}
	for (const group of schema?.groups ?? []) {
		for (const field of group.fields) {
			const value = fiche[field.fieldname]
			values[field.fieldname] = field.fieldtype === 'Check' ? (Number(value) ? '1' : '0') : value == null ? '' : String(value)
		}
	}
	return values
}

/** Seuls les champs changés partent au serveur : une fiche ouverte ne réécrit pas ce qu'elle n'a pas touché. */
export function changedFields<Key extends string>(initial: Partial<Record<Key, string>>, current: Partial<Record<Key, string>>) {
	const changes: Partial<Record<Key, string>> = {}
	for (const key of Object.keys(current) as Key[]) {
		if ((current[key] ?? '').trim() !== (initial[key] ?? '').trim()) changes[key] = (current[key] ?? '').trim()
	}
	return changes
}
