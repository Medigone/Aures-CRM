import { describe, expect, it } from 'vitest'
import { conditionsForServer, describeCondition, fieldTitle, hasBell, isComplete, newCondition, operatorOptions, searchFields, ticketFilterFields, toggleBell, valueChoices, valueInput, type Condition, type FilterField } from './filters'

const field = (name: string, label: string, kind: FilterField['kind'], operators: string[], extra: Partial<FilterField> = {}): FilterField => ({ value: `${extra.doctype ?? 'Item'}.${name}`, doctype: 'Item', field: name, label, kind, operators, ...extra })
const fields: FilterField[] = [
	field('_user_tags', 'Tag', 'text', ['like', 'not like', 'in', 'is']),
	field('code', 'Code', 'text', ['like', '='], { doctype: 'Article Couleur', group: 'Couleurs', table: 'Couleurs' }),
	field('procede', 'Procédé', 'choice', ['=', '!=', 'in', 'is'], { choices: [{ value: 'Offset', label: 'Offset' }] }),
	field('recto', 'Recto Verso', 'check', ['='], { group: 'Offset', choices: [{ value: '1', label: 'Oui' }, { value: '0', label: 'Non' }] }),
	field('grammage', 'Grammage', 'link', ['=', '!=', 'like', 'in', 'is'], { group: 'Offset', link_doctype: 'Grammage Papier' }),
	field('passages', 'Nombre Passages', 'number', ['=', '>', 'is'], { group: 'Fiche' }),
	field('creation', 'Créé le', 'date', ['Between', 'Timespan', '<', '>=', 'is'], { group: 'Suivi' }),
]
const condition = (name: string, op: string, value = '', doctype = 'Item'): Condition => ({ id: 1, doctype, field: name, op, value })
const label = (name: string, op: string, value = '', doctype = 'Item') => describeCondition(condition(name, op, value, doctype), fields)

describe('conditions au format du Desk', () => {
	it('nomme les conditions selon la nature du champ', () => {
		const labels = (index: number) => operatorOptions(fields[index]).map((op) => op.label)
		expect(labels(2).slice(0, 2)).toEqual(['est', "n'est pas"])
		expect(labels(1)).toEqual(['contient', 'égal à'])
		expect(labels(6)).toEqual(['entre', 'période', 'avant le', 'au plus tôt le', 'renseigné ou non'])
	})

	it('choisit la saisie selon le champ et la condition', () => {
		const [tag, , procede, recto, grammage, passages, creation] = fields
		expect(valueInput(tag, 'like')).toBe('text')
		expect(valueInput(procede, '=')).toBe('select')
		expect(valueInput(procede, 'in')).toBe('list')
		expect(valueInput(procede, 'is')).toBe('select')
		expect(valueInput(recto, '=')).toBe('select')
		expect(valueInput(grammage, '=')).toBe('link')
		expect(valueInput(grammage, 'like')).toBe('text')
		expect(valueInput(passages, '>')).toBe('number')
		expect(valueInput(creation, '<')).toBe('date')
		expect(valueInput(creation, 'Between')).toBe('between')
		expect(valueInput(creation, 'Timespan')).toBe('select')
		expect(valueChoices(creation, 'is').map((item) => item.value)).toEqual(['set', 'not set'])
		expect(valueChoices(creation, 'Timespan')[0].value).toBe('last 7 days')
		expect(valueChoices(creation, 'Timespan')).toHaveLength(24)
		expect(valueChoices(procede, '=')).toEqual(procede.choices)
	})

	it('part de la première condition du champ, sans valeur', () => {
		expect(newCondition(4, fields[1])).toEqual({ id: 4, doctype: 'Article Couleur', field: 'code', op: 'like', value: '' })
		expect(newCondition(5, fields[6]).op).toBe('Between')
	})

	it('exige deux dates pour « entre »', () => {
		expect(isComplete({ op: 'Between', value: '2026-01-01,' })).toBe(false)
		expect(isComplete({ op: 'Between', value: ',2026-01-01' })).toBe(false)
		expect(isComplete({ op: 'Between', value: '2026-01-01,2026-02-01' })).toBe(true)
		expect(isComplete({ op: 'is', value: '' })).toBe(false)
		expect(isComplete({ op: 'is', value: 'set' })).toBe(true)
	})

	it("n'envoie que les filtres complets, sans identifiant", () => {
		expect(conditionsForServer([condition('procede', '=', 'Offset'), condition('recto', '=', ''), condition('code', 'like', '  186 ', 'Article Couleur')])).toEqual([
			{ doctype: 'Item', field: 'procede', op: '=', value: 'Offset' },
			{ doctype: 'Article Couleur', field: 'code', op: 'like', value: '186' },
		])
	})

	it('décrit un filtre actif en clair', () => {
		expect(label('code', 'like', '186', 'Article Couleur')).toBe('Couleurs · Code contient 186')
		expect(label('procede', '=', 'Offset')).toBe('Procédé est Offset')
		expect(label('recto', '=', '1')).toBe('Recto Verso est Oui')
		expect(label('passages', '>', '2')).toBe('Nombre Passages supérieur à 2')
		expect(label('creation', '<', '2026-11-05')).toBe('Créé le avant le 05/11/2026')
		expect(label('creation', 'Between', '2026-01-01,2026-03-31')).toBe('Créé le entre le 01/01/2026 et le 31/03/2026')
		expect(label('creation', 'Timespan', 'this month')).toBe('Créé le : ce mois-ci')
		expect(label('grammage', 'is', 'not set')).toBe('Grammage non renseigné')
		expect(label('grammage', 'is', 'set')).toBe('Grammage renseigné')
		expect(label('procede', '=', '')).toBe('Procédé est')
		expect(label('disparu', '=', 'x')).toBe('disparu égal à x')
	})
})

