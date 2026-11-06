import { describe, expect, it } from 'vitest'
import { catalogRows, demandeNext, demandeSteps, DEMANDE_COLUMNS, demandeSortText, draftStatus, draftValues, duplicateLines, expectedProcede, lineStudyStatus, visibleDemandeColumns, type ArticleChoice, type DemandeDetail, type DraftLine } from './demandes'

const article = (name: string, procede: string, extra: Partial<ArticleChoice> = {}): ArticleChoice => ({ name, designation: `ETUI ${name}`, reference: null, procedes: procede ? [procede] : [], support: 'BBTB', format: '10×20', bat: null, last_quantity: 0, compose: 0, unavailable: null, ...extra })
const line = (id: number, name: string, quantity = ''): DraftLine => ({ id, article: name, designation: name, last_quantity: 0, quantity, est_creation: false })
const demande = (status: string, extra: Partial<DemandeDetail> = {}) => ({ name: 'DF-1', status, actions: [], etudes: [], devis: [], commandes: [], lines: [], ...extra }) as unknown as DemandeDetail
const etude = (status: string, extra = {}) => ({ name: 'E', doctype: 'Etude Faisabilite', status, article: 'A', article_parent: null, designation: 'A', quantite: 100, ...extra })

describe('colonnes des demandes', () => {
	it('garde toujours la colonne Demande et ignore une clé inconnue', () => {
		expect(visibleDemandeColumns(['inconnue']).map((column) => column.key)).toEqual(['name'])
	})
	it('annonce le tri par défaut et le tri choisi', () => {
		expect(demandeSortText(null)).toBe('Tri : les plus récentes')
		expect(demandeSortText({ key: 'status', dir: 'asc' })).toBe('Tri : statut')
	})
	it('exporte le premier article et le nombre des autres', () => {
		const column = DEMANDE_COLUMNS.find((item) => item.key === 'articles')!
		expect(column.text({ articles: 'ETUI', articles_count: 3 } as never)).toBe('ETUI +2')
	})
})

describe('catalogue de la fenêtre', () => {
	const articles = [article('A', 'Offset'), article('B', 'Flexo'), article('C', '', { unavailable: 'Procédé à renseigner' })]

	it('masque et compte les articles de l’autre procédé depuis un ticket', () => {
		const result = catalogRows(articles, [], { procede: 'Offset', fromTicket: true, query: '' })
		expect(result.rows.map((row) => row.name)).toEqual(['A', 'C'])
		expect(result.masked).toBe(1)
		expect(result.maskedProcede).toBe('Flexo')
	})

	it('sans ticket, le premier article fixe le procédé et grise les autres', () => {
		expect(expectedProcede(null, [], articles)).toBeNull()
		const lines = [line(1, 'A')]
		expect(expectedProcede(null, lines, articles)).toBe('Offset')
		const result = catalogRows(articles, lines, { procede: 'Offset', fromTicket: false, query: '' })
		expect(result.masked).toBe(0)
		expect(result.rows.find((row) => row.name === 'B')).toMatchObject({ locked: true, actionLabel: 'Flexo : autre demande' })
	})

	it('propose une autre quantité pour un article déjà ajouté', () => {
		const result = catalogRows(articles, [line(1, 'A')], { procede: 'Offset', fromTicket: true, query: '' })
		expect(result.rows[0]).toMatchObject({ inDemande: true, action: 'more', actionLabel: '+ Autre quantité' })
	})

	it('refuse un article sans procédé et un composé de deux procédés', () => {
		const mixed = article('M', 'Offset', { procedes: ['Flexo', 'Offset'] })
		const result = catalogRows([articles[2], mixed], [], { procede: null, fromTicket: false, query: '' })
		expect(result.rows.map((row) => row.locked)).toEqual([true, true])
	})

	it('cherche sans tenir compte des accents ni de l’ordre des mots', () => {
		const items = [article('A', 'Offset', { designation: 'ÉTUI BISCUIT' }), article('B', 'Offset', { designation: 'COFFRET' })]
		expect(catalogRows(items, [], { procede: null, fromTicket: false, query: 'biscuit etui' }).rows.map((row) => row.name)).toEqual(['A'])
	})
})

