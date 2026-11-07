import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import AtelierFeuille from './AtelierFeuille.vue'
import type { Scenario } from '@/lib/atelier'

const scenario = { libelle: '720 × 420', origine: 'Format étudié', laize: 720, depl: 420, nb_poses: 8, n_col: 4, n_rang: 2, rotation: 0, pas_laize: 159.55, pas_depl: 191.55 } as Scenario
const mountSheet = () => mount(AtelierFeuille, { props: { scenario, silhouette: { '0': { path_coupe: 'M0 0' } as never }, lisiere: 10, pince: 12, marge: 10 } })

describe('AtelierFeuille', () => {
	it('laisse la molette seule faire défiler la page', async () => {
		const svg = mountSheet().find('svg')
		const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true })
		svg.element.dispatchEvent(event)
		await nextTick()
		expect(event.defaultPrevented).toBe(false)
		expect(svg.attributes('viewBox')).toBe('0 0 720 420')
	})
	it('zoome avec Ctrl ou Cmd et la molette, ou le pincement', async () => {
		const svg = mountSheet().find('svg')
		for (const key of ['ctrlKey', 'metaKey']) {
			const event = new WheelEvent('wheel', { deltaY: -100, cancelable: true })
			Object.defineProperty(event, key, { value: true })
			svg.element.dispatchEvent(event)
			expect(event.defaultPrevented).toBe(true)
		}
		await nextTick()
		expect(svg.attributes('viewBox')).not.toBe('0 0 720 420')
	})
})
