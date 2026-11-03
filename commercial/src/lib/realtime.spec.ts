import { describe, expect, it, vi } from 'vitest'
import { isForeignChange, throttledReload } from './realtime'

describe('isForeignChange', () => {
	it('ignore l’écho de ses propres saisies', () => {
		expect(isForeignChange({ doctype: 'Ticket Commercial', by: 'karim@aures.dz' }, 'karim@aures.dz')).toBe(false)
		expect(isForeignChange({ doctype: 'Ticket Commercial', by: 'adv@aures.dz' }, 'karim@aures.dz')).toBe(true)
		expect(isForeignChange({}, 'karim@aures.dz')).toBe(false)
	})
})

describe('throttledReload', () => {
	it('regroupe une rafale et espace les rechargements', () => {
		vi.useFakeTimers()
		let clock = 0
		const reload = vi.fn()
		const trigger = throttledReload(reload, { delayMs: 3000, minIntervalMs: 10000, now: () => clock })
		trigger()
		trigger()
		trigger()
		clock = 3000
		vi.advanceTimersByTime(3000)
		expect(reload).toHaveBeenCalledTimes(1)
		trigger()
		clock = 6000
		vi.advanceTimersByTime(3000)
		expect(reload).toHaveBeenCalledTimes(1)
		clock = 13000
		vi.advanceTimersByTime(7000)
		expect(reload).toHaveBeenCalledTimes(2)
		vi.useRealTimers()
	})
})
