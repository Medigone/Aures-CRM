import { describe, expect, it, vi } from 'vitest'
import { rangeToggle, runInBatches } from './bulk'

const ok = (batch: string[]) => Promise.resolve({ done: batch, skipped: [] })

describe('runInBatches', () => {
	it('découpe en lots, cumule et signale l\'avancement', async () => {
		const items = Array.from({ length: 120 }, (_, index) => `L-${index}`)
		const send = vi.fn(ok)
		const progress: number[] = []
		const outcome = await runInBatches(items, send, (sent) => progress.push(sent))
		expect(send.mock.calls.map(([batch]) => batch.length)).toEqual([50, 50, 20])
		expect(progress).toEqual([50, 100, 120])
		expect(outcome.done).toHaveLength(120)
		expect(outcome).toMatchObject({ unsent: 0, error: '' })
	})

	it('cumule les refus de chaque lot', async () => {
		const send = vi.fn((batch: string[]) => Promise.resolve({ done: batch.slice(1), skipped: [{ name: batch[0], reason: 'Non' }] }))
		const outcome = await runInBatches(['a', 'b', 'c'], send, undefined, 2)
		expect(outcome.done).toEqual(['b'])
		expect(outcome.skipped.map((item) => item.name)).toEqual(['a', 'c'])
	})

	it('arrête au premier lot en erreur et garde ce qui est fait', async () => {
		const send = vi.fn().mockImplementationOnce(ok).mockRejectedValueOnce(new Error('Réseau coupé'))
		const outcome = await runInBatches(['a', 'b', 'c', 'd', 'e'], send, undefined, 2)
		expect(send).toHaveBeenCalledTimes(2)
		expect(outcome).toMatchObject({ done: ['a', 'b'], unsent: 3, error: 'Réseau coupé' })
	})
})

describe('rangeToggle', () => {
	const names = ['a', 'b', 'c', 'd']

	it('sans ancre, bascule la seule ligne cliquée', () => {
		expect([...rangeToggle(names, new Set(), null, 'b')]).toEqual(['b'])
		expect([...rangeToggle(names, new Set(['b']), null, 'b')]).toEqual([])
	})

	it('coche tout l\'intervalle, dans les deux sens', () => {
		expect([...rangeToggle(names, new Set(['a']), 'a', 'c')].sort()).toEqual(['a', 'b', 'c'])
		expect([...rangeToggle(names, new Set(['d']), 'd', 'b')].sort()).toEqual(['b', 'c', 'd'])
	})

	it('décoche l\'intervalle si la ligne cliquée était cochée', () => {
		expect([...rangeToggle(names, new Set(['a', 'b', 'c', 'd']), 'a', 'c')]).toEqual(['d'])
	})

	it('une ancre sortie de la page ne vaut plus', () => {
		expect([...rangeToggle(names, new Set(), 'z', 'c')]).toEqual(['c'])
	})
})
