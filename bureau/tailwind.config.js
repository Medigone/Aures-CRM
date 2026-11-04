import frappeUIPreset from 'frappe-ui/tailwind'
import auresPreset from '../shared/tailwind.preset.js'

export default {
	presets: [frappeUIPreset, auresPreset],
	content: ['./index.html', './src/**/*.{vue,js,ts}', '../shared/**/*.{vue,ts}'],
	// Noms composés à l'exécution (`urgence-${niveau}`) : invisibles pour l'analyse du code, ils seraient retirés du build.
	safelist: ['urgence-U0', 'urgence-U1', 'urgence-U2', 'urgence-U3'],
	theme: {
		extend: {
			// Poste de bureau, à la souris : plus dense que la PWA, qui garde les tailles du preset commun.
			fontSize: {
				xs: ['11px', { lineHeight: '1.35' }],
				sm: ['12px', { lineHeight: '1.4' }],
				base: ['13px', { lineHeight: '1.4' }],
				lg: ['14px', { lineHeight: '1.35' }],
				xl: ['15px', { lineHeight: '1.3' }],
			},
		},
	},
	plugins: [],
}
