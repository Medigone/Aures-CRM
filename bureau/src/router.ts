import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router'
import ArticlesPage from './pages/ArticlesPage.vue'
import BureauPage from './pages/BureauPage.vue'
import ClientsPage from './pages/ClientsPage.vue'
import DemandesPage from './pages/DemandesPage.vue'
import CommandesPage from './pages/CommandesPage.vue'
import DevisPage from './pages/DevisPage.vue'
import AtelierPage from './pages/AtelierPage.vue'
import EtudesPage from './pages/EtudesPage.vue'
import HomePage from './pages/HomePage.vue'
import ImpositionsPage from './pages/ImpositionsPage.vue'
import LoginPage from './pages/LoginPage.vue'
import TracesPage from './pages/TracesPage.vue'

export const routes = [
	// Seule page servie sans session : hors de la coquille.
	{ path: '/connexion', name: 'Login', component: LoginPage },
	{
		path: '/',
		name: 'Home',
		component: HomePage,
		// La liste des tickets était à la racine : un ancien lien garde sa vue et son aperçu.
		beforeEnter: (to: RouteLocationNormalized) => (to.query.vue || to.query.apercu || to.query.page ? { name: 'Tickets', query: to.query } : true),
	},
	{ path: '/tickets', name: 'Tickets', component: BureauPage, meta: { doctype: 'Ticket Commercial' } },
	{ path: '/ticket/:id', name: 'Ticket', component: BureauPage, props: true, meta: { doctype: 'Ticket Commercial' } },
	{ path: '/demandes', name: 'Demandes', component: DemandesPage, meta: { doctype: 'Demande Faisabilite' } },
	{ path: '/demandes/:id', name: 'Demande', component: DemandesPage, props: true, meta: { doctype: 'Demande Faisabilite' } },
	{ path: '/devis', name: 'Devis', component: DevisPage, meta: { doctype: 'Quotation' } },
	{ path: '/devis/:id', name: 'DevisFiche', component: DevisPage, props: true, meta: { doctype: 'Quotation' } },
	{ path: '/commandes', name: 'Commandes', component: CommandesPage, meta: { doctype: 'Sales Order' } },
	{ path: '/etudes', name: 'Etudes', component: EtudesPage, meta: { doctype: ['Etude Faisabilite', 'Etude Faisabilite Flexo'] } },
	{ path: '/etudes/:id', name: 'Etude', component: EtudesPage, props: true, meta: { doctype: ['Etude Faisabilite', 'Etude Faisabilite Flexo'] } },
	{ path: '/etudes/:id/atelier', name: 'EtudeAtelier', component: AtelierPage, props: true, meta: { doctype: 'Calcul Imposition' } },
	{ path: '/atelier', name: 'Atelier', component: AtelierPage, meta: { doctype: 'Calcul Imposition' } },
	{ path: '/atelier/:calcul', name: 'AtelierTest', component: AtelierPage, props: true, meta: { doctype: 'Calcul Imposition' } },
	{ path: '/traces', name: 'Traces', component: TracesPage, meta: { doctype: 'Trace' } },
	{ path: '/traces/:id', name: 'Trace', component: TracesPage, props: true, meta: { doctype: 'Trace' } },
	{ path: '/impositions', name: 'Impositions', component: ImpositionsPage, meta: { doctype: 'Imposition' } },
	{ path: '/impositions/:id', name: 'Imposition', component: ImpositionsPage, props: true, meta: { doctype: 'Imposition' } },
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