describe('lignes de la fenêtre', () => {
	it('repère le même article avec la même quantité, pas une autre quantité', () => {
		expect([...duplicateLines([line(1, 'A', '100'), line(2, 'A', '200'), line(3, 'A', '100'), line(4, 'A', '')])]).toEqual([3])
	})

	it('dit ce qui bloque, le doublon avant la quantité manquante', () => {
		const base = { date: '2026-11-20', type: 'Premier Tirage', bonCommande: '', client: 'C' }
		expect(draftStatus({ ...base, client: null, lines: [] }).text).toBe('Chargement…')
		expect(draftStatus({ ...base, lines: [] }).text).toBe('Ajoutez au moins un article.')
		expect(draftStatus({ ...base, lines: [line(1, 'A', '1'), line(2, 'A', '1'), line(3, 'B')] })).toMatchObject({ text: '1 doublon à corriger', tone: 'error', blocking: true })
		expect(draftStatus({ ...base, lines: [line(1, 'A'), line(2, 'B')] })).toMatchObject({ text: '2 quantités à saisir', tone: 'todo' })
		expect(draftStatus({ ...base, type: 'Retirage', lines: [line(1, 'A', '1')] }).text).toBe('Nº de bon de commande à saisir')
		expect(draftStatus({ ...base, lines: [line(1, 'A', '1')] }).blocking).toBe(false)
	})

	it('n’envoie le bon de commande que pour un retirage', () => {
		const state = { date: '2026-11-20', type: 'Premier Tirage', bonCommande: 'BC', client: 'C', lines: [{ ...line(1, 'A', '100'), est_creation: true }] }
		expect(draftValues(state)).toEqual({ client: 'C', type: 'Premier Tirage', date_livraison: '2026-11-20', n_bon_commande: '', lines: [{ article: 'A', quantite: 100, est_creation: 1 }] })
		expect(draftValues({ ...state, type: 'Retirage' }).n_bon_commande).toBe('BC')
	})
})

describe('avancement de la fiche', () => {
	const keys = (record: DemandeDetail) => demandeSteps(record).filter((step) => step.next).map((step) => step.key)

	it('fait ressortir l’étape à faire selon le statut', () => {
		expect(keys(demande('Brouillon'))).toEqual(['demande'])
		expect(keys(demande('En Cours', { etudes: [etude('En étude')] }))).toEqual(['etudes'])
		expect(keys(demande('Finalisée', { etudes: [etude('Réalisable')] }))).toEqual(['devis'])
		expect(keys(demande('Annulée'))).toEqual([])
	})

	it('compte les études terminées', () => {
		const record = demande('Partiellement Finalisée', { etudes: [etude('Réalisable'), etude('Nouveau', { name: 'E2' })] })
		expect(demandeSteps(record)[1]).toMatchObject({ done: false, sub: '1 sur 2 terminées' })
	})

	it('ne propose une action qu’à qui peut la lancer', () => {
		expect(demandeNext(demande('Brouillon', { actions: ['confirm'] }))?.action).toBe('confirm')
		expect(demandeNext(demande('Brouillon'))?.action).toBeUndefined()
		expect(demandeNext(demande('Finalisée', { etudes: [etude('Réalisable')] }))).toMatchObject({ eyebrow: 'En attente du service devis' })
		expect(demandeNext(demande('Commandé'))).toBeNull()
	})

	it('relie une ligne à son étude, et un composé à ses sous-articles', () => {
		const record = { etudes: [etude('Réalisable'), etude('En étude', { name: 'S1', article: 'S', article_parent: 'P', quantite: 200 }), etude('Réalisable', { name: 'S2', article: 'T', article_parent: 'P', quantite: 300 })] } as never
		expect(lineStudyStatus(record, { article: 'A', quantite: 100 })).toBe('Réalisable')
		expect(lineStudyStatus(record, { article: 'A', quantite: 999 })).toBeNull()
		expect(lineStudyStatus(record, { article: 'P', quantite: 100 })).toBe('En étude')
	})
})
