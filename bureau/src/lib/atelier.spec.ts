import { describe, expect, it, vi } from 'vitest'
import { commonCutLabel, downloadFile, fileLabel, isPdf, manualFormat, mm, presseAlert, replacementText, rollOf, sameSheet, scenarioAlerts, setPendingNotice, sheetsFor, sortScenarios, takePendingNotice, tonnageFor, type Scenario } from './atelier'

const scenario = (values: Partial<Scenario> = {}) => ({ libelle: 'A', origine: 'Stock', laize: 1020, depl: 700, nb_poses: 4, n_col: 2, n_rang: 2, rotation: 0, taux_chutes: 35, pas_laize: 381.96, pas_depl: 337.05, trait_commun_laize: 1, trait_commun_depl: 0, reste_laize: 240.04, reste_depl: 1.9, surface_par_pose: 1785, nb_feuilles: 25000, tonnage: 5.176, ...values }) as Scenario

describe('atelier', () => {
	it('redonne feuilles et tonnage du moteur', () => {
		expect(sheetsFor(scenario(), 100000)).toBe(25000)
		expect(tonnageFor(scenario(), 100000, 290)).toBeCloseTo(5.1765, 3)
		expect(sheetsFor(scenario(), 0)).toBe(0)
		expect(tonnageFor(scenario(), 100000, 0)).toBe(0)
	})
	it('reconnaît un tracé lisible', () => {
		expect(isPdf('/private/files/a.PDF')).toBe(true)
		expect(isPdf('/files/a.png')).toBe(false)
		expect(isPdf(null)).toBe(false)
		expect(fileLabel('/private/files/Etui%2072.pdf')).toBe('Etui 72.pdf')
	})
	it('écrit les mm et le trait commun', () => {
		expect(mm(381.96)).toBe('381,96')
		expect(mm(null)).toBe('—')
		expect(commonCutLabel(scenario())).toBe('Laize')
		expect(commonCutLabel(scenario({ trait_commun_laize: 0 }))).toBe('Aucun')
	})
	it('compare à la presse sans le moteur', () => {
		const presse = { nom: 'KOMORI', laize: 1020, depl: 720 }
		expect(presseAlert(scenario(), presse)).toBeNull()
		expect(presseAlert(scenario(), null)).toBeNull()
		expect(presseAlert(scenario({ depl: 800 }), presse)?.tone).toBe('red')
	})
	it('sépare les alertes du moteur', () => {
		const alerts = scenarioAlerts(scenario({ alerte: 'format absent du stock ; reste 0.00 mm en laize' }), { nom: 'K', laize: 800, depl: 700 })
		expect(alerts.map((alert) => alert.tone)).toEqual(['amber', 'amber', 'red'])
		expect(alerts[0].text).toBe('Format absent du stock.')
		expect(scenarioAlerts(scenario({ alerte: null }))).toEqual([])
	})
	it('trie sans toucher à la liste', () => {
		const rows = [scenario({ taux_chutes: 35 }), scenario({ taux_chutes: 15 })]
		expect(sortScenarios(rows, 'taux_chutes', 1)[0].taux_chutes).toBe(15)
		expect(sortScenarios(rows, 'taux_chutes', -1)[0].taux_chutes).toBe(35)
		expect(rows[0].taux_chutes).toBe(35)
	})
	it('contrôle un format ajouté à la main', () => {
		expect(manualFormat('', '700', [])).toContain('laize')
		const added = manualFormat('780,5', '700', [])
		expect(added).toMatchObject({ laize: 780.5, depl: 700, origine: 'Manuel', coche: true })
		expect(manualFormat('780', '700', [added as never])).toContain('déjà')
	})
	it('exige le maximum de coupe d\'une bobine', () => {
		expect(manualFormat('', '1020', [], true)).toContain('laize')
		expect(manualFormat('800', '', [], true)).toContain('maximum de coupe')
		expect(manualFormat('800', '-5', [], true)).toContain('maximum de coupe')
		expect(manualFormat('800', '', [])).toContain('déplacement')
		const bobine = manualFormat('800', '1020', [], true)
		expect(bobine).toMatchObject({ laize: 800, depl: 1020, bobine: 1, libelle: 'Bobine 800 mm (max 1020)' })
		expect(manualFormat('800', '1020', [bobine as never], true)).toContain('déjà')
		expect(manualFormat('800', '1020', [bobine as never])).toMatchObject({ bobine: 0 })
	})
	it('retrouve la bobine d\'une feuille', () => {
		const format = (depl: number) => ({ laize: 800, depl, origine: 'Stock', libelle: '', bobine: 1, coche: true })
		const row = { origine: 'Bobine', laize: 800, libelle: 'Bobine 800 mm — 2×2 · coupe 698 mm (max 1020)' }
		expect(rollOf(row, [format(800), format(1020)])?.depl).toBe(1020)
		expect(rollOf({ ...row, libelle: 'Bobine 800 mm — 2×2 · coupe 698 mm' }, [format(1020), format(0)])?.depl).toBe(0)
		expect(rollOf({ ...row, origine: 'Stock' }, [format(0)])).toBeNull()
		expect(rollOf(row, [])).toEqual({ laize: 800, depl: 0 })
	})
	it('reconnaît une feuille déjà calculée', () => {
		expect(sameSheet(scenario(), scenario())).toBe(true)
		expect(sameSheet(scenario(), scenario({ n_rang: 3 }))).toBe(false)
	})
	it("annonce l'imposition remplacée", () => {
		expect(replacementText({ name: 'E', imposition: 'IMP-1' })).toContain('remplacera IMP-1')
		expect(replacementText({ name: 'E', imposition: null })).toContain('sera liée')
	})
	it('télécharge sans ouvrir de fenêtre', () => {
		const opened = vi.spyOn(window, 'open')
		const clicked: { download: string; href: string }[] = []
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
			clicked.push({ download: this.download, href: this.getAttribute('href') ?? '' })
		})
		downloadFile('/private/files/a.pdf', 'a.pdf')
		expect(clicked).toEqual([{ download: 'a.pdf', href: '/private/files/a.pdf' }])
		expect(opened).not.toHaveBeenCalled()
		expect(document.querySelector('a[download]')).toBeNull()
		click.mockRestore()
		opened.mockRestore()
	})
	it('garde le message de retour une seule fois', () => {
		setPendingNotice('ok')
		expect(takePendingNotice()).toBe('ok')
		expect(takePendingNotice()).toBe('')
	})
})
