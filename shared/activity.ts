/** Fil de commentaires et d'activité : types et dates, communs à toutes les applications. */

export interface CommentPart {
	text: string
	mention: boolean
}

export interface Mention {
	id: string
	label: string
}

export interface ActivityChange {
	label: string
	old: string
	new: string
}

export interface ActivityItem {
	id: string
	kind: 'comment' | 'change' | 'assign' | 'file' | 'mail' | 'create' | 'info'
	who: string
	at: string
	text?: string
	mine?: boolean
	parts?: CommentPart[]
	mentions?: Mention[]
	changes?: ActivityChange[]
	link?: { label: string; url: string | null }
	/** Fin de phrase après le lien : ce à quoi le fichier joint sert. */
	after?: string
}

export interface ActivityFeedData {
	items: ActivityItem[]
	comment_count: number
}

/** Ce que l'application fournit au fil : ses méthodes de lecture et d'écriture pour le document affiché. */
export interface ActivityApi {
	load: () => Promise<ActivityFeedData>
	add: (text: string, mentions: Mention[]) => Promise<ActivityFeedData>
	update: (comment: string, text: string, mentions: Mention[]) => Promise<ActivityFeedData>
	remove: (comment: string) => Promise<ActivityFeedData>
	mentionCandidates: () => Promise<Mention[]>
}

export function parseServerDate(value: string) {
	const [day, time = '00:00:00'] = value.split(/[ T]/)
	const [year, month, date] = day.split('-').map(Number)
	const [hours, minutes, seconds] = time.split(':').map((part) => Math.floor(Number(part)))
	return new Date(year, month - 1, date, hours, minutes, seconds || 0)
}

const pad = (value: number) => String(value).padStart(2, '0')

/** « Il y a 5 min », « Hier », « Le 30/10 » ; l'année n'apparaît que si elle diffère. */
export function relativeTime(value: string, now = new Date()) {
	const at = parseServerDate(value)
	const minutes = Math.floor((now.getTime() - at.getTime()) / 60000)
	if (minutes < 1) return "À l'instant"
	if (minutes < 60) return `Il y a ${minutes} min`
	const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
	const days = Math.round((startOfDay(now) - startOfDay(at)) / 86400000)
	if (days === 0) return `Il y a ${Math.floor(minutes / 60)} h`
	if (days === 1) return 'Hier'
	const short = `${pad(at.getDate())}/${pad(at.getMonth() + 1)}`
	return at.getFullYear() === now.getFullYear() ? `Le ${short}` : `Le ${short}/${at.getFullYear()}`
}

export function exactTime(value: string) {
	const at = parseServerDate(value)
	return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()} à ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** Mention en cours de saisie juste avant le curseur : le texte après `@`, ou `null`. */
export function mentionQuery(textBeforeCaret: string) {
	const match = /(?:^|\s)@([^\s@]*)$/.exec(textBeforeCaret)
	return match ? match[1] : null
}

/** Remplace la mention en cours par le nom choisi et renvoie le texte et la position du curseur. */
export function insertMention(text: string, caret: number, label: string) {
	const before = text.slice(0, caret).replace(/@[^\s@]*$/, `@${label} `)
	return { text: before + text.slice(caret), caret: before.length }
}

export function initialsOf(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.map((word) => word.charAt(0))
		.join('')
		.slice(0, 2)
		.toUpperCase()
}
