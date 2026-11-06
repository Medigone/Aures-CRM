/** Duplication d'un article : ce qu'on peut reprendre, les sélections de départ et ce qui part au serveur. */
import type { FicheSchema } from '@shared/fiche'
import { articleDoc, COLOR_DERIVED_FIELDS, colorsAfterCard, creationCards, formatQuantity, posesLabel, teinteDetail, teinteHex, type ArticleDetail } from './articles'
import { isEmptyValue } from '@shared/fiche'

export interface DuplicateField {
	key: string
	label: string
	value: string
	hex?: string | null
}
export interface DuplicateRubrique {
	key: string
	title: string
	fields: DuplicateField[]
}
export interface DuplicateItem {
	key: string
	title: string
	sub: string
	/** L'élément à reprendre d'abord. */
	needs?: string
	needsText?: string
	/** Droit manquant : la ligne reste visible, sans pouvoir se cocher. */
	refused?: string
}
export interface DuplicateModel {
	rubriques: DuplicateRubrique[]
	prepresse: DuplicateItem[]
	fichiers: DuplicateItem[]
	sous: DuplicateItem[]
}
export type DuplicatePreset = 'tout' | 'forme' | 'fiche'

export const DUPLICATE_PRESETS: { key: DuplicatePreset; label: string; note: string }[] = [
	{ key: 'tout', label: 'Tout reprendre', note: 'Pour une variante proche. La maquette repart à référencer et le BAT reste à refaire.' },
	{ key: 'forme', label: 'Même forme, autre visuel', note: 'Pour décliner une gamme. Le support, le format, le vernis, les finitions et le tracé restent. Les couleurs et la maquette repartent de zéro.' },
	{ key: 'fiche', label: 'Fiche technique seule', note: 'Seules les valeurs techniques passent. La prépresse et les fichiers repartent de zéro.' },
]
const VISUAL_RUBRIQUES = new Set(['Impression', 'Couleurs'])
const FORME_ITEMS = new Set(['p:trace', 'p:imposition', 'p:plan_flexo', 'd:trace_decoupe', 'd:tags'])
/** Le visuel appartient à un client : il ne passe pas à un autre sans le demander. */
const CLIENT_ITEMS = ['p:maquette', 'd:image']

const CHECKED = 'Oui'
const REFUSED = 'Vos droits ne permettent pas de le créer.'

export function maquetteToCopy(article: ArticleDetail) {
	const rows = article.prepresse.maquettes.filter((row) => row.status !== 'Obsolète' && row.status !== 'Détruite')
	return rows.find((row) => row.status === 'Version Activée') ?? rows[0] ?? null
}

function ficheRubriques(article: ArticleDetail, schema: FicheSchema | undefined): DuplicateRubrique[] {
	if (article.compose) return []
	const doc = articleDoc(article)
	const teintes = article.teintes ?? []
	const cards = creationCards(schema, doc)
		.map(({ title, fields }) => ({
			key: title,
			title,
			fields: fields
				// Le serveur déduit ces champs des lignes de couleur : ils suivent la rubrique Couleurs.
				.filter((field) => !(teintes.length && COLOR_DERIVED_FIELDS.has(field.fieldname)))
				.filter((field) => (field.fieldtype === 'Check' ? Number(doc[field.fieldname]) : !isEmptyValue(doc[field.fieldname])))
				.map((field) => ({ key: `f:${field.fieldname}`, label: field.label, value: field.fieldtype === 'Check' ? CHECKED : String(doc[field.fieldname]) })),
		}))
		.filter((card) => card.fields.length)
	if (!teintes.length) return cards
	const couleurs: DuplicateRubrique = {
		key: 'Couleurs',
		title: 'Couleurs',
		fields: teintes.map((teinte, index) => ({ key: `t:${index}`, label: teinteDetail(teinte) || teinte.type_couleur, value: teinte.type_couleur === 'Pantone' ? teinte.code : teinte.nom || teinte.code, hex: teinteHex(teinte) })),
	}
	const after = colorsAfterCard(cards.map((card) => card.title))
	const position = after ? cards.findIndex((card) => card.title === after) + 1 : 0
	return [...cards.slice(0, position), couleurs, ...cards.slice(position)]
}

