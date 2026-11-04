import frappeUIPreset from 'frappe-ui/tailwind'
import auresPreset from '../shared/tailwind.preset.js'

export default {
	presets: [frappeUIPreset, auresPreset],
	content: ['./index.html', './src/**/*.{vue,js,ts}', '../shared/**/*.{vue,ts}'],
	plugins: [],
}
