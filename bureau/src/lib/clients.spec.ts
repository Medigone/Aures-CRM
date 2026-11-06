import { describe, expect, it } from 'vitest'
import { changedValues, clientFormValues, clientSortText, formatAmount, normalizeName, validateClient, visibleClientColumns, type ClientDetail, type ClientOptions } from './clients'
import { ticketsToCsv } from './list'

const options = { statuses: ['Actif'], wilayas: ['Sétif'], categories: ['Commercial'], formes: [], sensibilites: [], groupes: [], commercials: [{ value: 'n@example.com', label: 'Nadia Haddad' }], nobody: '__nobody__' } as ClientOptions

describe('clients', () => {
	it('écrit les montants avec une espace pour les milliers', () => {
		expect(formatAmount(1240000)).toBe('1 240 000')
		expect(formatAmount(0)).toBe('0')
		expect(formatAmount(null)).toBe('0')
	})

	it('garde toujours la colonne Client et masque le code par défaut', () => {
		expect(visibleClientColumns(['status', 'inconnue']).map((column) => column.key)).toEqual(['client', 'status'])
		expect(clientSortText(null)).toBe('Tri : nom')
		expect(clientSortText({ key: 'creance', dir: 'desc' })).toBe('Tri : créance (da)')
	})

	it('exige les champs du Customer et le commercial', () => {
		expect(Object.keys(validateClient({ customer_name: '  ' }))).toEqual(['customer_name', 'forme_juridique', 'categorie', 'commune', 'commercial'])
		expect(validateClient({ customer_name: 'A', forme_juridique: 'SPA', categorie: 'Commercial', commune: 'Akbou', commercial: 'n@example.com' })).toEqual({})
	})

	it("n'envoie que les champs changés", () => {
		const client = { client: 'ATLAS', status: 'Actif', forme_juridique: 'SPA', categorie: 'Commercial', commune: 'Akbou', commercial_user: 'n@example.com', contact: null, telephone: null, email: null, groupe: null, sensibilites: { prix: null, delais: null, qualite: null, process: null }, pieces: [{ key: 'rc', label: 'Nº RC', numero: '19 B', fichier: null }] } as unknown as ClientDetail
		const initial = clientFormValues(client)
		expect(initial.rc).toBe('19 B')
		expect(changedValues(initial, { ...initial })).toEqual({})
		expect(changedValues(initial, { ...initial, status: 'Dormant', rc: '', contact: ' K. Hamdi ' })).toEqual({ status: 'Dormant', contact: 'K. Hamdi', rc: '' })
	})

	it('repère un doublon sans accents ni casse', () => {
		expect(normalizeName('  Fromagérie   de SÉTIF ')).toBe('fromagerie de setif')
	})

	it('exporte toutes les colonnes affichées', () => {
		const row = { client: 'ATLAS', creance: 1240000.4, tickets: 2 } as never
		expect(ticketsToCsv([row], visibleClientColumns(['creance', 'tickets']))).toBe('﻿Client;Créance (DA);Tickets\r\nATLAS;1240000;2')
	})
})
