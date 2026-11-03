import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// PWA commerciale : servie sous /commercial ; son service worker (public/sw.js) est
// renvoyé par Frappe sous /commercial/sw.js pour contrôler les pages /commercial
// (aurescrm/www/commercial_page.py).
export default defineConfig(async () => {
	const frappeui = (await import('frappe-ui/vite')).default
	return {
		plugins: [
			frappeui({
				frappeProxy: true,
				lucideIcons: true,
				jinjaBootData: true,
				buildConfig: {
					outDir: '../aurescrm/public/commercial',
					baseUrl: '/assets/aurescrm/commercial/',
					indexHtmlPath: '../aurescrm/www/commercial.html',
					emptyOutDir: true,
					// Pas de sourcemaps servies publiquement sous /assets.
					sourcemap: false,
				},
			}),
			vue(),
		],
		resolve: {
			alias: { '@': path.resolve(__dirname, 'src') },
		},
		server: { host: '0.0.0.0', port: 8083 },
		build: {
			outDir: '../aurescrm/public/commercial',
			emptyOutDir: true,
			target: 'es2017',
		},
		test: { environment: 'happy-dom' },
	}
})