export function buildDuplicateModel(article: ArticleDetail, schema: FicheSchema | undefined): DuplicateModel {
	const { prepresse, droits_duplication: droits, fichiers } = article
	const pre: DuplicateItem[] = []
	const trace = prepresse.traces[0]
	if (trace) pre.push({ key: 'p:trace', title: 'Tracé', sub: `${[trace.name, trace.dimensions].filter(Boolean).join(' · ')}, recréé sur le nouvel article`, refused: droits.trace ? undefined : REFUSED })
	const imposition = prepresse.impositions[0]
	if (imposition) {
		pre.push({
			key: 'p:imposition',
			title: 'Imposition',
			sub: `${[imposition.name, imposition.nbr_poses ? posesLabel(imposition.nbr_poses) : ''].filter(Boolean).join(' · ')}, rattachée au tracé repris`,
			needs: 'p:trace',
			needsText: "Se reprend avec le tracé : cochez d'abord le tracé.",
			refused: droits.imposition ? undefined : REFUSED,
		})
	}
	const maquette = maquetteToCopy(article)
	if (maquette) pre.push({ key: 'p:maquette', title: maquette.status === 'Version Activée' ? 'Maquette active' : 'Dernière maquette', sub: `${maquette.name}, repart en V1 au statut « A référencer »`, refused: droits.maquette ? undefined : REFUSED })
	const plan = prepresse.plans_flexo[0]
	if (plan) pre.push({ key: 'p:plan_flexo', title: 'Plan Flexo', sub: [plan.name, plan.dimensions].filter(Boolean).join(' · '), refused: droits.plan_flexo ? undefined : REFUSED })

	const fileName = (url: string | null) => article.documents.find((row) => row.file_url === url)?.file_name ?? url ?? ''
	const files: DuplicateItem[] = []
	if (article.own_image && fichiers.image) files.push({ key: 'd:image', title: "Image de l'article", sub: fileName(fichiers.image) })
	if (fichiers.trace_decoupe) files.push({ key: 'd:trace_decoupe', title: 'Tracé forme de découpe', sub: fileName(fichiers.trace_decoupe) })
	if (fichiers.fiche_technique) files.push({ key: 'd:fiche_technique', title: 'BAT', sub: `${fileName(fichiers.fiche_technique)}, validé pour l'origine` })
	const autres = article.documents.filter((row) => !row.roles.length)
	if (autres.length) files.push({ key: 'd:documents', title: 'Autres documents', sub: `${autres.length > 1 ? `${autres.length} fichiers` : '1 fichier'} : ${autres.map((row) => row.file_name).join(', ')}` })
	if (article.tags.length) files.push({ key: 'd:tags', title: 'Tags', sub: article.tags.join(', ') })

	return {
		rubriques: ficheRubriques(article, schema),
		prepresse: pre,
		fichiers: files,
		sous: article.compose ? article.sous_articles.map((row) => ({ key: `s:${row.name}`, title: row.designation, sub: `Depuis ${row.name} · quantité ${formatQuantity(row.quantite)}` })) : [],
	}
}

function withoutRefused(model: DuplicateModel, keys: Set<string>) {
	for (const row of [...model.prepresse, ...model.fichiers]) if (row.refused) keys.delete(row.key)
	return keys
}

/** Sélection d'un départ. Le BAT n'y est jamais : il se coche à la main, en connaissance de cause. */
export function presetKeys(model: DuplicateModel, preset: DuplicatePreset, otherClient = false) {
	const keys = new Set<string>()
	for (const rubrique of model.rubriques) {
		if (preset === 'forme' && VISUAL_RUBRIQUES.has(rubrique.key)) continue
		for (const field of rubrique.fields) keys.add(field.key)
	}
	for (const row of [...model.prepresse, ...model.fichiers]) {
		if (row.key === 'd:fiche_technique') continue
		if (preset === 'tout' || (preset === 'forme' && FORME_ITEMS.has(row.key))) keys.add(row.key)
	}
	for (const row of model.sous) keys.add(row.key)
	if (otherClient) for (const key of CLIENT_ITEMS) keys.delete(key)
	return withoutRefused(model, keys)
}

export function withoutClientItems(keys: Set<string>) {
	const next = new Set(keys)
	for (const key of CLIENT_ITEMS) next.delete(key)
	return next
}

export function currentPreset(model: DuplicateModel, keys: Set<string>, otherClient = false): DuplicatePreset | null {
	const same = (other: Set<string>) => other.size === keys.size && [...other].every((key) => keys.has(key))
	return DUPLICATE_PRESETS.find(({ key }) => same(presetKeys(model, key, otherClient)))?.key ?? null
}

/** Décocher le tracé décoche l'imposition qui en dépend. */
export function toggleKey(model: DuplicateModel, keys: Set<string>, key: string) {
	const next = new Set(keys)
	if (next.has(key)) {
		next.delete(key)
		for (const row of model.prepresse) if (row.needs === key) next.delete(row.key)
	} else next.add(key)
	return next
}

export function toggleRubrique(keys: Set<string>, rubrique: DuplicateRubrique) {
	const next = new Set(keys)
	const all = rubrique.fields.every((field) => next.has(field.key))
	for (const field of rubrique.fields) {
		if (all) next.delete(field.key)
		else next.add(field.key)
	}
	return next
}

export function allKeys(model: DuplicateModel) {
	return [...model.rubriques.flatMap((rubrique) => rubrique.fields), ...model.prepresse, ...model.fichiers, ...model.sous].map((row) => row.key)
}

export interface DuplicateKeep {
	fields: string[]
	teintes: number[]
	prepresse: string[]
	fichiers: string[]
	documents: boolean
	tags: boolean
	sous_articles: string[]
}

export function keepPayload(keys: Set<string>): DuplicateKeep {
	const after = (prefix: string) => [...keys].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))
	return {
		fields: after('f:'),
		teintes: after('t:').map(Number).sort((left, right) => left - right),
		prepresse: after('p:'),
		fichiers: after('d:').filter((key) => key !== 'documents' && key !== 'tags'),
		documents: keys.has('d:documents'),
		tags: keys.has('d:tags'),
		sous_articles: after('s:'),
	}
}

