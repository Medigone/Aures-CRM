import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ArticleDuplicateDialog from './ArticleDuplicateDialog.vue'
import * as api from '@/lib/api'
import type { ArticleDetail, ArticleOptions } from '@/lib/articles'

vi.mock('@/lib/api', () => ({ checkArticleDesignation: vi.fn(async () => ({ message: null })), duplicateArticle: vi.fn(async () => ({ name: 'IFRI-099' })), searchClients: vi.fn(async () => []) }))

const options = { groupes: ['Produits'], schema: { groups: [{ label: 'Offset', fields: [{ fieldname: 'custom_support', label: 'Papier', fieldtype: 'Data', conditions: [] }] }] } } as unknown as ArticleOptions
const article = (changes: Partial<ArticleDetail> = {}) =>
	({
		name: 'IFRI-001',
		designation: 'ARTICLE 10',
		type: 'Client',
		procede: 'Offset',
		client: 'IFRI',
		client_label: 'IFRI',
		groupe: 'Produits',
		reference: 'PH-1',
		compose: 0,
		sous_article: 0,
		own_image: false,
		tags: [],
		fichiers: { image: null, fiche_technique: null, trace_decoupe: null },
		documents: [],
		fiche: { custom_support: 'BBTB' },
		teintes: [],
		prepresse: { maquettes: [], bats: [], traces: [{ name: 'TRA-1', dimensions: '' }], impositions: [], cliches: [], plans_flexo: [], etudes_techniques: [] },
		droits_duplication: { article: true, trace: true, imposition: true, maquette: true, plan_flexo: true },
		sous_articles: [],
		devis: [],
		commandes: [],
		...changes,
	}) as unknown as ArticleDetail
const primary = (wrapper: ReturnType<typeof mount>) => wrapper.find('.btn-primary')

describe('fenêtre de duplication', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(api.checkArticleDesignation).mockResolvedValue({ message: null })
	})

	it('bloque une désignation déjà prise, avec le message du serveur', async () => {
		vi.mocked(api.checkArticleDesignation).mockResolvedValue({ message: 'Le client a déjà un article « ARTICLE 10 ».' })
		const wrapper = mount(ArticleDuplicateDialog, { props: { article: article(), options } })
		await flushPromises()
		expect(wrapper.find('[role="alert"]').text()).toContain('ARTICLE 10')
		expect(primary(wrapper).attributes('disabled')).toBeDefined()
	})

	it('va au bout : les choix cochés partent au serveur, la référence reste vide', async () => {
		const wrapper = mount(ArticleDuplicateDialog, { props: { article: article(), options } })
		await flushPromises()
		await wrapper.find('#dup-designation').setValue('Article 10 V3')
		await primary(wrapper).trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Partir de')
		await primary(wrapper).trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Le nouvel article reçoit')
		await primary(wrapper).trigger('click')
		await flushPromises()
		expect(api.duplicateArticle).toHaveBeenCalledWith('IFRI-001', { designation: 'Article 10 V3', client: 'IFRI', reference: '', groupe: 'Produits' }, expect.objectContaining({ fields: ['custom_support'], prepresse: ['trace'] }))
		expect(wrapper.emitted('created')?.[0]).toEqual(['IFRI-099'])
	})

	it("un article général se duplique dès la première étape", async () => {
		const wrapper = mount(ArticleDuplicateDialog, { props: { article: article({ type: 'Général', client: null, client_label: null, procede: null }), options } })
		await flushPromises()
		expect(wrapper.find('.phase-bar').exists()).toBe(false)
		expect(primary(wrapper).text()).toBe("Dupliquer l'article")
	})

	it('un refus du serveur reste dans la fenêtre', async () => {
		vi.mocked(api.duplicateArticle).mockRejectedValueOnce(new Error('Refusé.'))
		const wrapper = mount(ArticleDuplicateDialog, { props: { article: article(), options } })
		await flushPromises()
		await wrapper.find('#dup-designation').setValue('Autre')
		await primary(wrapper).trigger('click')
		await flushPromises()
		await primary(wrapper).trigger('click')
		await flushPromises()
		await primary(wrapper).trigger('click')
		await flushPromises()
		expect(wrapper.text()).toContain('Refusé.')
		expect(wrapper.emitted('close')).toBeUndefined()
	})
})
