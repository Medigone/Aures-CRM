/**
 * Brouillon de la fenêtre Nouvel article, gardé dans ce navigateur : il survit à une fermeture par erreur,
 * à une page rechargée, à une session expirée et à une coupure réseau. Rien n'est créé sur le serveur.
 */
import type { ArticleTeinte } from './articles'
import type { ClientChoice } from '@/types'

const PREFIX = 'bureau-article-brouillon'
export const DRAFT_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000

export interface ArticleDraft {
	savedAt: number
	phase: 1 | 2
	values: { type: string; designation: string; procede: string; reference: string; groupe: string; ancien_code: string; consommation: string }
	client: ClientChoice | null
	fiche: Record<string, string>
	ficheProcede: string
	teintes?: ArticleTeinte[]
}

function currentUser() {
	const cookie = document.cookie.match(/(?:^|;\s*)user_id=([^;]*)/)?.[1]
	return cookie ? decodeURIComponent(cookie) : window.user || ''
}

/** Un brouillon par utilisateur ; ouverte depuis un client, la fenêtre garde le sien à part. */
function draftKey(client?: string) {
	return [PREFIX, currentUser(), client || ''].join(':')
}

export function loadDraft(client?: string, now = Date.now()): ArticleDraft | null {
	try {
		const draft = JSON.parse(localStorage.getItem(draftKey(client)) || 'null') as ArticleDraft | null
		if (!draft?.values || now - draft.savedAt > DRAFT_LIFETIME_MS) {
			clearDraft(client)
			return null
		}
		return draft
	} catch {
		return null
	}
}

export function saveDraft(draft: ArticleDraft, client?: string) {
	try {
		localStorage.setItem(draftKey(client), JSON.stringify(draft))
	} catch {
		/* Stockage plein ou bloqué : la saisie continue, sans brouillon. */
	}
}

export function clearDraft(client?: string) {
	try {
		localStorage.removeItem(draftKey(client))
	} catch {
		/* Stockage bloqué : rien à retirer. */
	}
}
