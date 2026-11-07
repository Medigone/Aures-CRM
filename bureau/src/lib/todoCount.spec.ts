import { afterEach, describe, expect, it, vi } from 'vitest'
import { getQueue } from './api'
import { loadTodoCount, todoCount } from './todoCount'

vi.mock('./api', () => ({ getQueue: vi.fn(async () => ({ counts: { todo: 4 } })) }))

afterEach(() => {
	window.droits = undefined
	todoCount.value = undefined
	vi.clearAllMocks()
})

describe('compteur des tickets', () => {
	it("ne demande rien à qui ne lit pas les tickets", async () => {
		window.droits = { 'Ticket Commercial': { read: false, create: false } }
		await loadTodoCount()
		expect(getQueue).not.toHaveBeenCalled()
		expect(todoCount.value).toBeUndefined()
	})

	it('charge le compteur pour qui les lit', async () => {
		window.droits = { 'Ticket Commercial': { read: true, create: false } }
		await loadTodoCount()
		expect(todoCount.value).toBe(4)
	})
})
