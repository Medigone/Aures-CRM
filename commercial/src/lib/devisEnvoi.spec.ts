import { describe, expect, it } from 'vitest'
import { envoiState, whatsappNumber, whatsappUrl } from './devisEnvoi'

describe('envoi du devis', () => {
	it('un devis validé et ouvert est à envoyer, puis envoyé', () => {
		expect(envoiState({ docstatus: 1, status: 'Open', envoye_le: null })).toBe('a_envoyer')
		expect(envoiState({ docstatus: 1, status: 'Open', envoye_le: '2026-11-10 09:12:00' })).toBe('envoye')
		expect(envoiState({ docstatus: 0, status: 'Draft' })).toBeNull()
		expect(envoiState({ docstatus: 1, status: 'Ordered' })).toBeNull()
		expect(envoiState({ docstatus: 1, status: 'Ordered', envoye_le: '2026-11-10' })).toBe('envoye')
	})

	it('le numéro national passe à l indicatif algérien', () => {
		expect(whatsappNumber('0550 12 34 56')).toBe('213550123456')
		expect(whatsappNumber('+213 550 12 34 56')).toBe('213550123456')
		expect(whatsappNumber('00213550123456')).toBe('213550123456')
		expect(whatsappNumber(null)).toBe('')
		expect(whatsappUrl('0550123456', 'Devis A')).toBe('https://wa.me/213550123456?text=Devis%20A')
	})
})
