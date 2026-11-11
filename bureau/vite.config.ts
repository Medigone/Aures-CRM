import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Poste de bureau : servi sous /bureau (aurescrm/www/bureau.py), sans service worker ni hors-ligne.
export default defineConfig(async () => {
	const frappeui = (await import('frappe-ui/vite')).default
	return {
		plugins: [
			frappeui({
				frappeProxy: true,
				lucideIcons: true,
				jinjaBootData: true,
				buildConfig: {
					outDir: '../aurescrm/public/bureau',
					baseUrl: '/assets/aurescrm/bureau/',
					indexHtmlPath: '../aurescrm/www/bureau.html',
					emptyOutDir: true,
					// Pas de sourcemaps servies publiquement sous /assets.
					sourcemap: false,
				},
			}),
			vue(),
		],
		resolve: {
			alias: { '@': path.resolve(__dirname, 'src'), '@shared': path.resolve(__dirname, '../shared') },
			// Le socle partagé (../shared) n'a pas ses propres node_modules : ses imports se résolvent
			// depuis le node_modules de l'app, sinon Node remonte jusqu'à frappe-bench/node_modules (absent sur Frappe Cloud).
			dedupe: ['vue', 'socket.io-client'],
		},
		server: { host: '0.0.0.0', port: 8084 },
		build: {
			outDir: '../aurescrm/public/bureau',
			emptyOutDir: true,
			target: 'es2017',
		},
		test: { environment: 'happy-dom' },
	}
})
