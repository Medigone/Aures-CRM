import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { registerServiceWorker } from './lib/sw'
import { initPush } from './lib/push'
import router from './router'
import './index.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

if (import.meta.env.PROD) {
	registerServiceWorker()
	initPush(router)
}
