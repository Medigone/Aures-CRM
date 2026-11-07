import { describe, expect, it } from 'vitest'
import { batConfirmationText, cotationsOriginText, dimensionsLabel, impositionFormValues, machineStatusLabel, percentLabel, piecesBanner, sameCotations, type CotationsOrigin, type EtudePieces } from './etudePieces'

const origin = (values: Partial<CotationsOrigin> = {}): CotationsOrigin => ({ bat: '72x46.5x107', bat_par: 'Lina', bat_le: '2026-11-03 10:00:00', etat: 'bat', trace: null, trace_par: null, trace_le: null, ...values })
const offset = (values: Partial<EtudePieces> = {}) => ({ travail: true, ouverte: true, manque: [], trace: { name: 'T', linked: true, can_edit: true, can_create: true }, imposition: { can_edit: true, can_create: true, atelier: true, nombre: 0, courante: null }, ...values }) as EtudePieces

describe('pièces de l\'étude', () => {
	it('écrit les dimensions pour la lecture', () => {
		expect(dimensionsLabel('72x46.5x107')).toBe('72 × 46,5 × 107')
		expect(dimensionsLabel(null)).toBe('')
		expect(percentLabel(22.8)).toBe('22,8 %')
		expect(percentLabel(null)).toBe('—')
		expect(machineStatusLabel('Operationnelle')).toBe('Opérationnelle')
	})
	it('compare les cotations comme le serveur', () => {
		expect(sameCotations('72 × 46,5 × 107 mm', '72x46.5x107')).toBe(true)
		expect(sameCotations('72x46x107', '72x46.5x107')).toBe(false)
	})
	it("raconte l'origine des cotations", () => {
		expect(cotationsOriginText(null)).toBe('')
		expect(cotationsOriginText(origin())).toBe('Importées du BAT (72 × 46,5 × 107) par Lina le 03/11/2026.')
		expect(cotationsOriginText(origin({ etat: 'fiche' }))).toContain('modifiées depuis sur la fiche')
		expect(cotationsOriginText(origin({ etat: 'trace', trace: 'TRA-1', trace_par: 'Sam', trace_le: '2026-11-07 09:00:00' }))).toBe('Importées du BAT (72 × 46,5 × 107) par Lina le 03/11/2026, puis modifiées par Sam le 07/11/2026 depuis le tracé TRA-1.')
	})
	it('annonce ce que le tracé remplace', () => {
		expect(batConfirmationText({ actuelles: '72x46.5x107', nouvelles: '80x40x100', par: 'Lina', le: '2026-11-03' })).toBe('Les cotations 72 × 46,5 × 107 de cet article viennent du BAT importé par Lina le 03/11/2026. Ce tracé les remplace par 80 × 40 × 100.')
	})
	it('bandeau : ce qui manque, pour qui renseigne comme pour qui conclut', () => {
		expect(piecesBanner({ status: 'En étude', actions: [] }, offset({ manque: ['Tracé', 'Imposition'] }))?.text).toBe('Pour passer à Réalisable, il manque : tracé, imposition.')
		expect(piecesBanner({ status: 'En étude', actions: [] }, offset())?.text).toContain('responsable')
		expect(piecesBanner({ status: 'En étude', actions: ['Réalisable'] }, offset())).toBeNull()
		expect(piecesBanner({ status: 'Réalisable', actions: [] }, offset({ manque: ['Tracé'] }))).toBeNull()
	})
	it('bandeau Flexo : ce qui manque sans être exigé', () => {
		const flexo = (name: string | null) => ({ name, linked: Boolean(name), can_edit: true, can_create: true })
		const pieces = { travail: true, ouverte: true, manque: [], trace: flexo('T'), plan_flexo: flexo('P'), maquette: flexo(null), cliche: flexo(null) } as EtudePieces
		expect(piecesBanner({ status: 'En étude', actions: ['Réalisable'] }, pieces)?.text).toContain('maquette activée, cliché')
		expect(piecesBanner({ status: 'En étude', actions: ['Réalisable'] }, { ...pieces, maquette: flexo('M'), cliche: flexo('C') })).toBeNull()
	})
	it("prépare la fenêtre d'imposition", () => {
		expect(impositionFormValues(null)).toEqual({ laize_pal: 'Laize', format_laize_palette: '', format_imp: '', nbr_poses: '', taux_chutes: '' })
		expect(impositionFormValues({ format: '1020 × 600', nbr_poses: 12, taux_chutes: 22.8, laize_pal: '', format_laize_palette: null })).toEqual({ laize_pal: 'Laize', format_laize_palette: '1020', format_imp: '1020x600', nbr_poses: '12', taux_chutes: '22,8' })
	})
})
