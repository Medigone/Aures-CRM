import frappeUIPreset from 'frappe-ui/tailwind'
import auresPreset from '../shared/tailwind.preset.js'

export default {
	presets: [frappeUIPreset, auresPreset],
	content: ['./index.html', './src/**/*.{vue,js,ts}', '../shared/**/*.{vue,ts}'],
	// Noms composés à l'exécution (`urgence-${niveau}`) : invisibles pour l'analyse du code, ils seraient retirés du build.
	safelist: ['piece-mark-ok', 'piece-mark-wait', 'piece-mark-missing', 'piece-mark-skip', 'urgence-U0', 'urgence-U1', 'urgence-U2', 'urgence-U3'],
	plugins: [],
}
