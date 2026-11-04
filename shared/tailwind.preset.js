// Réglages Tailwind communs aux applications Aures (à ajouter après le preset de frappe-ui).
// Les tailles suivent la densité de l'application : voir shared/tokens.css.
export default {
	theme: {
		extend: {
			fontSize: {
				xs: ['var(--text-xs)', { lineHeight: '1.35', letterSpacing: '0', fontWeight: '400' }],
				sm: ['var(--text-sm)', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '400' }],
				base: ['var(--text-base)', { lineHeight: 'var(--leading-base)', letterSpacing: '0', fontWeight: '400' }],
				lg: ['var(--text-lg)', { lineHeight: '1.35', letterSpacing: '-0.005em', fontWeight: '400' }],
				xl: ['var(--text-xl)', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '400' }],
			},
			colors: {
				primary: 'rgb(var(--primary-rgb) / <alpha-value>)',
				'on-primary': 'rgb(var(--on-primary-rgb) / <alpha-value>)',
				accent: {
					DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
					fond: 'rgb(var(--accent-rgb) / 0.1)',
					fonce: 'rgb(var(--accent-fonce-rgb) / <alpha-value>)',
				},
				page: 'var(--page)',
				'control-border': 'var(--control-border)',
				selection: {
					DEFAULT: 'var(--selection)',
					checked: 'var(--selection-checked)',
					border: 'var(--selection-border)',
					ink: 'var(--selection-ink)',
				},
				// `text-tone-red` pour l'encre seule, `bg-tone-amber-bg` pour le fond seul ; la classe `tone-red` pose les deux.
				tone: {
					blue: 'var(--tone-blue-ink)',
					amber: 'var(--tone-amber-ink)',
					green: 'var(--tone-green-ink)',
					red: 'var(--tone-red-ink)',
					gray: 'var(--tone-gray-ink)',
					violet: 'var(--tone-violet-ink)',
					'amber-bg': 'var(--tone-amber-bg)',
				},
			},
			borderRadius: {
				control: 'var(--radius-control)',
				field: 'var(--radius-field)',
				card: 'var(--radius-card)',
				pill: 'var(--radius-pill)',
			},
			boxShadow: {
				overlay: 'var(--shadow-overlay)',
				drawer: 'var(--shadow-drawer)',
			},
		},
	},
}
