import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FilterValueInput from './FilterValueInput.vue'
import * as api from '@/lib/api'
import type { FilterField } from '@/lib/filters'

vi.mock('@/lib/api', () => ({ searchFilterLink: vi.fn(async () => [{ value: 'CLI-1', label: 'Biscuiterie' }]) }))

const date: FilterField = { value: 'Item.creation', doctype: 'Item', field: 'creation', label: 'Créé le', kind: 'date', operators: ['Between', 'Timespan', '<', 'is'] }
const link: FilterField = { value: 'Item.client', doctype: 'Item', field: 'client', label: 'Client', kind: 'link', operators: ['=', 'like', 'in'], link_doctype: 'Customer' }
const open = (field: FilterField, op: string, modelValue = '') => mount(FilterValueInput, { props: { field, op, modelValue, listDoctype: 'Item' }, attachTo: document.body })

describe('saisie de la valeur d’un filtre', () => {
	afterEach(() => {
		document.body.innerHTML = ''
		vi.clearAllMocks()
	})

	it('entre : deux dates réunies dans une valeur', async () => {
		const wrapper = open(date, 'Between', '2026-01-01,')
		const inputs = wrapper.findAll('input[type="date"]')
		expect(inputs).toHaveLength(2)
		expect((inputs[0].element as HTMLInputElement).value).toBe('2026-01-01')
		await inputs[1].setValue('2026-03-31')
		expect(wrapper.emitted('update:modelValue')).toEqual([['2026-01-01,2026-03-31']])
		wrapper.unmount()
	})

	it('période et renseigné ou non : une liste de choix', async () => {
		let wrapper = open(date, 'Timespan')
		expect(wrapper.findAll('option').map((option) => option.text())).toContain('Ce mois-ci')
		wrapper.unmount()
		wrapper = open(date, 'is')
		expect(wrapper.findAll('option').map((option) => option.text())).toEqual(['Choisir…', 'Renseigné', 'Non renseigné'])
		await wrapper.find('select').setValue('not set')
		expect(wrapper.emitted('update:modelValue')).toEqual([['not set']])
		wrapper.unmount()
	})

	it('dans la liste : du texte avec des virgules', () => {
		const wrapper = open(link, 'in')
		expect(wrapper.find('input').attributes('placeholder')).toBe('Séparées par des virgules')
		wrapper.unmount()
	})

	it('un lien propose les valeurs du doctype, et la saisie reste libre', async () => {
		const wrapper = open(link, '=')
		await wrapper.find('input').trigger('focus')
		await flushPromises()
		expect(api.searchFilterLink).toHaveBeenCalledWith('Item', 'Item', 'client', '')
		expect(wrapper.find('.filter-field-option').text()).toContain('Biscuiterie')
		await wrapper.find('input').setValue('libre')
		expect(wrapper.emitted('update:modelValue')).toEqual([['libre']])
		await wrapper.find('.filter-field-option').trigger('pointerdown')
		expect(wrapper.emitted('update:modelValue')?.[1]).toEqual(['CLI-1'])
		expect(wrapper.find('.filter-field-list').exists()).toBe(false)
		wrapper.unmount()
	})
})
