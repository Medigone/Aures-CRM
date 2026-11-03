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
