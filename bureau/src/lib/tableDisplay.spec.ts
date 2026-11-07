import { beforeEach, describe, expect, it } from 'vitest'
import type { Column } from './list'
import { capMainColumn, clearTablePrefs, minColumnWidth, opaqueId, pinnedFirst, pinOffsets, readTablePrefs, stickyCount, tableStorageKey, writeTablePrefs } from './tableDisplay'

const cols = (...keys: string[]) => keys.map((key) => ({ key, label: key, width: 100, sortable: false, text: () => '' })) as Column<unknown>[]

describe('clé des réglages', () => {
	it('sépare les utilisateurs et les sites, sans écrire le compte en clair', () => {
		const key = tableStorageKey('tickets', 'site.test', 'amine@example.com')
		expect(key).toMatch(/^aures:bureau:tickets:v1:site\.test:/)
		expect(key).not.toContain('amine')
		expect(key).not.toBe(tableStorageKey('tickets', 'site.test', 'autre@example.com'))
		expect(key).not.toBe(tableStorageKey('tickets', 'autre.test', 'amine@example.com'))
		expect(key).not.toBe(tableStorageKey('clients', 'site.test', 'amine@example.com'))
		expect(key).toBe(tableStorageKey('tickets', 'site.test', 'amine@example.com'))
		expect(opaqueId('a')).not.toBe(opaqueId('b'))
	})
})

describe('préférences', () => {
	const key = 'test-affichage'
	beforeEach(() => localStorage.clear())

	it('relit ce qui a été écrit', () => {
		writeTablePrefs(key, { pinned: ['a', 'b'], density: 'compact' })
		expect(readTablePrefs(key)).toEqual({ pinned: ['a', 'b'], density: 'compact' })
	})

	it.each([
		['du JSON abîmé', '{oups'],
		['une autre version', '{"v":2,"pinned":["a"],"density":"compact"}'],
		['une valeur qui n\'est pas un objet', '12'],
	])('revient aux valeurs par défaut avec %s', (_, raw) => {
		localStorage.setItem(`${key}:affichage`, raw)
		expect(readTablePrefs(key)).toEqual({ pinned: [], density: 'normal' })
	})

	it('écarte les valeurs inconnues et les doublons', () => {
		localStorage.setItem(`${key}:affichage`, '{"v":1,"pinned":["a",3,"a",null,""],"density":"géante"}')
		expect(readTablePrefs(key)).toEqual({ pinned: ['a'], density: 'normal' })
	})

	it("n'efface que l'affichage de cette liste", () => {
		for (const item of [key, `${key}:largeurs`, `${key}:affichage`, `${key}:vue`, 'bureau-clients-colonnes']) localStorage.setItem(item, '[]')
		clearTablePrefs(key)
		expect(localStorage.getItem(key)).toBeNull()
		expect(localStorage.getItem(`${key}:largeurs`)).toBeNull()
		expect(localStorage.getItem(`${key}:affichage`)).toBeNull()
		expect(localStorage.getItem(`${key}:vue`)).toBe('[]')
		expect(localStorage.getItem('bureau-clients-colonnes')).toBe('[]')
	})
})

describe('épinglage', () => {
	it('place la colonne verrouillée, puis les épinglées, puis le reste dans son ordre', () => {
		const order = pinnedFirst(cols('client', 'a', 'b', 'c', 'd'), ['c', 'a'], 'client').map(({ key }) => key)
		expect(order).toEqual(['client', 'a', 'c', 'b', 'd'])
	})

	it('ignore une colonne épinglée qui a disparu', () => {
		expect(pinnedFirst(cols('client', 'a'), ['fantome'], 'client').map(({ key }) => key)).toEqual(['client', 'a'])
	})

	it('calcule les décalages pour des largeurs différentes', () => {
		expect(pinOffsets([140, 100.5, 60], 33)).toEqual([33, 181, 289.5])
	})

	it('garde fixes les colonnes qui tiennent, et ne suspend rien tant que la largeur est inconnue', () => {
		expect(stickyCount([140, 100, 100], 33, 1000, false)).toBe(3)
		expect(stickyCount([140, 200, 200, 200], 33, 800, false)).toBe(2)
		expect(stickyCount([140, 100], 33, 0, false)).toBe(2)
		expect(stickyCount([600], 33, 800, false)).toBe(0)
	})

	it('réduit la seule colonne principale sur petit écran', () => {
		const columns = [{ ...cols('client')[0], width: 210, grow: 2 }, { ...cols('a')[0], width: 300 }]
		const capped = capMainColumn(columns, 'client')
		expect(capped[0]).toMatchObject({ width: 140, grow: undefined })
		expect(capped[1].width).toBe(300)
		expect(columns[0].width).toBe(210)
	})

	it('ne garde que la première sur petit écran', () => {
		expect(stickyCount([140, 100], 33, 390, true)).toBe(1)
	})
})

describe('largeur minimale', () => {
	it('prend celle de la colonne, ou le minimum commun', () => {
		expect(minColumnWidth({ minWidth: 120 })).toBe(120)
		expect(minColumnWidth({})).toBe(56)
	})
})
