/** Droits renvoyés par le serveur au chargement. Ils servent à l'affichage : le serveur reste seul juge. */

/** Sans information sur un document, l'interface le propose et laisse le serveur répondre. */
export function canRead(doctype?: string) {
	return !doctype || (window.droits?.[doctype]?.read ?? true)
}

export function canCreate(doctype?: string) {
	return !doctype || (window.droits?.[doctype]?.create ?? true)
}
