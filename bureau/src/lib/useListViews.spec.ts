import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import * as api from './api'
import type { Condition } from './filters'
import type { Sort } from './list'
import { useListViews, type ListViewsState } from './useListViews'

vi.mock('./api', () => ({ getListViews: vi.fn(), saveListView: vi.fn(async () => 'NEW'), deleteListView: vi.fn(async () => undefined), setDefaultListView: vi.fn(async () => undefined) }))

const KEY = 'test-liste'
const relance = { name: 'V1', label: 'Relance', is_global: false, can_edit: true, dropped: 0, config: { columns: [{ key: 'client' }, { key: 'creance', width: 200 }], sort: { key: 'creance', dir: 'desc' as const }, view: 'all', conditions: [{ doctype: 'Customer', field: 'x', op: '=', value: 'a' }] } }
const commune = { ...relance, name: 'V2', label: 'Commune', is_global: true, can_edit: false }

function makeState(view = 'all'): ListViewsState {
	return {
		view: ref(view),
		conditions: ref<Condition[]>([]),
		sort: ref<Sort | null>(null),
		response: ref(null),
		loading: ref(false),
		load: vi.fn(),
		restore(layout) {
			if (layout.view !== undefined) this.view.value = layout.view
			this.sort.value = layout.sort
			this.conditions.value = layout.conditions
		},
	}
}
const open = async (state = makeState()) => {
	const session = useListViews({ state, doctype: 'Customer', columnsKey: KEY, defaultColumns: ['client', 'status'], locked: 'client', defaultView: 'all', sortable: ['client', 'creance'], views: ['all', 'prospect'] })
	await flushPromises()
	return { session, state }
}

describe('vue active', () => {
	beforeEach(() => {
		localStorage.clear()
		vi.mocked(api.getListViews).mockResolvedValue({ views: [relance, commune], default: null, can_share: false })
	})

	it('reste sur la Vue standard sans modification', async () => {
		const { session } = await open()
		expect(session.label.value).toBe('Vue standard')
		expect(session.modified.value).toBe(false)
		expect(session.columns.value.map(({ key }) => key)).toEqual(['client', 'status'])
	})

	it('applique une vue, puis signale et annule une modification', async () => {
		const { session, state } = await open()
		session.apply(relance)
		expect(state.sort.value).toEqual({ key: 'creance', dir: 'desc' })
		expect(state.conditions.value).toHaveLength(1)
		expect(session.modified.value).toBe(false)
		session.resize('creance', 300)
		expect(session.modified.value).toBe(true)
		session.reset()
		expect(session.columns.value[1]).toEqual({ key: 'creance', width: 200 })
		expect(session.modified.value).toBe(false)
	})

	it('ouvre la vue par défaut à la première visite', async () => {
		vi.mocked(api.getListViews).mockResolvedValue({ views: [relance], default: 'V1', can_share: false })
		const { session } = await open()
		expect(session.label.value).toBe('Relance')
	})

	it('préfère la dernière vue de cet appareil à la vue par défaut', async () => {
		vi.mocked(api.getListViews).mockResolvedValue({ views: [relance, commune], default: 'V2', can_share: false })
		const first = await open()
		first.session.apply(relance)
		const { session, state } = await open()
		expect(session.label.value).toBe('Relance')
		expect(state.sort.value).toEqual({ key: 'creance', dir: 'desc' })
	})

	it('laisse l adresse décider du choix Afficher', async () => {
		const first = await open()
		first.session.apply(relance)
		const { state } = await open(makeState('prospect'))
		expect(state.view.value).toBe('prospect')
		expect(state.sort.value).toEqual({ key: 'creance', dir: 'desc' })
	})

	it('revient en arrière si la vue a disparu du serveur', async () => {
		const first = await open()
		first.session.apply(relance)
		vi.mocked(api.getListViews).mockResolvedValue({ views: [], default: null, can_share: false })
		const { session, state } = await open()
		expect(session.activeName.value).toBeNull()
		expect(state.sort.value).toBeNull()
	})

	it('une vue partagée sans droit ne s écrase pas', async () => {
		const { session } = await open()
		session.apply(commune)
		expect(session.canOverwrite.value).toBe(false)
		session.apply(relance)
		expect(session.canOverwrite.value).toBe(true)
	})

	it('garde la même session pour le même état : les retouches survivent à une fiche', async () => {
		const state = makeState()
		const first = await open(state)
		first.session.setColumnKeys(['client'])
		const again = await open(state)
		expect(again.session).toBe(first.session)
		expect(again.session.columns.value).toEqual([{ key: 'client' }])
	})

	it('enregistre sous un nouveau nom et libère la Vue standard', async () => {
		const { session } = await open()
		session.setColumnKeys(['client', 'creance'])
		vi.mocked(api.getListViews).mockResolvedValue({ views: [{ ...relance, name: 'NEW', label: 'Nouvelle' }], default: 'NEW', can_share: false })
		await session.saveAs('Nouvelle', false, true)
		expect(api.setDefaultListView).toHaveBeenCalledWith('Customer', 'NEW')
		expect(session.label.value).toBe('Nouvelle')
		expect(session.modified.value).toBe(false)
		expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['client', 'status'])
	})

	it('dit quand la liste des vues n a pas pu être chargée, sans bloquer la liste', async () => {
		vi.mocked(api.getListViews).mockRejectedValue(new Error('Table absente'))
		const { session } = await open()
		expect(session.loadError.value).toContain('Table absente')
		expect(session.columns.value.map(({ key }) => key)).toEqual(['client', 'status'])
	})
})
