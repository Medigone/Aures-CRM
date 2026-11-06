import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FilterFieldPicker from './FilterFieldPicker.vue'
import type { FilterField } from '@/lib/filters'

const fields: FilterField[] = [
	{ value: 'tag', label: 'Tag', kind: 'text' },
	{ value: 'champ:a', label: 'Tolérance Grammage', kind: 'text', group: 'Fiche' },
	{ value: 'champ:b', label: 'Nombre Passages', kind: 'number', group: 'Fiche' },
	{ value: 'champ:c', label: 'Grammage Support', kind: 'choice', group: 'Flexo' },
	{ value: 'champ:d', label: 'Couleur', kind: 'text', group: 'Fiche' },
	{ value: 'champ:e', label: 'Grammage', kind: 'text', group: 'Offset' },
]

async function open() {
	const wrapper = mount(FilterFieldPicker, { props: { modelValue: 'tag', fields }, attachTo: document.body })
	await wrapper.find('button').trigger('click')
	return wrapper
}

describe('choix du champ d’un filtre', () => {
	it('montre tous les champs par rubrique, même une rubrique qui revient', async () => {
		const wrapper = await open()
		expect(wrapper.findAll('.filter-field-group').map((group) => group.text())).toEqual(['Filtres courants', 'Fiche', 'Flexo', 'Fiche', 'Offset'])
		wrapper.unmount()
	})

	it('ne garde que les champs cherchés, le meilleur en tête, et Entrée le choisit', async () => {
		const wrapper = await open()
		await wrapper.find('input').setValue('gramm')
		expect(wrapper.findAll('.filter-field-option').map((option) => option.text())).toEqual(['Grammage Support Flexo', 'Grammage Offset', 'Tolérance Grammage Fiche'])
		await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
		await wrapper.find('input').trigger('keydown', { key: 'Enter' })
		expect(wrapper.emitted('update:modelValue')).toEqual([['champ:e']])
		expect(wrapper.find('input').exists()).toBe(false)
		wrapper.unmount()
	})

	it('Échap referme sans changer le champ ni fermer ce qui est derrière', async () => {
		const wrapper = await open()
		const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
		let reached = false
		const listener = () => (reached = true)
		document.addEventListener('keydown', listener)
		wrapper.find('input').element.dispatchEvent(event)
		document.removeEventListener('keydown', listener)
		await wrapper.vm.$nextTick()
		expect(reached).toBe(false)
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(wrapper.find('input').exists()).toBe(false)
		wrapper.unmount()
	})

	it('dit quand aucun champ ne correspond', async () => {
		const wrapper = await open()
		await wrapper.find('input').setValue('introuvable')
		expect(wrapper.text()).toContain('Aucun champ ne porte ce nom.')
		wrapper.unmount()
	})
})
