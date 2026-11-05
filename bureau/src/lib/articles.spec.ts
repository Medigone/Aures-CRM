import { describe, expect, it } from 'vitest'
import { articleConditionLabel, articleDoc, articleFilterChoices, articleSortText, changedFields, createFields, ficheCards, ficheCardValues, ficheFormValues, finishesSummary, formatQuantity, formatRate, validateArticle, visibleArticleColumns, type ArticleOptions } from './articles'

const offset = "eval: doc.custom_procédé == 'Offset'"
const flexo = "eval: doc.custom_procédé == 'Flexo'"
const schema = {
	groups: [
		{ label: 'Général', fields: [{ fieldname: 'custom_certification_fsc', label: 'Certification FSC', fieldtype: 'Check', conditions: [] }] },
		{ label: 'Flexo', fields: [{ fieldname: 'custom_type_support', label: 'Type Support', fieldtype: 'Select', conditions: [flexo], options: ['BOPP'] }] },
		{
			label: 'Offset',
			fields: [
				{ fieldname: 'custom_support', label: 'Papier', fieldtype: 'Link', conditions: [offset], options: ['BBTB'] },
				{ fieldname: 'custom_pelliculage', label: 'Pelliculage', fieldtype: 'Select', conditions: [offset], options: ['Sans', 'Mat'] },
				{ fieldname: 'custom_nombre_de_poses', label: 'Nombre De Poses', fieldtype: 'Int', conditions: [offset] },
			],
		},
		{ label: 'Options Vernis', fields: [{ fieldname: 'custom_uv', label: 'UV', fieldtype: 'Check', conditions: [offset] }, { fieldname: 'custom_acrylique', label: 'Acrylique', fieldtype: 'Check', conditions: [offset] }] },
		{ label: 'Autre section', fields: [{ fieldname: 'custom_autre', label: 'Autre', fieldtype: 'Data', conditions: [] }] },
	],
}
const options = { procedes: ['Offset'], types: ['Client'], groupes: ['Produits'], supports: ['BBTB'], clients: [{ value: 'CLI-1', label: 'Biscuiterie Numidia' }], groupe_defaut: 'Produits', can_create: true, schema } as ArticleOptions
const article = (procede: string, fiche: Record<string, string | number>) => ({ type: 'Client', procede, compose: 0, sous_article: 0, designation: 'ETUI', fiche })

describe('articles', () => {
	it('écrit les prix et les quantités à la française', () => {
		expect(formatRate(1240.5)).toBe('1 240,50')
		expect(formatRate(null)).toBe('0,00')
		expect(formatQuantity(50000)).toBe('50 000')
		expect(formatQuantity(1.5)).toBe('1,5')
	})

	it('garde toujours la colonne Article et nomme le tri', () => {
		expect(visibleArticleColumns(['bat', 'inconnue']).map((column) => column.key)).toEqual(['designation', 'bat'])
		expect(articleSortText(null)).toBe('Tri : désignation')
		expect(articleSortText({ key: 'commande', dir: 'desc' })).toBe('Tri : commande')
	})

	it('nomme les valeurs des filtres par leur libellé', () => {
		expect(articleFilterChoices('client', options)).toEqual(options.clients)
		expect(articleFilterChoices('procede', null)).toEqual([])
		expect(articleConditionLabel({ id: 1, field: 'client', op: 'est', value: 'CLI-1' }, options)).toBe('Client est Biscuiterie Numidia')
	})

	it('ne montre que les champs du procédé de l’article, rangés par sujet', () => {
		const cards = ficheCards(schema, articleDoc(article('Offset', {})))
		expect(cards.map((card) => card.title)).toEqual(['Support', 'Impression', 'Vernis', 'Finitions', 'Conditionnement et essais', 'Autre section'])
		expect(ficheCards(schema, articleDoc(article('Flexo', {}))).map((card) => card.title)).toEqual(['Support', 'Conditionnement et essais', 'Autre section'])
	})

	it('à la lecture, écarte les champs vides et les cases décochées', () => {
		const doc = articleDoc(article('Offset', { custom_support: 'BBTB', custom_pelliculage: 'Sans', custom_nombre_de_poses: 0, custom_uv: 1, custom_acrylique: 0, custom_type_support: 'BOPP' }))
		expect(ficheCardValues(schema, doc)).toEqual([
			{ title: 'Support', rows: [{ label: 'Papier', value: 'BBTB' }], checks: [] },
			{ title: 'Vernis', rows: [], checks: ['UV'] },
		])
	})

	it('résume les finitions', () => {
		const doc = articleDoc(article('Offset', { custom_pelliculage: 'Mat', custom_uv: 1 }))
		expect(finishesSummary(ficheCardValues(schema, doc))).toBe('Pelliculage mat · Vernis uv')
		expect(finishesSummary([])).toBe('')
	})

	it('à la création, ne demande que le minimum du procédé', () => {
		expect(createFields(schema, 'Offset').map((field) => field.fieldname)).toEqual(['custom_support'])
		expect(createFields(schema, 'Numérique')).toEqual([])
	})

	it('exige client, procédé, désignation et groupe selon le type', () => {
		expect(Object.keys(validateArticle({ type: 'Client' }, false))).toEqual(['designation', 'groupe', 'procede', 'client'])
		expect(Object.keys(validateArticle({ type: 'Général' }, false))).toEqual(['designation', 'groupe'])
		expect(validateArticle({ type: 'Client', designation: 'A', groupe: 'Produits', procede: 'Offset' }, true)).toEqual({})
	})

	it('n’envoie que ce qui a changé', () => {
		const initial = ficheFormValues({ custom_uv: 1, custom_support: 'BBTB' }, schema)
		expect(initial.custom_uv).toBe('1')
		expect(initial.custom_acrylique).toBe('0')
		expect(initial.custom_nombre_de_poses).toBe('')
		expect(changedFields(initial, { ...initial, custom_uv: '0' })).toEqual({ custom_uv: '0' })
		expect(changedFields({ a: ' x ' }, { a: 'x' })).toEqual({})
	})
})
