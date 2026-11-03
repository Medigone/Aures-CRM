// Pas de chargement à la demande : toutes les pages doivent être en cache pour le hors-ligne.
import { createRouter, createWebHistory } from 'vue-router'
import TodayPage from './pages/TodayPage.vue'
import ClientsPage from './pages/ClientsPage.vue'
import ClientPage from './pages/ClientPage.vue'
import ArticlePage from './pages/ArticlePage.vue'
import SettingsPage from './pages/SettingsPage.vue'

export const routes = [
	{ path: '/', name: 'Today', component: TodayPage },
	{ path: '/clients', name: 'Clients', component: ClientsPage },
	{ path: '/clients/:id', name: 'Client', component: ClientPage, props: true },
	{ path: '/articles/:id', name: 'Article', component: ArticlePage, props: true },
	{ path: '/parametres', name: 'Settings', component: SettingsPage },
	{ path: '/:pathMatch(.*)*', redirect: { name: 'Today' } },
]

const router = createRouter({
	history: createWebHistory('/commercial'),
	routes,
	scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

export default router
