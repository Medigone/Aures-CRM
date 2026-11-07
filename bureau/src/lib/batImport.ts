/** Import d'un BAT : ce que l'analyse propose, comparé à l'article, puis ce qui part au serveur après vérification. */
import type { FicheField } from '@shared/fiche'
import { teintesPayload, type ArticleDetail, type ArticleTeinte, type ArticleValues, type PantoneMatch, type TeintePayload } from './articles'

export interface BatProposal {
	key: string
	fieldname: string | null
	label: string
	fieldtype: string
	value: string
	raw: string
	source: string
}
export interface BatInformation {
	label: string
	value: string
}
export type BatGap = TeintePayload & PantoneMatch & { source: 'legende' | 'fichier' }
export interface BatAnalysis {
	propositions: BatProposal[]
	informations: BatInformation[]
	teintes: ArticleTeinte[]
	ecarts: BatGap[]
}
export interface BatRow {
	key: string
	fieldname: string | null
	field: FicheField
	value: string
	current: string
	checked: boolean
}

const COTATIONS_FIELD = 'custom_cotations_article'
export const BAT_PDF_REFUSAL = 'Choisissez un fichier PDF.'
export function batFileCheck(file: File) {
	return file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? '' : BAT_PDF_REFUSAL
}

function currentValue(proposal: BatProposal, article: ArticleDetail) {
	if (!proposal.fieldname) return article.reference?.trim() ?? ''
	const value = article.fiche[proposal.fieldname]
	return value == null ? '' : String(value).trim()
}

/** Une ligne par champ à décider : un champ vide est coché, une valeur différente ne remplace rien sans qu'on coche. */
export function batRows(proposals: BatProposal[], article: ArticleDetail, fieldOf: (fieldname: string) => FicheField | undefined) {
	const rows: BatRow[] = []
	const same: string[] = []
	const hidden: BatInformation[] = []
	for (const proposal of proposals) {
		const field = proposal.fieldname ? fieldOf(proposal.fieldname) : { fieldname: 'reference', label: proposal.label, fieldtype: 'Data', conditions: [] }
		if (!field) {
			// Champ absent de ce procédé : la valeur lue reste visible, sans être proposée.
			if (!hidden.some((item) => item.value === proposal.raw)) hidden.push({ label: `${proposal.source} lu`, value: proposal.raw })
			continue
		}
		const current = currentValue(proposal, article)
		if (current === proposal.value || (field.fieldtype === 'Check' && Number(current) === Number(proposal.value))) same.push(proposal.label)
		else rows.push({ key: proposal.key, fieldname: proposal.fieldname, field, value: proposal.value, current, checked: !current })
	}
	return { rows, same, hidden }
}

/** Les cotations que l'article tient de ce BAT : reprises, ou déjà identiques. Une valeur différente laissée de côté n'en vient pas. */
export function batCotations(proposals: BatProposal[], rows: BatRow[]) {
	const proposal = proposals.find((item) => item.fieldname === COTATIONS_FIELD)
	if (!proposal) return null
	const row = rows.find((item) => item.fieldname === COTATIONS_FIELD)
	if (!row) return proposal.value
	return row.checked && row.value.trim() ? row.value.trim() : null
}

/** Ce que coche l'utilisateur, ou rien : le fichier peut alors partir seul. */
export function batUpdate(rows: BatRow[], teintes: ArticleTeinte[] | null, cotations: string | null = null): ArticleValues | null {
	const chosen = rows.filter((row) => row.checked && row.value.trim())
	const fiche = Object.fromEntries(chosen.filter((row) => row.fieldname).map((row) => [row.fieldname!, row.value.trim()]))
	const reference = chosen.find((row) => !row.fieldname)
	const values: ArticleValues = {}
	if (reference) values.reference = reference.value.trim()
	if (Object.keys(fiche).length) values.fiche = fiche
	if (teintes) values.teintes = teintesPayload(teintes)
	if (cotations) values.bat_cotations = cotations
	return Object.keys(values).length ? values : null
}

/** Mêmes couleurs dans le même ordre ou non : compare les codes et les nuances, sans le nom ni l'affichage. */
export function sameColors(left: ArticleTeinte[], right: ArticleTeinte[]) {
	const codes = (lines: ArticleTeinte[]) => lines.map((line) => line.code.trim().toUpperCase()).sort().join('|')
	return codes(left) === codes(right)
}
