import { describe, expect, it } from 'vitest'
import { loginUrl, safeRedirect } from './api'

describe('safeRedirect', () => {
	it('garde une page de la PWA', () => {
		expect(safeRedirect('/commercial/clients/CUST-001')).toBe('/commercial/clients/CUST-001')
		expect(safeRedirect('/commercial?tab=1')).toBe('/commercial?tab=1')
	})

	it("refuse un autre site ou une autre partie du site", () => {
		expect(safeRedirect('https://exemple.com/commercial')).toBe('/commercial')
		expect(safeRedirect('//exemple.com')).toBe('/commercial')
		expect(safeRedirect('/app/customer')).toBe('/commercial')
		expect(safeRedirect('/commercialx')).toBe('/commercial')
	})

	it('ne renvoie jamais vers la connexion', () => {
		expect(safeRedirect('/commercial/connexion?redirect-to=/commercial')).toBe('/commercial')
		expect(safeRedirect(null)).toBe('/commercial')
	})
})

describe('loginUrl', () => {
	it("n'ajoute le retour que hors accueil", () => {
		expect(loginUrl()).toBe('/commercial/connexion')
		expect(loginUrl('/commercial/suivi')).toBe('/commercial/connexion?redirect-to=%2Fcommercial%2Fsuivi')
	})
})
