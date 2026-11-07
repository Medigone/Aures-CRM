import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import AccueilPage from './pages/AccueilPage.vue'
import ArticlesPage from './pages/ArticlesPage.vue'
import BureauPage from './pages/BureauPage.vue'
import ClientsPage from './pages/ClientsPage.vue'
import DemandesPage from './pages/DemandesPage.vue'
import EtudesPage from './pages/EtudesPage.vue'
import LoginPage from './pages/LoginPage.vue'

export const routes = [
	// Seule page servie sans session : hors de la coquille.
	{ path: '/connexion', name: 'Login', component: LoginPage },
	{
		path: '/',
		name: 'Home',
		component: AccueilPage,
		// La liste des tickets était à la racine : un ancien lien garde sa vue et son aperçu.
		beforeEnter: (to: RouteLocationNormalized) => (to.query.vue || to.query.apercu || to.query.page ? { name: 'Tickets', query: to.query } : true),
	},
	{ path: '/tickets', name: 'Tickets', component: BureauPage, meta: { doctype: 'Ticket Commercial' } },
	{ path: '/ticket/:id', name: 'Ticket', component: BureauPage, props: true, meta: { doctype: 'Ticket Commercial' } },
	{ path: '/demandes', name: 'Demandes', component: DemandesPage, meta: { doctype: 'Demande Faisabilite' } },
	{ path: '/demandes/:id', name: 'Demande', component: DemandesPage, props: true, meta: { doctype: 'Demande Faisabilite' } },
	{ path: '/etudes', name: 'Etudes', component: EtudesPage, meta: { doctype: ['Etude Faisabilite', 'Etude Faisabilite Flexo'] } },
	{ path: '/etudes/:id', name: 'Etude', component: EtudesPage, props: true, meta: { doctype: ['Etude Faisabilite', 'Etude Faisabilite Flexo'] } },
	{ path: '/clients', name: 'Clients', component: ClientsPage, meta: { doctype: 'Customer' } },
	{ path: '/clients/:id', name: 'Client', component: ClientsPage, props: true, meta: { doctype: 'Customer' } },
	{ path: '/articles', name: 'Articles', component: ArticlesPage, meta: { doctype: 'Item' } },
	{ path: '/articles/:id', name: 'Article', component: ArticlesPage, props: true, meta: { doctype: 'Item' } },
	{ path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory('/bureau'), routes })

router.beforeEach((to) => {
	if (to.name === 'Login' && window.user) return { name: 'Home' }
})

export default router
