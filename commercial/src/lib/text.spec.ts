import { describe, expect, it } from 'vitest'
import { fileUrl, stripHtml, todayIso } from './text'

describe('stripHtml', () => {
	it('garde le texte des notes du Desk', () => {
		expect(stripHtml('<div><p>Client absent,&nbsp;<b>repasser</b></p><p>mardi</p></div>')).toBe('Client absent, repasser mardi')
		expect(stripHtml(null)).toBe('')
	})
})

describe('todayIso', () => {
	it('formate la date locale', () => {
		expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
	})
})

describe('fileUrl', () => {
	it('normalise les chemins de fichiers', () => {
		expect(fileUrl('/private/files/a.pdf')).toBe('/private/files/a.pdf')
		expect(fileUrl('files/a.pdf')).toBe('/files/a.pdf')
		expect(fileUrl('https://cloud.example/a.pdf')).toBe('https://cloud.example/a.pdf')
		expect(fileUrl(null)).toBeNull()
	})
})

describe('dates de formulaire', () => {
	it('convertit entre serveur et champ datetime-local', async () => {
		const { fromInputDateTime, toInputDateTime, inputDateTimeIn } = await import('./text')
		expect(toInputDateTime('2026-11-03 10:30:00')).toBe('2026-11-03T10:30')
		expect(fromInputDateTime('2026-11-03T10:30')).toBe('2026-11-03 10:30:00')
		expect(fromInputDateTime('')).toBeNull()
		expect(inputDateTimeIn(0, new Date(2026, 10, 3, 9, 7))).toBe('2026-11-03T09:15')
	})
	it('formate une position GPS', async () => {
		const { gpsText } = await import('./text')
		expect(gpsText({ latitude: 36.75, longitude: 3.05 })).toBe('36.750000, 3.050000')
		expect(gpsText(null)).toBeNull()
	})
})

describe('htmlToText', () => {
	it('garde les retours à la ligne', async () => {
		const { htmlToText } = await import('./text')
		expect(htmlToText('<p>Article : Opercule<br>Teinte claire</p><p>Lot 4411</p>')).toBe('Article : Opercule\nTeinte claire\nLot 4411')
	})
})
