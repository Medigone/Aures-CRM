/** Mise en forme partagée entre les applications Aures. */

/** Montant en dinars, sans décimales inutiles. */
export function formatMoney(value?: number | null, currency = 'DZD'): string {
	if (value == null) return '—'
	return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency}`
}

/** URL d'un fichier Frappe (/files, /private/files) ou absolue. */
export function fileUrl(path?: string | null): string | null {
	if (!path) return null
	return /^(https?:\/\/|data:)/.test(path) || path.startsWith('/') ? path : `/${path}`
}

/** Texte d'un champ Text Editor du Desk en gardant ses paragraphes et retours à la ligne (affichage `whitespace-pre-line`). */
export function htmlToText(value?: string | null): string {
	if (!value) return ''
	return value
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h\d)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}
