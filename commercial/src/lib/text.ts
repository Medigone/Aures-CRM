/** Texte brut d'un champ Text Editor du Desk (HTML), pour un aperçu sur une ligne. */
export function stripHtml(value?: string | null): string {
	if (!value) return ''
	return value
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<\/(p|div|li)>/gi, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim()
}

/** Montant en dinars, sans décimales inutiles. */
export function formatMoney(value?: number | null, currency = 'DZD'): string {
	if (value == null) return '—'
	return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value)} ${currency}`
}

/** « YYYY-MM-DD » du jour, heure locale. */
export function todayIso(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** URL d'un fichier Frappe (/files, /private/files) ou absolue. */
export function fileUrl(path?: string | null): string | null {
	if (!path) return null
	return /^https?:\/\//.test(path) || path.startsWith('/') ? path : `/${path}`
}
