// Pas de chargement à la demande : toutes les pages doivent être en cache pour le hors-ligne.
import { createRouter, createWebHistory } from 'vue-router'
import TodayPage from './pages/TodayPage.vue'
import WeekPage from './pages/WeekPage.vue'
import ClientsPage from './pages/ClientsPage.vue'
import ClientPage from './pages/ClientPage.vue'
import NewProspectPage from './pages/NewProspectPage.vue'
import NewArticlePage from './pages/NewArticlePage.vue'
import EditArticlePage from './pages/EditArticlePage.vue'
import ArticlePage from './pages/ArticlePage.vue'
import VisitPage from './pages/VisitPage.vue'
import NewVisitPage from './pages/NewVisitPage.vue'
import RdvPage from './pages/RdvPage.vue'
import AppelPage from './pages/AppelPage.vue'
import SyncPage from './pages/SyncPage.vue'
import ObjectifsPage from './pages/ObjectifsPage.vue'
import SuiviPage from './pages/SuiviPage.vue'
import TicketPage from './pages/TicketPage.vue'
import NewTicketPage from './pages/NewTicketPage.vue'
import DevisPage from './pages/DevisPage.vue'
import CommandePage from './pages/CommandePage.vue'
import ReclamationPage from './pages/ReclamationPage.vue'
import SettingsPage from './pages/SettingsPage.vue'

export const routes = [
	{ path: '/', name: 'Today', component: TodayPage },
	{ path: '/semaine', name: 'Week', component: WeekPage },
	{ path: '/clients', name: 'Clients', component: ClientsPage },
	{ path: '/clients/nouveau', name: 'NewProspect', component: NewProspectPage },
	{ path: '/clients/:id', name: 'Client', component: ClientPage, props: true },
	{ path: '/articles/nouveau', name: 'NewArticle', component: NewArticlePage },
	{ path: '/articles/:id', name: 'Article', component: ArticlePage, props: true },
	{ path: '/articles/:id/modifier', name: 'EditArticle', component: EditArticlePage, props: true },
	{ path: '/visites/nouvelle', name: 'NewVisit', component: NewVisitPage },
	{ path: '/visites/:id', name: 'Visit', component: VisitPage, props: true },
	{ path: '/rdv/nouveau', name: 'NewRdv', component: RdvPage },
	{ path: '/rdv/:id', name: 'Rdv', component: RdvPage, props: true },
	{ path: '/appels/nouveau', name: 'NewAppel', component: AppelPage },
	{ path: '/appels/:id', name: 'Appel', component: AppelPage, props: true },
	{ path: '/suivi', name: 'Suivi', component: SuiviPage },
	{ path: '/tickets/nouveau', name: 'NewTicket', component: NewTicketPage },
	{ path: '/tickets/:id', name: 'Ticket', component: TicketPage, props: true },
	{ path: '/devis/:id', name: 'Devis', component: DevisPage, props: true },
	{ path: '/commandes/:id', name: 'Commande', component: CommandePage, props: true },
	{ path: '/reclamations/:id', name: 'Reclamation', component: ReclamationPage, props: true },
	{ path: '/objectifs', name: 'Objectifs', component: ObjectifsPage },
	{ path: '/synchronisation', name: 'Sync', component: SyncPage },
	{ path: '/parametres', name: 'Settings', component: SettingsPage },
	{ path: '/:pathMatch(.*)*', redirect: { name: 'Today' } },
]

const router = createRouter({
	history: createWebHistory('/commercial'),
	routes,
	scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

export default router
