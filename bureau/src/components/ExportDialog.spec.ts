import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExportDialog from './ExportDialog.vue'
import * as api from '@/lib/api'
import { countText, exportFileName } from '@/lib/exports'
import type { ExportQuery } from '@/lib/exports'
import type { Condition } from '@/lib/filters'
import type { Column } from '@/lib/list'

vi.mock('@/lib/api', () => ({ exportXlsx: vi.fn(async () => btoa('classeur')) }))

interface Row { name: string }
const columns = [{ key: 'name', label: 'Code', width: 100, text: (row: Row) => row.name }] as Column<Row>[]
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

function open(filtered = false, conditions: Condition[] = []) {
	return mount(ExportDialog<Row>, {
		props: { title: 'Tickets', noun: 'ticket', views, columns, initial: { view: 'todo', conditions, search: filtered ? 'etui' : '' }, filtered, fetchRows },
		slots: { filters: `<template #filters="{ conditions, update }"><button class="add-filter" @click="update([{ id: 2, doctype: 'Ticket Commercial', field: 'status', op: '=', value: 'Clos' }])">{{ conditions.length }} filtres</button></template>` },
		attachTo: document.body,
	})
}
const status = (wrapper: ReturnType<typeof open>) => wrapper.find('[role="status"]').text()

describe('fenêtre d’export', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
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