describe('liste des champs', () => {
	it('cherche sans tenir compte des accents ni des majuscules, par ordre alphabétique', () => {
		expect(searchFields(fields, 'PROCEDE').map((item) => item.label)).toEqual(['Procédé'])
		expect(searchFields(fields, 'nombre pass').map((item) => item.label)).toEqual(['Nombre Passages'])
		expect(searchFields(fields, '').map((item) => item.label)).toEqual(['Code', 'Créé le', 'Grammage', 'Nombre Passages', 'Procédé', 'Recto Verso', 'Tag'])
		expect(searchFields(fields, 'introuvable')).toEqual([])
	})

	it('retrouve un champ enfant par le nom de sa table', () => {
		expect(searchFields(fields, 'couleurs').map((item) => item.label)).toEqual(['Code'])
		expect(fieldTitle(fields[1])).toBe('Code · Couleurs')
		expect(fieldTitle(fields[0])).toBe('Tag')
	})

	it('range un accent à sa lettre, sans changer la liste reçue', () => {
		const list = [field('z', 'Zone', 'text', ['like']), field('e', 'Échéance', 'date', ['<']), field('d', 'Date', 'date', ['<'])]
		expect(searchFields(list, '').map((item) => item.label)).toEqual(['Date', 'Échéance', 'Zone'])
		expect(list[0].label).toBe('Zone')
	})

	it('garde les libellés de statut de la file', () => {
		const status = field('status', 'Statut', 'choice', ['='], { choices: [{ value: 'Pending', label: 'Pending' }] })
		const references = { types: [], statuses: [], urgences: [], creances: [], assignees: [], nobody: 'x', filter_fields: [status, fields[0]] }
		expect(ticketFilterFields(references)[0].choices).toEqual([{ value: 'Pending', label: 'En pause' }])
		expect(ticketFilterFields(references)[1]).toBe(fields[0])
		expect(ticketFilterFields(null)).toEqual([])
	})
})

describe('cloche', () => {
	it("s'allume puis s'éteint sans toucher aux autres filtres", () => {
		const other = { ...condition('_user_tags', 'like', 'x'), id: 4 }
		const on = toggleBell([other], 'Item')
		expect(on).toEqual([other, { id: 5, doctype: 'Item', field: 'cloche', op: '=', value: '1' }])
		expect(hasBell(on)).toBe(true)
		expect(toggleBell(on, 'Item')).toEqual([other])
	})

	it("ne compte que la cloche activée, et n'envoie aucun utilisateur", () => {
		expect(hasBell([condition('cloche', '!=', '1')])).toBe(false)
		expect(hasBell([condition('cloche', '=', '')])).toBe(false)
		expect(conditionsForServer(toggleBell([], 'Item'))).toEqual([{ doctype: 'Item', field: 'cloche', op: '=', value: '1' }])
	})

	it('se décrit dans la pastille', () => {
		const bell = field('cloche', 'Cloche', 'choice', ['=', '!='], { choices: [{ value: '1', label: 'activée' }] })
		expect(describeCondition(condition('cloche', '=', '1'), [bell])).toBe('Cloche est activée')
	})
})
