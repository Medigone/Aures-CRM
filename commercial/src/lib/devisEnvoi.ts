/** Envoi d'un devis validé au client : PDF, partage (WhatsApp ou autre application), email. Toujours en ligne. */
import { call } from './api'
import type { Devis } from '@/types'

const ENVOI = 'aurescrm.api.devis_envoi'

export interface EnvoiInfo {
	name: string
	peut_envoyer: boolean
	envoi: { le: string; par: string | null; par_nom: string | null; canal: string | null } | null
	email: string | null
	telephone: string | null
	message: string
	canaux: string[]
}

export const getEnvoi = (name: string) => call<EnvoiInfo>(`${ENVOI}.get_envoi`, { name })
export const sendDevisEmail = (name: string, destinataire: string, message: string) => call<{ envoi: EnvoiInfo['envoi'] }>(`${ENVOI}.send_devis_email`, { name, destinataire, message }, true)
export const markDevisSent = (name: string, canal: string) => call<{ envoi: EnvoiInfo['envoi'] }>(`${ENVOI}.mark_devis_sent`, { name, canal }, true)
export const devisPdfUrl = (name: string) => `/api/method/${ENVOI}.get_devis_pdf?name=${encodeURIComponent(name)}`

const OUVERTS = ['Open', 'Replied', 'Partially Ordered']

/** Où en est l'envoi d'un devis : rien à faire, à envoyer, ou envoyé. */
export function envoiState(devis: Pick<Devis, 'docstatus' | 'status' | 'envoye_le'>): 'a_envoyer' | 'envoye' | null {
	if (devis.docstatus !== 1 || !OUVERTS.includes(devis.status)) return devis.envoye_le ? 'envoye' : null
	return devis.envoye_le ? 'envoye' : 'a_envoyer'
}

/** Numéro pour WhatsApp : chiffres seuls, un 0 national devient l'indicatif algérien. */
export function whatsappNumber(phone: string | null | undefined) {
	const digits = (phone ?? '').replace(/\D/g, '')
	if (!digits) return ''
	if (digits.startsWith('00')) return digits.slice(2)
	if (digits.startsWith('0')) return `213${digits.slice(1)}`
	return digits
}

export function whatsappUrl(phone: string | null | undefined, text: string) {
	const number = whatsappNumber(phone)
	return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

export async function fetchDevisPdf(name: string) {
	const response = await fetch(devisPdfUrl(name), { credentials: 'same-origin' })
	if (!response.ok) throw new Error(response.status === 403 ? "Vous ne pouvez pas obtenir le PDF de ce devis." : 'Le PDF du devis n\'a pas pu être préparé.')
	return new File([await response.blob()], `${name}.pdf`, { type: 'application/pdf' })
}

/** Le téléphone sait-il partager ce fichier vers une autre application ? */
export function canShareFile(file: File) {
	return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** Partage annulé par l'utilisateur : ce n'est pas une erreur, rien n'est parti. */
export const isShareAbort = (error: unknown) => (error as { name?: string })?.name === 'AbortError'
