import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExportDialog from './ExportDialog.vue'
import * as api from '@/lib/api'
import { countText, exportFileName } from '@/lib/exports'
import type { ExportQuery } from '@/lib/exports'
import type { Condition, FilterField } from '@/lib/filters'
import type { Column } from '@/lib/list'

vi.mock('@/lib/api', () => ({ exportXlsx: vi.fn(async () => btoa('classeur')), getExportValues: vi.fn(async () => ({ A: { 'Item.grammage': 300, 'Item.recto': 1 } })) }))

interface Row { name: string }
const columns = [{ key: 'name', label: 'Code', width: 100, text: (row: Row) => row.name }] as Column<Row>[]
const hidden = { key: 'cache', label: 'Cachée', width: 100, sortable: false, text: () => 'x' } as Column<Row>
const fields = [
	{ value: 'Item.grammage', doctype: 'Item', field: 'grammage', label: 'Grammage', kind: 'number', operators: ['='], group: 'Offset', own: true },
	{ value: 'Item.recto', doctype: 'Item', field: 'recto', label: 'Recto Verso', kind: 'check', operators: ['='], group: 'Offset', own: true, choices: [{ value: '1', label: 'Oui' }, { value: '0', label: 'Non' }] },
	{ value: 'Item.code', doctype: 'Item', field: 'code', label: 'Code', kind: 'text', operators: ['='] },
	{ value: 'Item.prix', doctype: 'Item', field: 'prix', label: 'Prix', kind: 'number', operators: ['='], group: 'Achat', own: false },
	{ value: 'Item.cloche', doctype: 'Item', field: 'cloche', label: 'Cloche', kind: 'choice', operators: ['='] },
] as FilterField[]
const rowsOf = (query: ExportQuery): Row[] => {
	if (query.view === 'all') return [{ name: 'A' }, { name: 'B' }, { name: 'C' }]
	return query.conditions.some((condition) => condition.value) ? [{ name: 'A' }] : [{ name: 'A' }, { name: 'B' }]
}
const fetchRows = vi.fn(async (query: ExportQuery, start: number, pageLength: number) => {
	const rows = rowsOf(query)
	return { rows: rows.slice(start, start + pageLength), total: rows.length }
})
const views = [{ key: 'todo', label: 'À traiter' }, { key: 'closed', label: 'Clos' }]
const condition: Condition = { id: 1, doctype: 'Ticket Commercial', field: 'status', op: '=', value: 'Ouvert' }
const settle = async () => {
	await vi.advanceTimersByTimeAsync(300)
	await flushPromises()
}

function open(filtered = false, conditions: Condition[] = [], extra: { picked?: Row[]; fromPicked?: boolean } = {}) {
	return mount(ExportDialog<Row>, {
		props: { title: 'Tickets', noun: 'ticket', doctype: 'Item', views, allColumns: [...columns, hidden], columns, fields, initial: { view: 'todo', conditions, search: filtered ? 'etui' : '' }, filtered, fetchRows, picked: [], fromPicked: false, conditionLabel: (condition: Condition) => condition.value, ...extra },
		slots: { filters: `<template #filters="{ conditions, update }"><button class="add-filter" @click="update([{ id: 2, doctype: 'Ticket Commercial', field: 'status', op: '=', value: 'Clos' }])">{{ conditions.length }} filtres</button></template>` },
		attachTo: document.body,
	})
}
const fullStatus = (wrapper: ReturnType<typeof open>) => wrapper.find('[role="status"]').text()
const status = (wrapper: ReturnType<typeof open>) => fullStatus(wrapper).split(' · ')[0]

