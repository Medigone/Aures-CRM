/** Droits renvoyés par le serveur au chargement. Ils servent à l'affichage : le serveur reste seul juge. */

/** Sans information sur un document, l'interface le propose et laisse le serveur répondre. Plusieurs documents : un seul lisible suffit. */
export function canRead(doctype?: string | string[]) {
	if (!doctype) return true
	return (Array.isArray(doctype) ? doctype : [doctype]).some((name) => window.droits?.[name]?.read ?? true)
}

export function canCreate(doctype?: string | string[]) {
	if (!doctype) return true
	return (Array.isArray(doctype) ? doctype : [doctype]).some((name) => window.droits?.[name]?.create ?? true)
}