/** Reprises possibles mais douteuses : on les signale sans les interdire. */
export function duplicateWarnings(article: ArticleDetail, model: DuplicateModel, keys: Set<string>, clientLabel: string, otherClient: boolean) {
	const prepresse: string[] = []
	const fichiers: string[] = []
	const has = (title: string) => model.rubriques.find((rubrique) => rubrique.key === title)?.fields.some((field) => keys.has(field.key))
	const exists = (title: string) => model.rubriques.some((rubrique) => rubrique.key === title)
	const origin = article.client_label || article.client || ''
	if (keys.has('p:trace') && exists('Format') && !has('Format')) prepresse.push("Le tracé a été fait pour le format de l'origine. Sans ses cotations, vérifiez qu'il convient au nouvel article.")
	if (keys.has('p:maquette') && exists('Couleurs') && !has('Couleurs')) prepresse.push("La maquette reprise suppose les couleurs de l'origine, que le nouvel article n'aura pas.")
	if (keys.has('p:maquette') && otherClient) prepresse.push(`Cette maquette porte le visuel de ${origin} : vérifiez que ${clientLabel} peut l'utiliser.`)
	if (keys.has('d:image') && otherClient) fichiers.push(`Cette image montre un produit de ${origin}.`)
	if (keys.has('d:fiche_technique')) fichiers.push(`Ce BAT a été validé pour ${article.designation}. Il suivra comme simple pièce : le nouvel article reste sans BAT validé.`)
	return { prepresse, fichiers }
}

/** Ce que l'étape Vérifier annonce, rubrique par rubrique. */
export function duplicateSummary(model: DuplicateModel, keys: Set<string>) {
	const counted = model.rubriques.map((rubrique) => ({ title: rubrique.title, total: rubrique.fields.length, on: rubrique.fields.filter((field) => keys.has(field.key)).length }))
	const rows = (list: DuplicateItem[], kept: boolean) => list.filter((row) => keys.has(row.key) === kept).map((row) => row.title)
	const keptFiche = counted.filter((item) => item.on).map((item) => (item.on === item.total ? item.title : `${item.title} (${item.on} sur ${item.total})`))
	const leftFiche = counted.filter((item) => item.on < item.total).map((item) => (item.on ? `${item.title} (${item.total - item.on} sur ${item.total})` : item.title))
	const lines = (fiche: string[], kept: boolean) =>
		[
			{ title: 'Fiche technique', present: model.rubriques.length > 0, items: fiche },
			{ title: 'Sous-articles', present: model.sous.length > 0, items: rows(model.sous, kept) },
			{ title: 'Prépresse', present: model.prepresse.length > 0, items: rows(model.prepresse, kept) },
			{ title: 'Fichiers et tags', present: model.fichiers.length > 0, items: rows(model.fichiers, kept) },
		]
			.filter((line) => line.present)
			.map((line) => ({ title: line.title, text: line.items.join(', ') || 'Rien' }))
	return { kept: lines(keptFiche, true), left: lines(leftFiche, false) }
}

export function nextSteps(model: DuplicateModel, keys: Set<string>, compose: boolean) {
	if (compose) return ['Compléter la prépresse de chaque sous-article.', 'Faire valider un BAT pour chacun.']
	const hasTrace = keys.has('p:trace') || keys.has('d:trace_decoupe')
	return [keys.has('p:maquette') ? "Référencer la maquette reprise, puis l'activer." : 'Créer la maquette.', hasTrace ? 'Vérifier le tracé repris.' : 'Créer le tracé.', 'Créer le BAT et le faire valider.', "Refaire l'étude technique."]
}

/** Ce qui reste sur l'origine, avec les nombres réels de cet article. */
export function neverText(article: ArticleDetail) {
	const counted = (count: number, one: string, many: string) => (count ? `${count > 1 ? many : one} (${count})` : many)
	const oldVersions = article.prepresse.maquettes.length - (maquetteToCopy(article) ? 1 : 0)
	return [
		'le code',
		counted(article.prepresse.bats.length, 'la fiche BAT', 'les fiches BAT'),
		counted(article.prepresse.etudes_techniques.length, "l'étude technique", 'les études techniques'),
		counted(article.devis.length, 'le devis', 'les devis'),
		counted(article.commandes.length, 'la commande', 'les commandes'),
		'la consommation annuelle',
		...(oldVersions > 0 ? [oldVersions > 1 ? `les ${oldVersions} anciennes versions de maquette` : "l'ancienne version de maquette"] : []),
		'le fil de commentaires',
	].join(', ')
}

/** Le suffixe du sous-article suit la désignation du nouveau parent, comme le fait le serveur. */
export function sousDesignation(parent: string, child: string, target: string) {
	const upperTarget = target.trim().toUpperCase()
	return child.startsWith(parent) ? `${upperTarget}${child.slice(parent.length)}` : `${upperTarget}-${child}`
}
