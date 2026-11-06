import { describe, expect, it } from 'vitest'
import { allKeys, buildDuplicateModel, currentPreset, duplicateSummary, duplicateWarnings, keepPayload, neverText, presetKeys, sousDesignation, toggleKey, toggleRubrique, withoutClientItems } from './articleDuplicate'
import type { ArticleDetail } from './articles'

const offset = "eval: doc.custom_procédé == 'Offset'"
const schema = {
	groups: [
		{
			label: 'Offset',
			fields: [
				{ fieldname: 'custom_support', label: 'Papier', fieldtype: 'Link', conditions: [offset], options: ['BBTB'] },
				{ fieldname: 'custom_cotations_article', label: 'Cotations Article', fieldtype: 'Data', conditions: [offset] },
				{ fieldname: 'custom_impression', label: 'Impression', fieldtype: 'Select', conditions: [offset], options: ['Pantone'] },
				{ fieldname: 'custom_recto_verso', label: 'Recto Verso', fieldtype: 'Check', conditions: [offset] },
			],
		},
		{ label: 'Options Vernis', fields: [{ fieldname: 'custom_uv', label: 'UV', fieldtype: 'Check', conditions: [offset] }, { fieldname: 'custom_acrylique', label: 'Acrylique', fieldtype: 'Check', conditions: [offset] }] },
	],
}
function article(changes: Partial<ArticleDetail> = {}) {
	return {
		name: 'IFRI-001',
		designation: 'ARTICLE 10',
		type: 'Client',
		procede: 'Offset',
		client: 'IFRI',
		client_label: 'IFRI',
		compose: 0,
		sous_article: 0,
		own_image: true,
		tags: ['New'],
		fichiers: { image: '/private/files/a.png', fiche_technique: '/private/files/bat.pdf', trace_decoupe: null },
		documents: [
			{ file_name: 'a.png', file_url: '/private/files/a.png', file_size: 1, owner_name: '', creation: '', roles: ['image'] },
			{ file_name: 'bat.pdf', file_url: '/private/files/bat.pdf', file_size: 1, owner_name: '', creation: '', roles: ['fiche_technique'] },
			{ file_name: 'note.png', file_url: '/private/files/note.png', file_size: 1, owner_name: '', creation: '', roles: [] },
		],
		fiche: { custom_support: 'BBTB', custom_cotations_article: '60x30x116', custom_impression: 'Pantone', custom_recto_verso: 1, custom_uv: 1, custom_acrylique: 0 },
		teintes: [{ type_couleur: 'Pantone', code: '186 C', nom: '', c: 0, m: 0, j: 0, n: 0, hex: '#d2142b' }],
		prepresse: {
			maquettes: [{ name: 'MAQ-V2', status: 'Version Activée' }, { name: 'MAQ-V1', status: 'Obsolète' }],
			bats: [],
			traces: [{ name: 'TRA-1', dimensions: '100x100' }],
			impositions: [{ name: 'IMP-1', nbr_poses: 4 }],
			cliches: [],
			plans_flexo: [],
			etudes_techniques: [{ name: 'ET-1' }],
		},
		droits_duplication: { article: true, trace: true, imposition: true, maquette: true, plan_flexo: true },
		sous_articles: [],
		devis: [{}],
		commandes: [],
		...changes,
	} as unknown as ArticleDetail
}

describe('duplication : ce qui se propose', () => {
	it('range la fiche par rubrique et ne propose que les valeurs renseignées', () => {
		const model = buildDuplicateModel(article(), schema)
		expect(model.rubriques.map((rubrique) => rubrique.title)).toEqual(['Support', 'Format', 'Impression', 'Couleurs', 'Vernis'])
		expect(model.rubriques.find((rubrique) => rubrique.key === 'Vernis')?.fields.map((field) => field.label)).toEqual(['UV'])
	})
	it('déduit Impression des couleurs : le champ ne se coche pas à part', () => {
		const model = buildDuplicateModel(article(), schema)
		expect(model.rubriques.find((rubrique) => rubrique.key === 'Impression')?.fields.map((field) => field.key)).toEqual(['f:custom_recto_verso'])
		expect(buildDuplicateModel(article({ teintes: [] }), schema).rubriques.find((rubrique) => rubrique.key === 'Impression')?.fields).toHaveLength(2)
	})
	it('un article composé propose ses sous-articles à la place de sa fiche', () => {
		const model = buildDuplicateModel(article({ compose: 1, sous_articles: [{ name: 'IFRI-012-1', designation: 'X-ETIQUETTE', quantite: 2, support: null, format: null, bat: null }] }), schema)
		expect(model.rubriques).toEqual([])
		expect(model.sous[0]).toMatchObject({ key: 's:IFRI-012-1', sub: 'Depuis IFRI-012-1 · quantité 2' })
	})
	it('garde visible ce que les droits refusent, sans le cocher', () => {
		const model = buildDuplicateModel(article({ droits_duplication: { article: true, trace: false, imposition: true, maquette: true, plan_flexo: true } }), schema)
		expect(model.prepresse[0].refused).toBeTruthy()
		expect(presetKeys(model, 'tout').has('p:trace')).toBe(false)
	})
	it("reprend la dernière maquette valable quand aucune n'est active", () => {
		const prepresse = { ...article().prepresse, maquettes: [{ name: 'MAQ-A', status: 'A référencer' }, { name: 'MAQ-O', status: 'Obsolète' }] }
		const model = buildDuplicateModel(article({ prepresse } as unknown as Partial<ArticleDetail>), schema)
		expect(model.prepresse.find((row) => row.key === 'p:maquette')).toMatchObject({ title: 'Dernière maquette' })
	})
})

