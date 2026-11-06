import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SavedFilters from './SavedFilters.vue'
import * as api from '@/lib/api'
import type { Condition } from '@/lib/filters'

vi.mock('@/lib/api', () => ({ getSavedFilters: vi.fn(), saveFilter: vi.fn(async () => 'NEW'), deleteSavedFilter: vi.fn(async () => undefined) }))

const couleur = { doctype: 'Article Couleur', field: 'code', op: 'like', value: '186' }
const mine = { name: 'F1', label: 'Pantone 186', is_global: false, can_delete: true, conditions: [couleur], dropped: 0 }
const common = { name: 'F2', label: 'Commun', is_global: true, can_delete: false, conditions: [{ doctype: 'Item', field: 'custom_grammage', op: '=', value: '300' }], dropped: 2 }
const current: Condition[] = [{ id: 7, ...couleur }]

async function open(props: { conditions?: Condition[]; canSave?: boolean } = {}, canShare = false) {
	vi.mocked(api.getSavedFilters).mockResolvedValue({ filters: [mine, common], can_share: canShare })
	const wrapper = mount(SavedFilters, { props: { doctype: 'Item', conditions: current, canSave: true, ...props }, slots: { default: '<div class="conditions">Conditions</div>' } })
	await flushPromises()
	return wrapper
}

describe('filtres enregistrés', () => {
	beforeEach(() => vi.clearAllMocks())

	it('liste les filtres au-dessus des conditions et repère celui qui est appliqué', async () => {
		const wrapper = await open()
		const rows = wrapper.findAll('.saved-filter')
		expect(rows.map((row) => row.find('.saved-filter-apply').text())).toEqual(['Pantone 186', 'Commun'])
		expect(rows.map((row) => row.find('.saved-filter-scope').text())).toEqual(['Pour moi', 'Tout le monde'])
		expect(rows[0].attributes('aria-current')).toBe('true')
		expect(rows[1].attributes('aria-current')).toBeUndefined()
		expect(wrapper.html().indexOf('saved-filter')).toBeLessThan(wrapper.html().indexOf('conditions'))
	})

	it('applique un filtre en remplaçant les conditions, et signale ce qui manque', async () => {
		const wrapper = await open()
		await wrapper.findAll('.saved-filter-apply')[1].trigger('click')
		expect(wrapper.emitted('apply')?.[0][0]).toEqual([{ ...common.conditions[0], id: 1 }])
		expect(wrapper.find('[role="status"]').text()).toContain('2 conditions de ce filtre portent sur un champ indisponible')
		await wrapper.findAll('.saved-filter-apply')[0].trigger('click')
		expect(wrapper.find('[role="status"]').exists()).toBe(false)
	})

	it('enregistre les conditions sous un nom, puis recharge la liste', async () => {
		const wrapper = await open()
		expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
		expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
		await wrapper.find('input[aria-label="Nom du filtre"]').setValue(' Rouge ')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(api.saveFilter).toHaveBeenCalledWith('Item', 'Rouge', current, false)
		expect(api.getSavedFilters).toHaveBeenCalledTimes(2)
		expect((wrapper.find('input[aria-label="Nom du filtre"]').element as HTMLInputElement).value).toBe('')
	})

	it('propose le partage à un System Manager seulement', async () => {
		const wrapper = await open({}, true)
		await wrapper.find('input[aria-label="Nom du filtre"]').setValue('Rouge')
		await wrapper.find('input[type="checkbox"]').setValue(true)
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(api.saveFilter).toHaveBeenCalledWith('Item', 'Rouge', current, true)
	})

	it('une erreur reste dans le panneau, avec le nom saisi', async () => {
		const wrapper = await open()
		vi.mocked(api.saveFilter).mockRejectedValueOnce(new Error('Un filtre porte déjà ce nom.'))
		await wrapper.find('input[aria-label="Nom du filtre"]').setValue('Rouge')
		await wrapper.find('form').trigger('submit')
		await flushPromises()
		expect(wrapper.find('[role="alert"]').text()).toBe('Un filtre porte déjà ce nom.')
		expect((wrapper.find('input[aria-label="Nom du filtre"]').element as HTMLInputElement).value).toBe('Rouge')
	})

	it('demande confirmation avant de supprimer, et seulement si la personne en a le droit', async () => {
		const wrapper = await open()
		expect(wrapper.findAll('.saved-filter-remove')).toHaveLength(1)
		await wrapper.find('.saved-filter-remove').trigger('click')
		expect(api.deleteSavedFilter).not.toHaveBeenCalled()
		expect(wrapper.text()).toContain('Supprimer « Pantone 186 » ?')
		await wrapper.findAll('.saved-filter button')[0].trigger('click')
		await flushPromises()
		expect(api.deleteSavedFilter).toHaveBeenCalledWith('F1')
	})

	it('sans condition complète ou depuis l’export, on n’enregistre pas', async () => {
		let wrapper = await open({ conditions: [{ id: 1, ...couleur, value: '' }] })
		expect(wrapper.find('form').exists()).toBe(false)
		wrapper = await open({ canSave: false })
		expect(wrapper.find('form').exists()).toBe(false)
		expect(wrapper.findAll('.saved-filter')).toHaveLength(2)
	})
})
