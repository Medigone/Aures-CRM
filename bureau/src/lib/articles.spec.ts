import { describe, expect, it } from 'vitest'
import { ARTICLE_COLUMNS, activationConsequence, cmjnHex, colorsAfterCard, couleursSansDetail, newTeinte, teinteDetail, teinteHex, teintesPayload, prepresseState, type ArticleDetail, articleDoc, articleSigle, articleSortText, changedFields, clientTone, creationCards, ficheCards, ficheCardValues, ficheFormValues, finishesSummary, formatQuantity, formatRate, procedeLabel, procedeTone, validateArticle, type ArticleOptions } from './articles'
import { normalizeColumns, resolveColumns } from './listViews'

const visibleArticleColumns = (keys: string[]) => resolveColumns(ARTICLE_COLUMNS, normalizeColumns(keys.map((key) => ({ key })), 'designation'))

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
	it('calcule le carré d’une teinte CMJN', () => {
		expect(cmjnHex(0, 0, 0, 0)).toBe('#ffffff')
		expect(cmjnHex(0, 0, 0, 100)).toBe('#000000')
		expect(cmjnHex(100, 50, 0, 20)).toBe('#0066cc')
		expect(teinteHex({ ...newTeinte('CMJN'), c: 100 })).toBe('#00ffff')
	})

	it('laisse un carré neutre à un code Pantone inconnu', () => {
		expect(teinteHex({ ...newTeinte('Pantone'), code: 'C1' })).toBeNull()
		expect(teinteHex({ ...newTeinte('Pantone'), code: '286 C', hex: '#112233' })).toBe('#112233')
	})

	it('n’envoie ni les lignes vides ni ce qui sert à l’affichage', () => {
		const lines = [newTeinte('Pantone'), newTeinte('CMJN'), { ...newTeinte('Pantone'), code: ' 286 C ', hex: '#112233', label: 'PANTONE 286 C', nom: ' Logo ' }, { ...newTeinte('CMJN'), m: 40, code: 'ancien' }]
		expect(teintesPayload(lines)).toEqual([
			{ type_couleur: 'Pantone', code: '286 C', nom: 'Logo', c: 0, m: 0, j: 0, n: 0 },
			{ type_couleur: 'CMJN', code: '', nom: '', c: 0, m: 40, j: 0, n: 0 },
		])
	})

	it('range les couleurs après l’impression, sinon après le format ou le support', () => {
		expect(colorsAfterCard(['Support', 'Format', 'Impression', 'Finitions'])).toBe('Impression')
		expect(colorsAfterCard(['Support', 'Format', 'Bobine'])).toBe('Format')
		expect(colorsAfterCard(['Support', 'Salle blanche'])).toBe('Support')
		expect(colorsAfterCard(['Finitions'])).toBeNull()
	})

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

	it('à la création, passe les champs communs après ceux du procédé', () => {
		const format = { groups: [{ label: 'Général', fields: [{ fieldname: 'custom_tolérance_', label: 'Tolérance', fieldtype: 'Data', conditions: [] }] }, { label: 'Offset', fields: [{ fieldname: 'custom_support', label: 'Papier', fieldtype: 'Data', conditions: [] }] }], fields: [] }
		expect(creationCards(format, {}).flatMap((card) => card.fields.map((field) => field.fieldname))).toEqual(['custom_support', 'custom_tolérance_'])
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

describe('lecture de la fiche technique', () => {
	it('range la tolérance et les passages après les champs du procédé, comme à la saisie', () => {
		const field = (fieldname: string, label: string) => ({ fieldname, label, fieldtype: 'Data', conditions: [], options: [] })
		const schema = { groups: [{ label: 'Offset', fields: [field('custom_tolérance_', 'Tolérance Grammage'), field('custom_support', 'Papier'), field('custom_grammage', 'Grammage')] }], fields: [] }
		const [card] = ficheCardValues(schema, { 'custom_tolérance_': '± 5 %', custom_support: 'BBTB', custom_grammage: '275' })
		expect(card.rows.map((row) => row.label)).toEqual(['Papier', 'Grammage', 'Tolérance Grammage'])
	})
})

describe('couleurs du tiroir', () => {
	it('sans détail, garde le mot du champ et annonce le nombre', () => {
		expect(couleursSansDetail('CMJN')).toBe('CMJN')
		expect(couleursSansDetail('CMJN + 3')).toBe('CMJN + 3')
		expect(couleursSansDetail('1')).toBe('1 couleur, détail non renseigné')
		expect(couleursSansDetail('4')).toBe('4 couleurs, détail non renseigné')
		expect(couleursSansDetail('')).toBeNull()
		expect(couleursSansDetail(null)).toBeNull()
	})
	it('nomme la nature de la couleur sous son code', () => {
		expect(teinteDetail({ ...newTeinte('CMJN'), nom: 'Noir' })).toBe('CMJN · Noir')
		expect(teinteDetail(newTeinte('Pantone'))).toBe('Pantone')
		expect(teinteDetail({ ...newTeinte('Pantone'), needs_suffix: 1 })).toBe('Précisez C ou U')
	})
})
