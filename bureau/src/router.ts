import { createRouter, createWebHistory } from 'vue-router'
import BureauPage from './pages/BureauPage.vue'
import ClientsPage from './pages/ClientsPage.vue'

export const routes = [
	{ path: '/', name: 'Home', component: BureauPage },
	{ path: '/ticket/:id', name: 'Ticket', component: BureauPage, props: true },
	{ path: '/clients', name: 'Clients', component: ClientsPage },
	{ path: '/clients/:id', name: 'Client', component: ClientsPage, props: true },
	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({ history: createWebHistory('/bureau'), routes })
