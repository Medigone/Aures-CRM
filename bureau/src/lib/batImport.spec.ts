import { describe, expect, it } from 'vitest'
import type { ArticleDetail } from './articles'
import { newTeinte } from './articles'
import { batFileCheck, batRows, batUpdate, sameColors, type BatProposal } from './batImport'

const proposal = (key: string, fieldname: string | null, value: string, fieldtype = 'Data'): BatProposal => ({ key, fieldname, label: key, fieldtype, value, raw: `lu ${key}`, source: 'Support' })
const field = (fieldname: string, fieldtype = 'Data') => ({ fieldname, label: fieldname, fieldtype, conditions: [] })
const article = { reference: '', fiche: { custom_support: 'BB', custom_grammage: '300', custom_acrylique: 1 } } as unknown as ArticleDetail
const fieldOf = (name: string) => (name === 'custom_absent' ? undefined : field(name))

describe('import du BAT', () => {
	it('refuse ce qui n’est pas un PDF', () => {
		expect(batFileCheck(new File([''], 'bat.PDF'))).toBe('')
		expect(batFileCheck(new File([''], 'bat.png', { type: 'image/png' }))).not.toBe('')
	})

	it('coche un champ vide, jamais une valeur différente, et écarte ce qui est identique', () => {
		const { rows, same, hidden } = batRows(
			[proposal('reference', null, 'AB1'), proposal('custom_support', 'custom_support', 'BBTB'), proposal('custom_grammage', 'custom_grammage', '300'), proposal('custom_acrylique', 'custom_acrylique', '1', 'Check'), proposal('custom_absent', 'custom_absent', 'x')],
			article,
			fieldOf,
		)
		expect(rows.map((row) => [row.key, row.checked, row.current])).toEqual([
			['reference', true, ''],
			['custom_support', false, 'BB'],
		])
		expect(same).toEqual(['custom_grammage', 'custom_acrylique'])
		expect(hidden).toEqual([{ label: 'Support lu', value: 'lu custom_absent' }])
	})

	it('n’envoie que ce qui est coché, et rien si tout est décoché', () => {
		const { rows } = batRows([proposal('reference', null, 'AB1'), proposal('custom_cotations', 'custom_cotations', '60x30')], article, fieldOf)
		expect(batUpdate(rows, null)).toEqual({ reference: 'AB1', fiche: { custom_cotations: '60x30' } })
		rows[1].checked = false
		expect(batUpdate(rows, null)).toEqual({ reference: 'AB1' })
		rows[0].checked = false
		expect(batUpdate(rows, null)).toBeNull()
		expect(batUpdate(rows, [{ ...newTeinte('Pantone'), code: '186 C' }])?.teintes?.[0].code).toBe('186 C')
	})

	it('compare les couleurs sans tenir compte de l’ordre', () => {
		const line = (code: string) => ({ ...newTeinte('Pantone'), code })
		expect(sameColors([line('186 C'), line('315 C')], [line('315 C'), line('186 C')])).toBe(true)
		expect(sameColors([line('186 C')], [line('315 C')])).toBe(false)
	})
})
