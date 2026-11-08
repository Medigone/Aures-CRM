import { describe, expect, it, vi } from 'vitest'
import { commonCutLabel, downloadFile, fileLabel, gridLabel, isPdf, manualFormat, mm, motifLabel, motifsSummary, pitchLabel, poseTransform, posesOf, parseQuantities, presseAlert, fibreRotation, fibreSummary, formatFibre, cotesOf, isGabarit, gabaritPaths, referenceFormat, tierResults, allQuantities, materialCost, referenceReason, replacementText, rollOf, sameSheet, scenarioAlerts, setPendingNotice, sheetsFor, sortScenarios, takePendingNotice, tonnageFor, type AtelierReference, type Scenario } from './atelier'

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

describe('tête-bêche et quinconce', () => {
	const teteBeche = scenario({ motif: 'Tête-bêche', axe_motif: 'Colonnes', decalage_laize: 238.2, decalage_depl: 12.46, pas_paire: 389.2, pas_laize: 194.6, pas_depl: 654.05 })
	it('nomme le motif et son décalage', () => {
		expect(motifLabel(teteBeche)).toBe('Tête-bêche en colonnes, décalage 12,5 mm')
		expect(motifLabel(scenario({ motif: 'Quinconce', axe_motif: 'Rangs', decalage_laize: 0 }))).toBe('Quinconce en rangs, alignés')
		expect(motifLabel(scenario())).toBe('Grille droite')
		expect(motifLabel(scenario({ motif: 'Grille droite' }))).toBe('Grille droite')
		expect(gridLabel(teteBeche)).toBe('2 × 2 · tête-bêche')
		expect(gridLabel(scenario())).toBe('2 × 2')
		expect(pitchLabel(teteBeche)).toBe('389,2 la paire × 654,05')
		expect(pitchLabel(scenario())).toBe('381,96 × 337,05')
		expect(motifsSummary('Non')).toBe('sans tête-bêche')
	})
	it('distingue une grille droite et un motif sur la même feuille', () => {
		expect(sameSheet(scenario(), teteBeche)).toBe(false)
		expect(sameSheet(teteBeche, { ...teteBeche, cle: 'essai-1' })).toBe(true)
	})
	it('reprend les poses du moteur, ou la grille droite d\'un ancien calcul', () => {
		expect(posesOf({ ...teteBeche, poses: [[0, 12.5, 0], [238.2, 0, 180]] })).toEqual([[0, 12.5, 0], [238.2, 0, 180]])
		expect(posesOf(scenario({ n_col: 2, n_rang: 1, pas_laize: 100, rotation: 90 }))).toEqual([[0, 0, 90], [100, 0, 90]])
	})
	it('retourne de 180° une pose à 180° ou 270°', () => {
		expect(poseTransform([5, 6, 0], 10, 12, 140, 200)).toBe('translate(15 18)')
		expect(poseTransform([5, 6, 90], 10, 12, 140, 200)).toBe('translate(15 18)')
		expect(poseTransform([5, 6, 270], 10, 12, 140, 200)).toBe('translate(15 18) rotate(180 70 100)')
	})
})

describe('impositions déjà fabriquées', () => {
	const reference = (values: Partial<AtelierReference> = {}) => ({ name: 'IMP-1', format: '720 × 450', laize: 720, depl: 450, nbr_poses: 6, client_label: 'Biopharm', meme_client: false, ecart: 4.5, ...values }) as AtelierReference
	it('dit pourquoi un article est proche', () => {
		expect(referenceReason(reference())).toBe('Biopharm, cotes à 4,5 %')
		expect(referenceReason(reference({ meme_client: true, ecart: 0 }))).toBe('Même client, mêmes cotes')
		expect(referenceReason(reference({ meme_client: true, ecart: null }))).toBe('Même client, même support')
	})
	it('ne part pas d\'une imposition sans format lisible', () => {
		expect(referenceFormat(reference())).toEqual({ laize: 720, depl: 450 })
		expect(referenceFormat(reference({ laize: 0, depl: 0 }))).toBeNull()
	})
})

describe('paliers de quantité', () => {
	it('lit les quantités saisies, milliers séparés ou non', () => {
		expect(parseQuantities('5 000, 10000; 20.000')).toEqual([5000, 10000, 20000])
		expect(parseQuantities('20000 5000 5000')).toEqual([5000, 20000])
		expect(parseQuantities('')).toEqual([])
		expect(parseQuantities('5000, dix')).toBe("« dix » n'est pas une quantité.")
		expect(allQuantities(10000, [5000, 10000, 20000])).toEqual([5000, 10000, 20000])
	})
	it('le format gagnant change avec la quantité', () => {
		const petit = scenario({ libelle: 'Petit', laize: 720, depl: 450, nb_poses: 6 })
		const grand = scenario({ libelle: 'Grand', laize: 1020, depl: 700, nb_poses: 14 })
		const [peu, beaucoup] = tierResults([grand, petit], [6, 14000], 300, 200000)
		expect(peu.winner.libelle).toBe('Petit')
		expect(peu.formatChange).toBe(false)
		expect(beaucoup.winner.libelle).toBe('Grand')
		expect(beaucoup.formatChange).toBe(true)
		expect(beaucoup.feuilles).toBe(1000)
		// 1000 feuilles de 1020 × 700 en 300 g : 0,2142 t à 200 000 DA.
		expect(beaucoup.cout).toBeCloseTo(42840, 0)
		expect(beaucoup.coutPour1000).toBeCloseTo(3060, 0)
		expect(beaucoup.ecartSuivant).toBeGreaterThan(0)
		expect(materialCost(grand, 14000, 300, 0)).toBeNull()
	})
})

describe('gabarit à partir des cotes', () => {
	it('reprend les cotes de l\'article', () => {
		expect(cotesOf('120x40x160')).toEqual(['120', '40', '160'])
		expect(cotesOf('56,3×280')).toEqual(['56.3', '280', ''])
		expect(cotesOf(null)).toEqual(['', '', ''])
	})
	it('reconnaît un gabarit et le dessine Y retourné', () => {
		expect(isGabarit('/private/files/gabarit-A20-120x40x160.pdf')).toBe(true)
		expect(isGabarit('/private/files/trace.pdf')).toBe(false)
		const paths = gabaritPaths({ coupe: [[[0, 0], [10, 0]]], rainage: [[[0, 5], [10, 5]]], developpe_l: 10, developpe_d: 5, epaisseur: 0.4 }, 0)
		expect(paths.coupe).toBe('M0.00 5.00L10.00 5.00')
		expect(paths.rainage).toBe('M0.00 0.00L10.00 0.00')
	})
})

describe('fibre par format', () => {
	it('donne la rotation de chaque feuille, comme le moteur', () => {
		expect(fibreRotation('Verticale', 'En déplacement')).toBe('pose à 0°')
		expect(fibreRotation('Verticale', 'En laize')).toBe('pose à 90°')
		expect(fibreRotation('Horizontale', 'En déplacement')).toBe('pose à 90°')
		expect(fibreRotation('Libre', 'En laize')).toBe('')
		expect(fibreRotation('Verticale', '')).toBe('')
	})
	it('une bobine a sa fibre en déplacement', () => {
		expect(formatFibre({ fibre: '', bobine: 1 })).toBe('En déplacement')
		expect(formatFibre({ fibre: 'En laize', bobine: 1 })).toBe('En laize')
		expect(formatFibre({ fibre: '', bobine: 0 })).toBe('')
		expect(fibreSummary('Verticale')).toBe('fibre verticale sur le tracé')
		expect(fibreSummary(undefined)).toBe('fibre libre')
	})
})
