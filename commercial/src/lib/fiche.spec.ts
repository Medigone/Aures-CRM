import { describe, expect, it } from 'vitest'
import { editableGroups, ficheDoc, ficheGroups } from './fiche'
import type { FicheSchema } from '@/types'

const client = "eval: doc.custom_type_article == 'Client' && doc.custom_article_compose == 0"
const schema: FicheSchema = {
	fields: ['custom_type_support', 'custom_support', 'custom_fenêtre', 'custom_pvc_fenêtre', 'custom_conditionnement'],
	groups: [
		{ label: 'Général', fields: [{ fieldname: 'custom_conditionnement', label: 'Conditionnement', fieldtype: 'Select', conditions: [client] }] },
		{ label: 'Flexo', fields: [{ fieldname: 'custom_type_support', label: 'Type Support', fieldtype: 'Select', conditions: [client, 'eval: doc.custom_procédé == "Flexo"'] }] },
		{
			label: 'Offset',
			fields: [
				{ fieldname: 'custom_support', label: 'Papier', fieldtype: 'Link', conditions: [client, 'eval: doc.custom_procédé == "Offset"'] },
				{ fieldname: 'custom_fenêtre', label: 'Fenêtre', fieldtype: 'Check', conditions: [client, 'eval: doc.custom_procédé == "Offset"'] },
				{ fieldname: 'custom_pvc_fenêtre', label: 'Fenêtre avec PVC', fieldtype: 'Check', conditions: [client, 'eval: doc.custom_procédé == "Offset"', 'eval:doc.custom_fenêtre==1'] },
			],
		},
	],
}
const article = { designation: 'ÉTUI', client: 'CL-1', procede: 'Offset', compose: 0, sous_article: 0 }

describe('fiche technique', () => {
	it("n'affiche que les champs du procédé de l'article, même si d'autres sont renseignés", () => {
		const doc = ficheDoc(article, { custom_type_support: 'BOPP Transparent', custom_support: 'BBTB', custom_conditionnement: 'Auto', custom_fenêtre: 1 })
		const groups = ficheGroups(schema, doc)
		expect(groups.map((g) => g.label)).toEqual(['Général', 'Offset'])
		expect(groups[1].rows.map((r) => r.value)).toEqual(['BBTB'])
		expect(groups[1].checks.map((c) => c.label)).toEqual(['Fenêtre'])
	})

	it('montre les sous-champs quand leur case est cochée, et rien pour un article composé', () => {
		const sans = editableGroups(schema, ficheDoc(article, {}))
		expect(sans.find((g) => g.label === 'Offset')?.fields.map((f) => f.fieldname)).toEqual(['custom_support', 'custom_fenêtre'])
		const avec = editableGroups(schema, ficheDoc(article, { custom_fenêtre: 1 }))
		expect(avec.find((g) => g.label === 'Offset')?.fields).toHaveLength(3)
		expect(editableGroups(schema, ficheDoc({ ...article, compose: 1 }, {}))).toEqual([])
	})

	it('masque les valeurs sans information (« Sans », 0)', () => {
		const doc = ficheDoc({ ...article, procede: 'Flexo' }, { custom_type_support: 'Sans' })
		expect(ficheGroups(schema, doc)).toEqual([])
	})
})
