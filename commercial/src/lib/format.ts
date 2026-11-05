/** Dates au format serveur Frappe (heure locale, sans fuseau) et affichage. */

const pad = (n: number) => String(n).padStart(2, '0')

export function toServerDateTime(date: Date = new Date()): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function parseServerDate(value?: string | null): Date | null {
	if (!value) return null
	// « YYYY-MM-DD » seul serait lu en UTC par `Date` : on le force en heure locale, comme le reste.
	const date = new Date(value.length === 10 ? `${value}T00:00:00` : value.replace(' ', 'T'))
	return Number.isNaN(date.getTime()) ? null : date
}

/** Dimanche de la semaine de `value`, « YYYY-MM-DD » (la semaine de travail commence le dimanche). */
export function weekStart(value: Date | string = new Date()): string {
	const date = typeof value === 'string' ? parseServerDate(value.length === 10 ? `${value} 00:00:00` : value) : new Date(value)
	if (!date) return ''
	date.setHours(0, 0, 0, 0)
	date.setDate(date.getDate() - date.getDay())
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `days` jours après la date « YYYY-MM-DD ». */
export function addDays(day: string, days: number): string {
	const date = parseServerDate(`${day} 00:00:00`) ?? new Date()
	date.setDate(date.getDate() + days)
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function isSameDay(a: Date, b: Date) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatTime(value?: string | null) {
	const date = parseServerDate(value)
	return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '—'
}

export function formatDay(value?: string | null) {
	const date = parseServerDate(value)
	if (!date) return '—'
	return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function relativeDays(value?: string | null) {
	const date = parseServerDate(value)
	if (!date) return 'Jamais'
	// Jours calendaires, heure locale : une date sans heure (lue à minuit) reste « aujourd'hui » toute la journée.
	const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
	// Arrondi : un changement d'heure donne des journées de 23 h ou 25 h.
	const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000)
	if (days <= 0) return "Aujourd'hui"
	if (days === 1) return 'Hier'
	if (days < 30) return `Il y a ${days} j`
	const months = Math.round(days / 30)
	return months < 12 ? `Il y a ${months} mois` : `Il y a ${Math.round(months / 12)} an(s)`
}

export function uid(prefix = ''): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
	return prefix ? `${prefix}-${random}` : random
}

/** Texte comparable pour la recherche : sans accents ni majuscules. */
export function normalizeSearch(value?: string | null) {
	return (value || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
}

/** Mêmes règles que `normalize_cotations_article` côté serveur : 1, 2 ou 3 cotes. `null` si vide ou mal écrit. */
export function normalizeCotations(value: string): string | null {
	const text = value.trim().replace(/\s*mm\s*$/i, '').replace(/\s+/g, '').replace(/[×X]/g, 'x')
	return /^\d+(?:[.,]\d+)?(?:x\d+(?:[.,]\d+)?){0,2}$/.test(text) ? text.replace(/,/g, '.') : null
}
