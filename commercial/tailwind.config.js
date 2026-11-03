import frappeUIPreset from 'frappe-ui/tailwind'

export default {
	presets: [frappeUIPreset],
	content: ['./index.html', './src/**/*.{vue,js,ts}'],
	theme: {
		extend: {
			// Lecture au téléphone : tailles un cran au-dessus de frappe-ui.
			fontSize: {
				xs: ['12px', { lineHeight: '1.35', letterSpacing: '0', fontWeight: '400' }],
				sm: ['14px', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '400' }],
				base: ['15px', { lineHeight: '1.45', letterSpacing: '0', fontWeight: '400' }],
				lg: ['17px', { lineHeight: '1.35', letterSpacing: '-0.005em', fontWeight: '400' }],
				xl: ['20px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '400' }],
			},
			colors: {
				primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
				'on-primary': 'rgb(var(--on-primary-rgb) / <alpha-value>)',
				accent: {
					DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
					fond: 'rgb(var(--accent-rgb) / 0.1)',
					fonce: 'rgb(var(--accent-fonce-rgb) / <alpha-value>)',
				},
			},
		},
	},
	plugins: [],
}
