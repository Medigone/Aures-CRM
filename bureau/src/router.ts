import { createRouter, createWebHistory } from 'vue-router'
import BureauPage from './pages/BureauPage.vue'

export const routes = [
	{ path: '/', name: 'Home', component: BureauPage },
	{ path: '/ticket/:id', name: 'Ticket', component: BureauPage, props: true },
	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

export default createRouter({ history: createWebHistory('/bureau'), routes })
