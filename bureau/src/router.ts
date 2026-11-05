import { createRouter, createWebHistory } from 'vue-router'
import BureauPage from './pages/BureauPage.vue'
import ClientsPage from './pages/ClientsPage.vue'
import LoginPage from './pages/LoginPage.vue'

export const routes = [
	// Seule page servie sans session : hors de la coquille.
	{ path: '/connexion', name: 'Login', component: LoginPage },
	{ path: '/', name: 'Home', component: BureauPage },
	{ path: '/ticket/:id', name: 'Ticket', component: BureauPage, props: true },
	{ path: '/clients', name: 'Clients', component: ClientsPage },
	{ path: '/clients/:id', name: 'Client', component: ClientsPage, props: true },
	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory('/bureau'), routes })

router.beforeEach((to) => {
	if (to.name === 'Login' && window.user) return { name: 'Home' }
})

export default router
