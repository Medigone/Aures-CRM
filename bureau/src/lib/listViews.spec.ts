import { describe, expect, it } from 'vitest'
import type { FilterField } from './filters'
import type { Column } from './list'
import { cleanLayout, fieldCellText, fieldColumn, layoutSignature, layoutSummary, moveColumnBefore, normalizeColumns, readStandardColumns, resizeColumn, resolveColumns, withColumnKeys, writeStandardColumns } from './listViews'

interface Row {
	name: string
}
const field = (kind: FilterField['kind'], extra: Partial<FilterField> = {}) => ({ value: 'Customer.x', doctype: 'Customer', field: 'x', label: 'X', kind, operators: [], ...extra }) as FilterField
const list = { locked: 'client', sortable: ['client', 'status'], views: ['all', 'prospect'], defaultView: 'all', defaultColumns: ['client', 'status'] }
const cols = (...keys: string[]) => keys.map((key) => ({ key }))

describe('colonnes d une vue', () => {
	it('garde la colonne verrouillée en tête et sans doublon', () => {
		expect(normalizeColumns(cols('status', 'client', 'status'), 'client')).toEqual(cols('client', 'status'))
		expect(normalizeColumns(cols('status'), 'client')).toEqual(cols('client', 'status'))
	})

	it('déplace une colonne avant une autre, jamais avant la colonne verrouillée', () => {
		const columns = cols('client', 'a', 'b', 'c')
		expect(moveColumnBefore(columns, 'c', 'a', 'client').map(({ key }) => key)).toEqual(['client', 'c', 'a', 'b'])
		expect(moveColumnBefore(columns, 'c', 'client', 'client')).toBe(columns)
		expect(moveColumnBefore(columns, 'client', 'b', 'client')).toBe(columns)
	})

	it('borne la largeur et sait revenir à celle d origine', () => {
		expect(resizeColumn(cols('a'), 'a', 3)).toEqual([{ key: 'a', width: 56 }])
		expect(resizeColumn(cols('a'), 'a', 9000)).toEqual([{ key: 'a', width: 800 }])
		expect(resizeColumn([{ key: 'a', width: 200 }], 'a')).toEqual([{ key: 'a' }])
	})

	it('garde les largeurs quand on change les colonnes', () => {
		expect(withColumnKeys([{ key: 'client' }, { key: 'a', width: 200 }], ['client', 'b', 'a'], 'client')).toEqual([{ key: 'client' }, { key: 'b' }, { key: 'a', width: 200 }])
	})

	it('suit l ordre choisi, ignore une clé inconnue et fige une colonne élargie', () => {
		const all = [{ key: 'a', label: 'A', width: 100, grow: 1, sortable: true }, { key: 'b', label: 'B', width: 80, sortable: true }] as Column<Row>[]
		const shown = resolveColumns(all, [{ key: 'b' }, { key: 'x' }, { key: 'a', width: 240 }])
		expect(shown.map(({ key }) => key)).toEqual(['b', 'a'])
		expect(shown[1]).toMatchObject({ width: 240, grow: undefined })
	})
})

describe('champs ajoutés', () => {
	const cell = (kind: FilterField['kind'], value: string | number | undefined, extra = {}) => {
		const column = fieldColumn<Row>(field(kind, extra), 'Customer.x', 'X', () => value)
		return fieldCellText(column, { name: 'A' })
	}
	it('affiche la valeur selon la nature du champ', () => {
		expect(cell('date', '2026-11-06 10:00:00')).toBe('06/11/2026')
		expect(cell('number', 1234.5)).toBe((1234.5).toLocaleString('fr-FR'))
		expect(cell('number', 0)).toBe('0')
		expect(cell('check', 1, { choices: [{ value: '1', label: 'Oui' }] })).toBe('Oui')
		expect(cell('text', undefined)).toBe('—')
	})
	it('ne se trie pas et aligne les nombres à droite', () => {
		const column = fieldColumn<Row>(field('number'), 'k', 'X', () => 1)
		expect(column).toMatchObject({ sortable: false, end: true })
	})
})

describe('disposition', () => {
	const base = { columns: cols('client'), sort: null, view: 'all', conditions: [] }
	it('ne compte que les filtres complets', () => {
		expect(layoutSignature({ ...base, conditions: [{ doctype: 'C', field: 'a', op: '=', value: '' }] })).toBe(layoutSignature(base))
		expect(layoutSignature({ ...base, conditions: [{ doctype: 'C', field: 'a', op: '=', value: 'x' }] })).not.toBe(layoutSignature(base))
	})
	it('voit un changement de largeur ou d ordre', () => {
		expect(layoutSignature({ ...base, columns: [{ key: 'client', width: 200 }] })).not.toBe(layoutSignature(base))
	})
	it('écarte un tri ou un choix que la liste ne connaît plus', () => {
		const clean = cleanLayout({ columns: cols('status'), sort: { key: 'disparu', dir: 'asc' }, view: 'disparue', conditions: [] }, list)
		expect(clean).toEqual({ columns: cols('client', 'status'), sort: null, view: 'all', conditions: [] })
	})
	it('résume ce que la vue retiendra', () => {
		expect(layoutSummary({ ...base, columns: cols('a', 'b'), conditions: [{ doctype: 'C', field: 'a', op: '=', value: 'x' }] }, 'Créance')).toBe('2 colonnes avec leurs largeurs, le tri par créance, 1 filtre')
	})
})

describe('Vue standard sur cet appareil', () => {
	it('relit un ancien réglage et garde le format des clés', () => {
		localStorage.setItem('test-colonnes', JSON.stringify(['client', 'status']))
		localStorage.removeItem('test-colonnes:largeurs')
		expect(readStandardColumns('test-colonnes', [])).toEqual(cols('client', 'status'))
		writeStandardColumns('test-colonnes', [{ key: 'client' }, { key: 'status', width: 200 }])
		expect(JSON.parse(localStorage.getItem('test-colonnes')!)).toEqual(['client', 'status'])
		expect(readStandardColumns('test-colonnes', [])).toEqual([{ key: 'client' }, { key: 'status', width: 200 }])
		localStorage.removeItem('test-colonnes')
		localStorage.removeItem('test-colonnes:largeurs')
	})
})
