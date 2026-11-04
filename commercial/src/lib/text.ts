export { fileUrl, formatMoney, htmlToText } from '@shared/text'

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

/** « YYYY-MM-DD » du jour, heure locale. */
export function todayIso(now = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
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

/** Initiales d'un nom, pour l'avatar : les deux premiers mots. */
export function initiales(name?: string | null): string {
	const words = (name || '').trim().split(/\s+/).filter(Boolean)
	return words.length ? words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') : '?'
}
