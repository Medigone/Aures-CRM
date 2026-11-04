import { describe, expect, it } from 'vitest'

// Fichiers lus tels quels : une couleur écrite en dur casse le thème sombre sans que rien ne le signale.
const SOURCES = import.meta.glob(['../**/*.{css,vue}', '../../../shared/*.css', '../../../shared/components/*.vue'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const TOKENS = import.meta.glob('../../../shared/tokens.css', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const tokens = Object.values(TOKENS)[0]

function colorNames(block: string) {
	return [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,8}|\d+ \d+ \d+)/gi)].map((match) => match[1]).sort()
}

describe('jetons de couleur', () => {
	it("n'écrit aucune couleur en dur en dehors de shared/tokens.css", () => {
		const offenders = Object.entries(SOURCES)
			.filter(([path]) => !path.endsWith('tokens.css'))
			.flatMap(([path, text]) => (text.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b(?!-)|rgba?\(\s*\d/gi) ?? []).map((color) => `${path} : ${color}`))
		expect(offenders).toEqual([])
	})

	it('donne une valeur sombre à chaque couleur claire', () => {
		const lightStart = tokens.indexOf(':root {')
		const darkStart = tokens.indexOf(":root[data-theme='dark']")
		const densityStart = tokens.indexOf('/* Densité Terrain')
		expect(colorNames(tokens.slice(darkStart, densityStart))).toEqual(colorNames(tokens.slice(lightStart, darkStart)))
	})
})
