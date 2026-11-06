import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FilterFieldPicker from './FilterFieldPicker.vue'
import type { FilterField } from '@/lib/filters'

const make = (field: string, label: string, kind: FilterField['kind'], group?: string): FilterField => ({ value: `Item.${field}`, doctype: 'Item', field, label, kind, operators: ['='], group })
const fields: FilterField[] = [make('tag', 'Tag', 'text'), make('a', 'Tolérance Grammage', 'text', 'Fiche'), make('b', 'Nombre Passages', 'number', 'Fiche'), make('c', 'Grammage Support', 'choice', 'Flexo'), make('e', 'Grammage', 'text', 'Offset')]
const labels = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('.filter-field-option span:first-child').map((option) => option.text())

async function open() {
	const wrapper = mount(FilterFieldPicker, { props: { modelValue: 'Item.tag', fields }, attachTo: document.body })
	await wrapper.find('input').trigger('focus')
	return wrapper
}

describe('choix du champ d’un filtre', () => {
	it('affiche le champ choisi, puis la liste par ordre alphabétique', async () => {
		const wrapper = mount(FilterFieldPicker, { props: { modelValue: 'Item.tag', fields }, attachTo: document.body })
		expect((wrapper.find('input').element as HTMLInputElement).value).toBe('Tag')
		await wrapper.find('input').trigger('focus')
		expect((wrapper.find('input').element as HTMLInputElement).value).toBe('')
		expect(labels(wrapper)).toEqual(['Grammage', 'Grammage Support', 'Nombre Passages', 'Tag', 'Tolérance Grammage'])
		wrapper.unmount()
	})

	it('réduit la liste à chaque lettre, et Entrée choisit la ligne en surbrillance', async () => {
		const wrapper = await open()
		await wrapper.find('input').setValue('g')
		expect(labels(wrapper)).toEqual(['Grammage', 'Grammage Support', 'Nombre Passages', 'Tag', 'Tolérance Grammage'])
		await wrapper.find('input').setValue('gramm')
		expect(labels(wrapper)).toEqual(['Grammage', 'Grammage Support', 'Tolérance Grammage'])
		await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
		await wrapper.find('input').trigger('keydown', { key: 'Enter' })
		expect(wrapper.emitted('update:modelValue')).toEqual([['Item.c']])
		expect(wrapper.find('.filter-field-list').exists()).toBe(false)
		wrapper.unmount()
	})

	it('Échap referme sans changer le champ ni fermer ce qui est derrière', async () => {
		const wrapper = await open()
		let reached = false
		const listener = () => (reached = true)
		document.addEventListener('keydown', listener)
		wrapper.find('input').element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		document.removeEventListener('keydown', listener)
		await wrapper.vm.$nextTick()
		expect(reached).toBe(false)
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(wrapper.find('.filter-field-list').exists()).toBe(false)
		wrapper.unmount()
	})

	it('dit quand aucun champ ne correspond', async () => {
		const wrapper = await open()
		await wrapper.find('input').setValue('introuvable')
		expect(wrapper.text()).toContain('Aucun champ ne porte ce nom.')
		wrapper.unmount()
	})
})
