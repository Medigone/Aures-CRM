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

/** Extension d'un fichier pour sa vignette, depuis son nom ou son adresse. */
export function fileExtension(name: string) {
	const parts = name.split(/[?#]/)[0].split('.')
	return parts.length > 1 ? parts[parts.length - 1].slice(0, 4).toUpperCase() : 'FIC'
}

/** Nom lisible d'un fichier depuis son adresse. */
export function fileName(url: string) {
	const last = url.split(/[?#]/)[0].split('/').pop() ?? url
	try {
		return decodeURIComponent(last)
	} catch {
		return last
	}
}

/** Taille d'un fichier, en français. */
export function formatFileSize(bytes: number) {
	if (!bytes) return '0 Ko'
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
	return `${(bytes / (1024 * 1024)).toFixed(1).replace('.0', '').replace('.', ',')} Mo`
}
