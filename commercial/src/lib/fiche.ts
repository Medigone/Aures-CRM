import type { Article, FicheField, FicheSchema } from '@/types'

/**
 * Fiche technique d'un article : les conditions d'affichage du Desk (`depends_on`, en JavaScript) sont évaluées
 * sur les valeurs de l'article, comme le fait le formulaire Item. Un article Offset ne montre que les champs Offset.
 */
export type FicheDoc = Record<string, any>

/** Document évalué : l'identité de l'article (procédé, type…) et les valeurs de sa fiche. */
export function ficheDoc(article: Pick<Article, 'designation' | 'client' | 'procede' | 'compose' | 'sous_article'>, fiche: Record<string, any> = {}): FicheDoc {
	return {
		custom_type_article: 'Client',
		custom_client: article.client,
		custom_procédé: article.procede,
		custom_article_compose: article.compose || 0,
		custom_sous_article: article.sous_article || 0,
		item_code: article.designation,
		item_name: article.designation,
		...fiche,
	}
}

const compiled = new Map<string, ((doc: FicheDoc) => unknown) | null>()

function compile(expression: string) {
	if (!compiled.has(expression)) {
		const code = expression.trim()
		let fn: ((doc: FicheDoc) => unknown) | null = null
		try {
			// « eval: doc.x == 'y' » : expression du Desk ; sinon un nom de champ, vrai s'il est renseigné.
			fn = code.startsWith('eval:')
				? (new Function('doc', `return (${code.slice(5)})`) as (doc: FicheDoc) => unknown)
				: (doc: FicheDoc) => doc[code]
		} catch {
			fn = null
		}
		compiled.set(expression, fn)
	}
	return compiled.get(expression)!
}

/** Condition d'affichage vraie ? Une expression illisible ou en erreur laisse le champ visible (comme le Desk). */
export function conditionHolds(expression: string, doc: FicheDoc) {
	const fn = compile(expression)
	if (!fn) return true
	try {
		return Boolean(fn(doc))
	} catch {
		return true
	}
}

export const fieldVisible = (field: FicheField, doc: FicheDoc) => field.conditions.every((c) => conditionHolds(c, doc))

/** Valeurs sans information affichées comme vides (« Sans », 0). */
const EMPTY = new Set(['', '0', 'Sans', 'Aucun'])
export const isEmptyValue = (value: unknown) => value == null || EMPTY.has(String(value).trim())

export type FicheRow = { field: FicheField; value: string | number }
export type FicheGroup = { label: string; rows: FicheRow[]; checks: FicheField[] }

/** Groupes visibles et renseignés de la fiche, pour la lecture : valeurs d'un côté, cases cochées de l'autre. */
export function ficheGroups(schema: FicheSchema | undefined, doc: FicheDoc): FicheGroup[] {
	if (!schema) return []
	return schema.groups
		.map((group) => {
			const visible = group.fields.filter((f) => fieldVisible(f, doc))
			return {
				label: group.label,
				rows: visible.filter((f) => f.fieldtype !== 'Check' && !isEmptyValue(doc[f.fieldname])).map((field) => ({ field, value: doc[field.fieldname] })),
				checks: visible.filter((f) => f.fieldtype === 'Check' && Number(doc[f.fieldname])),
			}
		})
		.filter((g) => g.rows.length || g.checks.length)
}

/** Groupes visibles pour la saisie (tous les champs, vides compris). */
export function editableGroups(schema: FicheSchema | undefined, doc: FicheDoc) {
	if (!schema) return []
	return schema.groups.map((g) => ({ label: g.label, fields: g.fields.filter((f) => fieldVisible(f, doc)) })).filter((g) => g.fields.length)
}

/** Libellé du groupe : « Offset » devient « Impression », les autres gardent le titre du Desk. */
export const groupTitle = (label: string) => ({ Offset: 'Impression', Flexo: 'Support et bobine' })[label] || label

export function formatFicheValue(field: FicheField, value: unknown) {
	if (field.fieldtype === 'Int' && typeof value === 'number') return new Intl.NumberFormat('fr-FR').format(value)
	return String(value)
}
