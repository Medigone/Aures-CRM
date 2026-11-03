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
	return /^(https?:\/\/|data:)/.test(path) || path.startsWith('/') ? path : `/${path}`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** « YYYY-MM-DD HH:mm:ss » (serveur) → valeur d'un champ `datetime-local`. */
export function toInputDateTime(value?: string | null): string {
	return value ? value.replace(' ', 'T').slice(0, 16) : ''
}

/** Valeur d'un champ `datetime-local` → « YYYY-MM-DD HH:mm:ss » (serveur), ou null. */
export function fromInputDateTime(value?: string | null): string | null {
	if (!value) return null
	const [day, time = '00:00'] = value.split('T')
	return `${day} ${time.slice(0, 5)}:00`
}

/** Maintenant + `minutes`, au format d'un champ `datetime-local` (minutes arrondies au quart d'heure). */
export function inputDateTimeIn(minutes = 0, now = new Date()): string {
	const date = new Date(now.getTime() + minutes * 60000)
	date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** Position GPS au format du Desk (« lat, lon »). */
export function gpsText(point: { latitude: number; longitude: number } | null): string | null {
	return point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : null
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
