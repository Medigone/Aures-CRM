import { describe, expect, it } from 'vitest'
import { filterCommands, moveCursor, normalize, PALETTE_COMMANDS, shortcutLabel } from './palette'

const labels = (query: string) => filterCommands(PALETTE_COMMANDS, query).map((command) => command.label)

describe('palette de commandes', () => {
	it('propose tout sans saisie, créations en tête', () => {
		expect(filterCommands(PALETTE_COMMANDS, '  ')).toHaveLength(PALETTE_COMMANDS.length)
		expect(PALETTE_COMMANDS.slice(0, 3).map((command) => command.action)).toEqual([
			{ type: 'create', kind: 'ticket' },
			{ type: 'create', kind: 'article' },
			{ type: 'create', kind: 'client' },
		])
	})

	it('ignore les accents et les majuscules', () => {
		expect(normalize('Créances')).toBe('creances')
		expect(labels('CREANCE')).toContain('Créances')
	})

	it('trouve la création de prospect en tapant « client »', () => {
		expect(labels('client')).toContain('Nouveau prospect')
		expect(labels('créer client')).toEqual(['Nouveau prospect'])
	})

	it('relie une vue à sa liste et à son adresse', () => {
		const [prospects] = filterCommands(PALETTE_COMMANDS, 'clients prospects')
		expect(prospects.hint).toBe('Clients')
		expect(prospects.action).toEqual({ type: 'route', to: { name: 'Clients', query: { vue: 'prospect' } } })
	})

	it('ne répète pas la vue par défaut de chaque liste', () => {
		const ids = PALETTE_COMMANDS.map((command) => command.id)
		expect(ids).not.toContain('list-tickets-todo')
		expect(ids).not.toContain('list-clients-all')
		expect(ids).not.toContain('list-articles-all')
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('fait tourner le curseur', () => {
		expect(moveCursor(2, 3, 1)).toBe(0)
		expect(moveCursor(0, 3, -1)).toBe(2)
		expect(moveCursor(0, 0, 1)).toBe(0)
	})

	it('affiche le raccourci du système', () => {
		expect(shortcutLabel('MacIntel')).toBe('⌘ K')
		expect(shortcutLabel('Linux x86_64')).toBe('Ctrl K')
	})
})