describe('duplication : sélections', () => {
	const model = buildDuplicateModel(article(), schema)

	it('aucun départ ne coche le BAT', () => {
		for (const preset of ['tout', 'forme', 'fiche'] as const) expect(presetKeys(model, preset).has('d:fiche_technique')).toBe(false)
	})
	it('Même forme laisse le visuel de côté et garde le tracé', () => {
		const keys = presetKeys(model, 'forme')
		expect(keys.has('t:0')).toBe(false)
		expect(keys.has('p:maquette')).toBe(false)
		expect(keys.has('f:custom_recto_verso')).toBe(false)
		expect(keys.has('p:trace')).toBe(true)
		expect(keys.has('f:custom_uv')).toBe(true)
	})
	it('un autre client retire la maquette et l image, et reconnaît encore le départ', () => {
		const keys = withoutClientItems(presetKeys(model, 'tout'))
		expect(keys.has('p:maquette')).toBe(false)
		expect(keys.has('d:image')).toBe(false)
		expect(currentPreset(model, keys, true)).toBe('tout')
	})
	it('reconnaît un départ, puis une sélection sur mesure', () => {
		const keys = presetKeys(model, 'fiche')
		expect(currentPreset(model, keys)).toBe('fiche')
		expect(currentPreset(model, toggleKey(model, keys, 'f:custom_uv'))).toBeNull()
	})
	it('décocher le tracé décoche l imposition', () => {
		const keys = toggleKey(model, presetKeys(model, 'tout'), 'p:trace')
		expect(keys.has('p:imposition')).toBe(false)
	})
	it('une rubrique partielle se coche entière, puis se décoche', () => {
		const rubrique = model.rubriques.find((row) => row.key === 'Support')!
		const on = toggleRubrique(new Set(), rubrique)
		expect(on.has('f:custom_support')).toBe(true)
		expect(toggleRubrique(on, rubrique).size).toBe(0)
	})
	it('compte tous les éléments proposés', () => {
		expect(allKeys(model)).toContain('d:documents')
	})
})

describe('duplication : envoi et messages', () => {
	const model = buildDuplicateModel(article(), schema)

	it('sépare ce qui part au serveur', () => {
		expect(keepPayload(new Set(['f:custom_uv', 't:1', 't:0', 'p:trace', 'd:image', 'd:documents', 'd:tags', 's:A']))).toEqual({ fields: ['custom_uv'], teintes: [0, 1], prepresse: ['trace'], fichiers: ['image'], documents: true, tags: true, sous_articles: ['A'] })
	})
	it('signale le tracé sans cotations et le BAT repris', () => {
		const keys = new Set(['p:trace', 'd:fiche_technique'])
		const warnings = duplicateWarnings(article(), model, keys, 'IFRI', false)
		expect(warnings.prepresse[0]).toContain('cotations')
		expect(warnings.fichiers[0]).toContain('validé pour ARTICLE 10')
	})
	it('signale la maquette reprise pour un autre client', () => {
		const warnings = duplicateWarnings(article(), model, new Set(['p:maquette', 'f:custom_cotations_article', 't:0']), 'ITT', true)
		expect(warnings.prepresse).toEqual(["Cette maquette porte le visuel de IFRI : vérifiez que ITT peut l'utiliser."])
	})
	it('résume par rubrique, partiel compris', () => {
		const keys = presetKeys(model, 'fiche')
		const support = model.rubriques.find((row) => row.key === 'Vernis')!
		expect(support.fields).toHaveLength(1)
		const summary = duplicateSummary(model, keys)
		expect(summary.kept[0].text).toContain('Couleurs')
		expect(summary.left.find((line) => line.title === 'Prépresse')?.text).toBe('Tracé, Imposition, Maquette active')
	})
	it('annonce ce qui reste sur l origine avec les vrais nombres', () => {
		expect(neverText(article())).toContain("l'étude technique (1)")
		expect(neverText(article())).toContain("l'ancienne version de maquette")
	})
	it('fait suivre le suffixe du sous-article', () => {
		expect(sousDesignation('BOUTEILLE 0,5 L', 'BOUTEILLE 0,5 L-BO', 'bouteille 1 l')).toBe('BOUTEILLE 1 L-BO')
		expect(sousDesignation('A', 'AUTRE', 'B')).toBe('BUTRE')
		expect(sousDesignation('XX', 'AUTRE', 'B')).toBe('B-AUTRE')
	})
})