describe('fenêtre d’export', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
		localStorage.clear()
		URL.createObjectURL = vi.fn(() => 'blob:x')
		URL.revokeObjectURL = vi.fn()
	})
	afterEach(() => {
		vi.useRealTimers()
		document.body.innerHTML = ''
	})

	it('sans filtre sur la liste, part de tout exporter et compte toutes les lignes', async () => {
		const wrapper = open()
		await settle()
		expect((wrapper.find('input[value="all"]').element as HTMLInputElement).checked).toBe(true)
		expect(wrapper.find('.add-filter').exists()).toBe(false)
		expect(status(wrapper)).toBe('3 tickets seront exportés')
		expect(fetchRows.mock.calls[0][0].view).toBe('all')
		wrapper.unmount()
	})

	it('avec des filtres sur la liste, les reprend et met le nombre à jour', async () => {
		const wrapper = open(true, [{ ...condition, value: '' }])
		await settle()
		expect((wrapper.find('input[value="filtered"]').element as HTMLInputElement).checked).toBe(true)
		expect(status(wrapper)).toBe('2 tickets seront exportés')
		expect(wrapper.text()).toContain('Recherche : etui')
		// Repris de la liste, les filtres s'affichent en pastilles ; on ouvre le panneau pour les changer.
		expect(wrapper.find('.add-filter').exists()).toBe(false)
		await wrapper.findAll('button').find((button) => button.text() === 'Modifier les filtres')!.trigger('click')
		expect(wrapper.find('.add-filter').text()).toBe('0 filtres')
		await wrapper.find('.add-filter').trigger('click')
		expect(status(wrapper)).toBe('Calcul du nombre de lignes…')
		await settle()
		expect(status(wrapper)).toBe('1 ticket sera exporté')
		await wrapper.find('input[value="all"]').setValue(true)
		await settle()
		expect(status(wrapper)).toBe('3 tickets seront exportés')
		wrapper.unmount()
	})

	it('une réponse dépassée n’écrase pas le dernier nombre', async () => {
		const wrapper = open()
		await settle()
		let release: (value: { rows: Row[]; total: number }) => void = () => {}
		fetchRows.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)))
		await wrapper.find('input[value="filtered"]').setValue(true)
		await settle()
		await wrapper.find('input[value="all"]').setValue(true)
		await settle()
		release({ rows: [], total: 99 })
		await flushPromises()
		expect(status(wrapper)).toBe('3 tickets seront exportés')
		wrapper.unmount()
	})

	it('Excel passe par le serveur avec toutes les lignes', async () => {
		const wrapper = open()
		await settle()
		await wrapper.find('.btn-primary').trigger('click')
		await settle()
		expect(api.exportXlsx).toHaveBeenCalledWith('Tickets', ['Code'], [['A'], ['B'], ['C']])
		expect(wrapper.emitted('done')).toEqual([['3 tickets exportés.']])
		wrapper.unmount()
	})

	const fieldsIn = (wrapper: ReturnType<typeof open>) => wrapper.findAll('.export-field').map((row) => row.text())
	const fileColumnsIn = (wrapper: ReturnType<typeof open>) => wrapper.findAll('.export-file-column span').map((row) => row.text())
	const rubric = (wrapper: ReturnType<typeof open>, name: string) => wrapper.findAll('.export-rubric').find((row) => row.text().startsWith(name))!
	const check = async (wrapper: ReturnType<typeof open>, label: string) => wrapper.findAll('.export-field').find((row) => row.text().startsWith(label))!.find('input').setValue(true)

	it('range les champs par rubrique, les rubriques de l’application d’abord, sans doublon de nom ni cloche', async () => {
		const wrapper = open()
		await settle()
		expect(wrapper.findAll('.export-rubric').map((row) => row.find('span').text())).toEqual(['Colonnes de la liste', 'Offset', 'Achat'])
		expect(wrapper.find('.export-rubric-sep').text()).toBe('Autres rubriques')
		expect(fieldsIn(wrapper)).toEqual(['Cachée', 'Code'])
		await rubric(wrapper, 'Offset').trigger('click')
		expect(fieldsIn(wrapper)).toEqual(['Grammage', 'Recto Verso'])
		expect(rubric(wrapper, 'Colonnes de la liste').find('small').text()).toBe('1 / 2')
		wrapper.unmount()
	})

	it('cherche dans toutes les rubriques et indique la rubrique', async () => {
		const wrapper = open()
		await settle()
		await wrapper.find('input[aria-label="Chercher une colonne"]').setValue('gram')
		expect(fieldsIn(wrapper)).toEqual(['Grammage Offset'])
		expect(wrapper.text()).toContain('1 résultat')
		wrapper.unmount()
	})

	it('le fichier suit l’ordre choisi, avec les valeurs lues sur le serveur', async () => {
		const wrapper = open()
		await settle()
		await check(wrapper, 'Cachée')
		await rubric(wrapper, 'Offset').trigger('click')
		await check(wrapper, 'Recto Verso')
		await check(wrapper, 'Grammage')
		expect(fileColumnsIn(wrapper)).toEqual(['Code', 'Cachée', 'Recto Verso', 'Grammage'])
		await wrapper.find('[aria-label="Monter Grammage"]').trigger('click')
		await wrapper.find('[aria-label="Retirer Cachée"]').trigger('click')
		expect(fileColumnsIn(wrapper)).toEqual(['Code', 'Grammage', 'Recto Verso'])
		expect(wrapper.find('[aria-label="Monter Code"]').attributes('disabled')).toBeDefined()
		await wrapper.find('.btn-primary').trigger('click')
		await settle()
		expect(api.getExportValues).toHaveBeenCalledWith('Item', ['A', 'B', 'C'], [{ doctype: 'Item', field: 'grammage' }, { doctype: 'Item', field: 'recto' }])
		expect(api.exportXlsx).toHaveBeenCalledWith('Tickets', ['Code', 'Grammage', 'Recto Verso'], [['A', 300, 'Oui'], ['B', '', ''], ['C', '', '']])
		wrapper.unmount()
	})

	it('coche ou décoche toute une rubrique', async () => {
		const wrapper = open()
		await settle()
		await rubric(wrapper, 'Offset').trigger('click')
		const toggleAll = () => wrapper.findAll('.export-pane-head button').find((button) => button.text().startsWith('Tout'))!
		await toggleAll().trigger('click')
		expect(fileColumnsIn(wrapper)).toEqual(['Code', 'Grammage', 'Recto Verso'])
		expect(toggleAll().text()).toBe('Tout décocher')
		await toggleAll().trigger('click')
		expect(fileColumnsIn(wrapper)).toEqual(['Code'])
		wrapper.unmount()
	})

	it('sans colonne, on ne peut pas exporter ; Réinitialiser revient aux colonnes de la liste', async () => {
		const wrapper = open()
		await settle()
		await wrapper.find('[aria-label="Retirer Code"]').trigger('click')
		expect(status(wrapper)).toBe('Choisissez au moins une colonne')
		expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined()
		await wrapper.findAll('button').find((button) => button.text() === 'Réinitialiser')!.trigger('click')
		expect(fileColumnsIn(wrapper)).toEqual(['Code'])
		expect(wrapper.find('.btn-primary').attributes('disabled')).toBeUndefined()
		wrapper.unmount()
	})

	it('retient les colonnes de chaque liste après un export', async () => {
		let wrapper = open()
		await settle()
		await rubric(wrapper, 'Offset').trigger('click')
		await check(wrapper, 'Grammage')
		await wrapper.find('.btn-primary').trigger('click')
		await settle()
		wrapper.unmount()
		wrapper = open()
		await settle()
		expect(fileColumnsIn(wrapper)).toEqual(['Code', 'Grammage'])
		wrapper.unmount()
	})

	it('une colonne retenue qui n’existe plus est ignorée', async () => {
		localStorage.setItem('bureau-export-colonnes:Item', JSON.stringify(['Item.disparu', 'liste:name']))
		const wrapper = open()
		await settle()
		expect(fileColumnsIn(wrapper)).toEqual(['Code'])
		expect(fullStatus(wrapper)).toContain('· 1 colonne')
		wrapper.unmount()
	})

	it('depuis les lignes cochées, exporte seulement celles-ci, sans les redemander au serveur', async () => {
		const wrapper = open(false, [], { picked: [{ name: 'A' }, { name: 'C' }], fromPicked: true })
		await settle()
		fetchRows.mockClear()
		expect((wrapper.find('input[value="picked"]').element as HTMLInputElement).checked).toBe(true)
		expect(status(wrapper)).toContain('2 tickets seront exportés')
		await wrapper.find('.btn-primary').trigger('click')
		await settle()
		expect(fetchRows).not.toHaveBeenCalled()
		expect(api.exportXlsx).toHaveBeenCalledWith('Tickets', ['Code'], [['A'], ['C']])
		wrapper.unmount()
	})

	it('sans ligne cochée, le choix n’apparaît pas', async () => {
		const wrapper = open()
		await settle()
		expect(wrapper.find('input[value="picked"]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('Échap vide la recherche sans fermer la fenêtre, puis ferme', async () => {
		const wrapper = open()
		await settle()
		const input = wrapper.find('input[aria-label="Chercher une colonne"]')
		await input.setValue('gram')
		await input.trigger('keydown', { key: 'Escape' })
		expect((input.element as HTMLInputElement).value).toBe('')
		expect(wrapper.emitted('close')).toBeUndefined()
		await input.trigger('keydown', { key: 'Escape' })
		expect(wrapper.emitted('close')).toBeTruthy()
		wrapper.unmount()
	})

	it('CSV reste dans le navigateur', async () => {
		const wrapper = open()
		await settle()
		await wrapper.findAll('.seg button')[1].trigger('click')
		await wrapper.find('.btn-primary').trigger('click')
		await settle()
		expect(api.exportXlsx).not.toHaveBeenCalled()
		expect(URL.createObjectURL).toHaveBeenCalledOnce()
		expect(wrapper.emitted('done')).toBeTruthy()
		wrapper.unmount()
	})

	it('une panne reste dans la fenêtre, et aucune ligne interdit l’export', async () => {
		const wrapper = open()
		await settle()
		vi.mocked(api.exportXlsx).mockRejectedValueOnce(new Error('réseau'))
		await wrapper.find('.btn-primary').trigger('click')
		await settle()
		expect(wrapper.find('[role="alert"]').text()).toContain('réseau')
		expect(wrapper.emitted('done')).toBeUndefined()
		fetchRows.mockResolvedValueOnce({ rows: [], total: 0 })
		await wrapper.find('input[value="filtered"]').setValue(true)
		await settle()
		expect(status(wrapper)).toBe('Aucun ticket à exporter')
		expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined()
		wrapper.unmount()
	})

	it('nomme le nombre et le fichier', () => {
		expect(countText(1234, 'article')).toMatch(/^1.234 articles seront exportés$/)
		expect(exportFileName('article', 'xlsx', '2026-11-06')).toBe('articles-2026-11-06.xlsx')
	})
})
