import { describe, expect, it } from 'vitest'
import { activationConsequence, prepresseState, type ArticleDetail, articleConditionLabel, articleDoc, articleFilterChoices, articleSigle, articleSortText, changedFields, clientTone, createFields, ficheCards, ficheCardValues, ficheFormValues, finishesSummary, formatQuantity, formatRate, procedeLabel, procedeTone, validateArticle, visibleArticleColumns, type ArticleOptions } from './articles'

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

describe('repères de couleur', () => {
	it('chaque procédé a sa teinte et son sigle, et le rouge reste réservé à ce qui bloque', () => {
		expect(procedeTone('Offset')).toBe('tone-blue')
		expect(procedeTone('Flexo')).toBe('tone-green')
		expect(procedeTone('Salle Blanche Pharma')).toBe('tone-violet')
		expect(procedeTone('Numérique')).toBe('tone-amber')
		expect(procedeTone(null)).toBe('tone-gray')
		expect(procedeLabel('Salle Blanche Pharma')).toBe('Salle blanche')
		expect(articleSigle({ procede: 'Salle Blanche Pharma', designation: 'TEST' })).toBe('SB')
		expect(articleSigle({ procede: null, designation: 'encre bleu' })).toBe('EN')
	})
	it('un client garde toujours la même teinte, jamais le rouge', () => {
		for (const client of ['IFRI', 'ITT', 'AURES EMBALLAGES', 'BISCUITERIE SAI', 'TEST 100']) {
			expect(clientTone(client)).toBe(clientTone(client))
			expect(clientTone(client)).not.toBe('tone-red')
		}
	})
})

describe('prepresseState', () => {
	const base = { procede: 'Offset', name: 'A-1', ecart_bat: null, prepresse: { maquettes: [], bats: [], traces: [], impositions: [], cliches: [], plans_flexo: [], etudes_techniques: [] } }
	const maquette = { name: 'M-1', status: 'Version Activée', ver: 1, resume_couleurs: null, date_creation: null, desc_changements: null, fichier_maquette: null }
	const complete = { maquettes: [maquette], traces: [{ name: 'T', dimensions: '100x100', fichier_trace: null }], impositions: [{ name: 'I', machine_impression: null, nbr_poses: 1, taux_chutes: 10, defaut: 1, fichier_imp: null }] }
	const state = (prepresse: object, extra: object = {}) => prepresseState({ ...base, ...extra, prepresse: { ...base.prepresse, ...prepresse } } as unknown as ArticleDetail)

	it('demande le premier maillon manquant', () => {
		expect(state({}).next?.title).toBe('Créer le tracé')
		expect(state({ traces: complete.traces, maquettes: [{ ...maquette, status: 'A référencer' }] }).next?.title).toBe('Référencer la maquette')
		expect(state({ traces: complete.traces, maquettes: [{ ...maquette, status: 'Obsolète' }] }).next?.title).toBe('Activer une maquette')
	})
	it('crée le BAT depuis une étude qui a sa maquette, sinon envoie sur l’étude', () => {
		const etude = { name: 'E', status: 'En Cours', date: '2025-10-29', nom_utilisateur: null, machine: null, nb_passages: 0, maquette: 'M-1', bat: null }
		const ready = state({ ...complete, etudes_techniques: [etude] })
		expect(ready.next).toMatchObject({ title: 'Créer le BAT', action: 'bat', etude: 'E' })
		expect(ready.steps.map((step) => step.done)).toEqual([true, true, true, false])
		expect(state({ ...complete, etudes_techniques: [{ ...etude, maquette: null }] }).next?.action).toBeUndefined()
		expect(state(complete).next?.text).toContain('Il manque une étude technique')
	})
	it('ne propose rien quand le BAT validé couvre la maquette en service', () => {
		const bat = { name: 'B', status: 'BAT-P Validé', date: null, maquette: 'M-1', valide_par_nom: null, fichier_valide: null, image: null }
		const done = state({ ...complete, bats: [bat, { ...bat, name: 'B0', status: 'Obsolète' }] })
		expect(done.next).toBeNull()
		expect(done.batCovers).toBe(true)
		expect(done.oldBats.map((row) => row.name)).toEqual(['B0'])
	})
	it('annonce ce que l’activation rend obsolète', () => {
		const bat = { name: 'B', status: 'BAT-P Validé', date: null, maquette: 'M-1', valide_par_nom: null, fichier_valide: null, image: null }
		const article = { ...base, prepresse: { ...base.prepresse, maquettes: [maquette, { ...maquette, name: 'M-2', status: 'Obsolète' }], bats: [bat] } } as unknown as ArticleDetail
		expect(activationConsequence(article, 'M-2')).toBe('M-1 passe en obsolète. B devient obsolète.')
	})
})
