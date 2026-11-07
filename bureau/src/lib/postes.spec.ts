import { afterEach, describe, expect, it } from 'vitest'
import { allowedClientColumns, allowedClientViews } from './clients'
import { allowedCommands, PALETTE_COMMANDS } from './palette'
import { activePoste, availablePostes, navFor, setPoste } from './postes'

const ids = (key: string) => navFor(key).flatMap((group) => group.items.map((item) => item.id))
const noRead = (...doctypes: string[]) => Object.fromEntries(doctypes.map((doctype) => [doctype, { read: false, create: false }]))

afterEach(() => {
	delete window.postes
	delete window.droits
	localStorage.clear()
	setPoste('')
})

describe('postes du bureau', () => {
	it('garde le poste historique sans liste du serveur', () => {
		expect(availablePostes().map((poste) => poste.key)).toEqual(['back_office'])
		expect(activePoste().label).toBe('Back office')
	})

	it('garde le menu actuel du back office', () => {
		expect(ids('back_office')).toEqual(['accueil', 'tickets', 'demandes', 'etudes', 'devis', 'commandes', 'creances', 'clients', 'articles'])
	})

	it('retient le choix et ignore un poste qui n\'est plus à ce compte', () => {
		window.postes = [
			{ key: 'back_office', label: 'Back office' },
			{ key: 'etude', label: 'Étude' },
		]
		setPoste('etude')
		expect(activePoste().key).toBe('etude')
		window.postes = [{ key: 'back_office', label: 'Back office' }]
		expect(activePoste().key).toBe('back_office')
	})

	it('sépare Offset et Flexo par les droits, sans condition sur le procédé', () => {
		window.droits = noRead('Etude Faisabilite', 'Imposition', 'Machine')
		expect(ids('etude')).toContain('etudes')
		expect(ids('etude')).not.toContain('impositions')
		window.droits = noRead('Etude Faisabilite', 'Etude Faisabilite Flexo')
		expect(ids('etude')).not.toContain('etudes')
	})

	it('retire un groupe resté vide', () => {
		window.droits = noRead('Customer', 'Item')
		expect(navFor('back_office').map((group) => group.title)).toEqual(['Mon travail'])
	})
})

describe('palette selon les droits', () => {
	it('propose tout sans information du serveur', () => {
		expect(allowedCommands(PALETTE_COMMANDS)).toHaveLength(PALETTE_COMMANDS.length)
	})

	it('retire les listes non lues et les créations refusées', () => {
		window.droits = { ...noRead('Ticket Commercial', 'Suivi Creance'), Item: { read: true, create: false } }
		const allowed = allowedCommands(PALETTE_COMMANDS).map((command) => command.id)
		expect(allowed).not.toContain('create-ticket')
		expect(allowed).not.toContain('list-tickets')
		expect(allowed).not.toContain('desk-creances')
		expect(allowed).not.toContain('create-article')
		expect(allowed).toContain('list-articles')
		expect(allowed).toContain('create-client')
	})
})

describe('créance selon les droits', () => {
	it('la garde pour qui lit les créances', () => {
		expect(allowedClientColumns().map((column) => column.key)).toContain('creance')
		expect(allowedClientViews().map((view) => view.key)).toContain('creance')
	})

	it('retire colonne, vue et commande aux autres', () => {
		window.droits = noRead('Creance Client')
		expect(allowedClientColumns().map((column) => column.key)).not.toContain('creance')
		expect(allowedClientViews().map((view) => view.key)).not.toContain('creance')
		expect(allowedCommands(PALETTE_COMMANDS).map((command) => command.id)).not.toContain('list-clients-creance')
		expect(allowedCommands(PALETTE_COMMANDS).map((command) => command.id)).toContain('list-clients-prospect')
	})
})
