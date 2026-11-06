import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useDrawerControls } from './useDrawerControls'

const actions = { close: vi.fn(), prev: vi.fn(), next: vi.fn() }
const Host = defineComponent({
	setup() {
		const root = ref<HTMLElement | null>(null)
		useDrawerControls(root, actions)
		return { root }
	},
	template: `<div>
		<aside ref="root" class="drawer"><input class="inside" /></aside>
		<div class="list-row"></div>
		<main class="outside"><input class="field" /><input class="check" type="checkbox" /><textarea></textarea></main>
	</div>`,
})

describe('tiroir de liste', () => {
	let wrapper: ReturnType<typeof mount> | null = null
	const open = () => {
		wrapper = mount(Host, { attachTo: document.body })
	}
	const press = (key: string, target: EventTarget = document, init: KeyboardEventInit = {}) => {
		const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
		target.dispatchEvent(event)
		return event
	}
	const click = (selector: string, init: PointerEventInit = {}) => document.querySelector(selector)!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...init }))
	const overlay = (name: string) => {
		const element = document.createElement('div')
		element.className = name
		document.body.append(element)
		return element
	}

	afterEach(() => {
		wrapper?.unmount()
		wrapper = null
		vi.clearAllMocks()
	})

	it('Échap ferme, les flèches changent de ligne et retiennent le défilement', () => {
		open()
		expect(press('ArrowUp').defaultPrevented).toBe(true)
		expect(actions.prev).toHaveBeenCalledOnce()
		press('ArrowDown')
		expect(actions.next).toHaveBeenCalledOnce()
		press('Escape')
		expect(actions.close).toHaveBeenCalledOnce()
		expect(press('Enter').defaultPrevented).toBe(false)
	})

	it('le clavier se tait pendant une saisie ou avec une touche de modification', () => {
		open()
		for (const selector of ['.inside', '.field', 'textarea']) {
			press('Escape', document.querySelector(selector)!)
			press('ArrowDown', document.querySelector(selector)!)
		}
		press('ArrowDown', document, { shiftKey: true })
		press('Escape', document, { ctrlKey: true })
		expect(actions.next).not.toHaveBeenCalled()
		expect(actions.close).not.toHaveBeenCalled()
		press('ArrowDown', document.querySelector('.check')!)
		expect(actions.next).toHaveBeenCalledOnce()
	})

	it('une fenêtre ou un menu ouverts gardent le clavier et les clics', () => {
		open()
		for (const name of ['dialog-scrim', 'app-menu']) {
			const element = overlay(name)
			press('Escape')
			press('ArrowUp')
			element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
			element.remove()
		}
		expect(actions.close).not.toHaveBeenCalled()
		expect(actions.prev).not.toHaveBeenCalled()
	})

	it('seul un clic principal hors du tiroir et des lignes ferme', () => {
		open()
		click('.inside')
		click('.list-row')
		click('.outside', { button: 2 })
		expect(actions.close).not.toHaveBeenCalled()
		click('.outside')
		expect(actions.close).toHaveBeenCalledOnce()
	})

	it('ne réagit plus une fois le tiroir fermé', () => {
		open()
		wrapper!.unmount()
		wrapper = null
		press('Escape')
		expect(actions.close).not.toHaveBeenCalled()
	})
})
