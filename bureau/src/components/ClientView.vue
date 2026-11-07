<script setup lang="ts">
import LucideCalendar from '~icons/lucide/calendar'
import LucideHistory from '~icons/lucide/history'
import LucideMapPin from '~icons/lucide/map-pin'
import LucideSmile from '~icons/lucide/smile'
import LucideStar from '~icons/lucide/star'
import LucideTag from '~icons/lucide/tag'
import LucideUser from '~icons/lucide/user'
import RecordHeader from './RecordHeader.vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideMail from '~icons/lucide/mail'
import LucideMap from '~icons/lucide/map'
import LucidePhone from '~icons/lucide/phone'
import LucideX from '~icons/lucide/x'
import type { UploadedFile } from '@shared/api'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import FileUploader from '@shared/components/FileUploader.vue'
import ListState from '@shared/components/ListState.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import ArticleDialog from './ArticleDialog.vue'
import ClientDialog from './ClientDialog.vue'
import ClientTicketsTable from './ClientTicketsTable.vue'
import NewTicketDialog from './NewTicketDialog.vue'
import TagEditor from './TagEditor.vue'
import { clientActivity, setClientPiece } from '@/lib/api'
import { formatAmount, type ClientDetail } from '@/lib/clients'
import { deskUrl, formatDay } from '@/lib/display'
import { useClient } from '@/lib/useClient'
import type { ClientChoice } from '@/types'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ tab: [tab: string]; changed: [] }>()

const { client, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh } = useClient(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const activityApi = computed(() => clientActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, client })

const openTickets = computed(() => (client.value?.tickets ?? []).filter((ticket) => ticket.is_open))
const blocked = computed(() => openTickets.value.filter((ticket) => ticket.status === 'Blocage Créance'))
const tabs = computed(() => {
	const current = client.value
	if (!current) return []
	const affaires = openTickets.value.length + current.devis.length + current.commandes.length + (current.creance ? 1 : 0)
	const list: { key: string; label: string; count?: number }[] = [
		{ key: 'apercu', label: 'Aperçu' },
		{ key: 'affaires', label: 'Affaires', count: affaires },
		{ key: 'articles', label: 'Articles', count: current.articles.length },
		{ key: 'relation', label: 'Visites et appels', count: current.relation.length },
		{ key: 'infos', label: 'Informations' },
	]
	return list
})
const activeTab = computed(() => (tabs.value.some((tab) => tab.key === props.tab) ? props.tab! : 'apercu'))
// Depuis l'aperçu, « Voir le fil » amène au fil ; sans commentaire, le curseur est déjà prêt pour écrire.
watch(feed, (current) => {
	if (!current || props.tab !== 'activite') return
	current.root?.scrollIntoView?.({ block: 'nearest' })
	if (!client.value?.comments.count) current.focusInput()
})

interface Vente {
	piece: string
	name: string
	doctype: string
	date: string
	status: string
	total: number
}
function ventes(current: ClientDetail): Vente[] {
	return [
		...current.devis.map((row) => ({ piece: 'Devis', name: row.name, doctype: 'Quotation', date: row.transaction_date, status: row.custom_statut_commande || row.status, total: row.grand_total })),
		...current.commandes.map((row) => ({ piece: 'Commande', name: row.name, doctype: 'Sales Order', date: row.transaction_date, status: row.status, total: row.grand_total })),
	]
}
const lastVentes = computed(() => (client.value ? ventes(client.value).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : []))
const today = new Date().toISOString().slice(0, 10)
// Le prochain échange : le plus proche à venir qui n'est pas clos. La liste va du plus récent au plus ancien.
const CLOSED_ECHANGES = ['Terminé', 'Terminée', 'Annulé', 'Annulée', 'Non Honoré', 'Non Honorée']
const nextEchange = computed(() => (client.value?.relation ?? []).filter((item) => item.date && item.date.slice(0, 10) >= today && !CLOSED_ECHANGES.includes(item.status ?? '')).pop())
const lastEchange = computed(() => (client.value?.relation ?? []).find((item) => item.date && item.date.slice(0, 10) <= today && CLOSED_ECHANGES.includes(item.status ?? '')))

const relationFilter = ref('all')
const RELATION_FILTERS = [
	{ key: 'all', label: 'Tout' },
	{ key: 'Visite', label: 'Visites' },
	{ key: 'Rendez-vous', label: 'Rendez-vous' },
	{ key: 'Appel', label: 'Appels' },
]
const shownRelation = computed(() => (client.value?.relation ?? []).filter((item) => relationFilter.value === 'all' || item.kind === relationFilter.value))
const missingPieces = computed(() => (client.value?.pieces ?? []).filter((piece) => !piece.fichier).length)
const flags = computed(() => {
	const current = client.value
	if (!current) return []
	return [current.grand_compte && 'Grand compte', current.prioritaire && 'Client prioritaire', current.petites_quantites && 'Petites quantités'].filter(Boolean) as string[]
})
function note(value: number | null) {
	return value === null ? '' : `${String(value).replace('.', ',')} sur 5`
}
const SENSIBILITES = [
	{ key: 'prix', label: 'Sensibilité prix', short: 'Prix' },
	{ key: 'delais', label: 'Sensibilité délais', short: 'Délais' },
	{ key: 'qualite', label: 'Sensibilité qualité', short: 'Qualité' },
	{ key: 'process', label: 'Sensibilité process', short: 'Process' },
] as const
function onTags(tags: string[]) {
	if (client.value) client.value.tags = tags
	emit('changed')
}
function newOnDesk(doctype: string, field: string) {
	return `${deskUrl(doctype, 'new')}?${field}=${encodeURIComponent(props.id)}`
}

async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}

// Fenêtres.
const editing = ref(false)
function onSaved(updated: ClientDetail) {
	client.value = updated
	notice.value = 'Client enregistré.'
	emit('changed')
}
const newTicket = ref(false)
const createdTicket = ref<string | null>(null)
const router = useRouter()
const ticketClient = computed<ClientChoice | undefined>(() => {
	const current = client.value
	return current ? { name: current.name, label: current.client, wilaya: current.wilaya, commercial: current.commercial_user, commercial_name: current.commercial, open_tickets: openTickets.value.length } : undefined
})
const newArticle = ref(false)
function onArticleCreated(name: string) {
	router.push({ name: 'Article', params: { id: name } })
}
function onTicketCreated(result: { name: string; failedFiles: number }) {
	createdTicket.value = result.name
	load()
	emit('changed')
}

// La pièce choisie : le fichier part avec son avancement, puis se range dans son champ.
const pieceUploader = ref<InstanceType<typeof FileUploader> | null>(null)
let pendingPiece = ''
function joinPiece(piece: string) {
	pendingPiece = piece
	pieceUploader.value?.pick()
}
function onPieceUploaded(file: UploadedFile) {
	const current = client.value
	if (current && pendingPiece) perform(() => setClientPiece(current, pendingPiece, file.file_url))
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Ce client n'existe pas ou n'existe plus.</div>
		<div v-else-if="!client" class="card p-8 text-center text-ink-gray-6">Chargement du client…</div>

		<template v-else>
			<RecordHeader>
				<template #title>{{ client.client }}</template>
				<template #flags>
					<StatusPill :status="client.status" />
					<span v-if="client.grand_compte" class="record-flag">Grand compte</span>
				</template>
				<template #sub>
					<span v-if="client.forme_juridique">{{ client.forme_juridique }}</span>
					<span class="tabular-nums">{{ client.name }}</span>
					<span v-if="client.commune_label || client.wilaya">{{ [client.commune_label, client.wilaya].filter(Boolean).join(', ') }}</span>
					<div v-if="client.tags?.length || client.can_edit"><TagEditor doctype="Customer" :name="client.name" :modified="client.modified" :tags="client.tags" :can-edit="client.can_edit" @changed="onTags" /></div>
				</template>
				<template #actions>
					<button type="button" class="btn-primary" @click="newTicket = true">Nouveau ticket</button>
						<button v-if="client.can_edit" type="button" class="btn-secondary" :disabled="busy" @click="editing = true">Modifier</button>
						<MoreMenu>
							<a class="app-menu-item" role="menuitem" :href="newOnDesk('Visite Commerciale', 'client')" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Nouvelle visite</a>
							<a class="app-menu-item" role="menuitem" :href="newOnDesk('Rendez Vous Client', 'client')" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Nouveau rendez-vous</a>
							<a class="app-menu-item" role="menuitem" :href="newOnDesk('Appel Telephonique', 'client')" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Nouvel appel</a>
							<div class="app-menu-sep"></div>
							<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
							<a class="app-menu-item" role="menuitem" :href="deskUrl('Customer', client.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
						</MoreMenu>
				</template>
			</RecordHeader>
			<div class="client-dossier">
			<aside class="card client-side" aria-label="Informations du client">
				<div class="side-block">
					<dl class="record-facts">
						<div>
							<dt><LucidePhone aria-hidden="true" />Contact principal</dt>
							<dd v-if="client.contacts[0]">
								{{ client.contacts[0].nom || 'Sans nom' }}<span v-if="client.contacts[0].fonction" class="font-normal text-ink-gray-6"> · {{ client.contacts[0].fonction }}</span>
								<span class="contact-links font-normal">
									<a v-if="client.contacts[0].telephone" class="ref-link tabular-nums" :href="`tel:${client.contacts[0].telephone}`">{{ client.contacts[0].telephone }}</a>
									<a v-if="client.contacts[0].email" class="ref-link" :href="`mailto:${client.contacts[0].email}`"><LucideMail class="h-3.5 w-3.5" aria-hidden="true" />{{ client.contacts[0].email }}</a>
								</span>
							</dd>
							<dd v-else class="record-fact-none">Aucun contact enregistré.</dd>
						</div>
						<div><dt><LucideUser aria-hidden="true" />Commercial</dt><dd>{{ client.commercial || 'Non attribué' }}</dd></div>
						<div><dt><LucideTag aria-hidden="true" />Catégorie</dt><dd>{{ client.categorie || '—' }}</dd></div>
						<div><dt><LucideCalendar aria-hidden="true" />Client depuis</dt><dd class="tabular-nums">{{ formatDay(client.depuis) || '—' }}</dd></div>
						<div><dt><LucideHistory aria-hidden="true" />Dernière visite</dt><dd class="tabular-nums">{{ formatDay(client.visite) || 'Jamais' }}</dd></div>
						<div>
							<dt><LucideMapPin aria-hidden="true" />Adresse</dt>
							<dd class="flex items-center justify-between gap-2">
								<span class="min-w-0">{{ client.adresses[0].texte || [client.commune_label, client.wilaya].filter(Boolean).join(', ') || 'Non renseignée' }}</span>
								<a v-if="client.map_url" class="icon-btn" :href="client.map_url" target="_blank" rel="noopener noreferrer" aria-label="Voir sur la carte" title="Voir sur la carte"><LucideMap class="h-4 w-4" aria-hidden="true" /></a>
							</dd>
						</div>
					</dl>
				</div>
				<div class="side-block">
					<p v-if="flags.length > (client.grand_compte ? 1 : 0)" class="font-medium text-ink-gray-9">{{ flags.filter((flag) => flag !== 'Grand compte').join(' · ') }}</p>
					<dl class="record-facts">
						<div><dt><LucideStar aria-hidden="true" />Qualité client</dt><dd class="tabular-nums" :class="client.qualite === null && 'record-fact-none'">{{ note(client.qualite) || 'Non renseignée' }}</dd></div>
						<div><dt><LucideSmile aria-hidden="true" />Satisfaction</dt><dd class="tabular-nums" :class="client.satisfaction === null && 'record-fact-none'">{{ note(client.satisfaction) || 'Non renseignée' }}</dd></div>
					</dl>
					<p class="side-label mt-1">Sensibilité</p>
					<dl class="side-sens">
						<div v-for="item in SENSIBILITES" :key="item.key"><dt>{{ item.short }}</dt><dd :class="!client.sensibilites[item.key] && 'text-ink-gray-6'">{{ client.sensibilites[item.key] || '—' }}</dd></div>
					</dl>
				</div>
			</aside>
			<div class="client-main">
			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>

			<div class="record-tabs" role="tablist">
				<button v-for="item in tabs" :key="item.key" type="button" class="record-tab" role="tab" :aria-selected="activeTab === item.key" @click="emit('tab', item.key)">
					{{ item.label }}<span v-if="item.count" class="ml-1 tabular-nums text-ink-gray-6">{{ item.count }}</span>
				</button>
			</div>

			<div class="bureau-detail">
				<FileUploader ref="pieceUploader" class="w-full" doctype="Customer" :docname="client.name" :zone="false" :multiple="false" @uploaded="onPieceUploaded" />
				<!-- Aperçu : il résume les autres onglets. -->
				<div v-if="activeTab === 'apercu'" class="bureau-center">
						<div v-if="blocked.length" role="status" class="rounded-control tone-red px-3.5 py-2.5">
							<strong class="font-semibold">{{ blocked.length > 1 ? `${blocked.length} tickets bloqués` : '1 ticket bloqué' }} pour créance :</strong>
							<template v-for="(ticket, index) in blocked" :key="ticket.name">{{ index ? ', ' : ' ' }}<RouterLink class="font-medium underline" :to="{ name: 'Ticket', params: { id: ticket.name } }">{{ ticket.name }}</RouterLink></template>.
							Le déblocage se décide sur le ticket.
						</div>
						<section class="card ref-card">
							<div class="ref-card-head"><h3>Tickets ouverts</h3><button v-if="openTickets.length > 5" type="button" class="ref-link" @click="emit('tab', 'affaires')">Voir les {{ openTickets.length }} tickets</button></div>
							<ClientTicketsTable :tickets="openTickets.slice(0, 5)" empty="Aucun ticket ouvert." />
						</section>
						<div class="client-cards">
						<section v-if="client.creance" class="card ref-card">
							<div class="ref-card-head"><h3>Créance</h3><button type="button" class="ref-link" @click="emit('tab', 'affaires')">Voir les mouvements</button></div>
							<div class="amount-row"><span class="amount tabular-nums">{{ formatAmount(client.creance.solde_restant) }} DA</span><StatusPill :status="client.creance.statut" /></div>
							<dl class="kv"><div><dt>Prochaine relance</dt><dd class="tabular-nums">{{ formatDay(client.creance.date_prochaine_relance) || '—' }}</dd></div><div><dt>Dernier résultat</dt><dd>{{ client.creance.dernier_resultat_recouvrement || '—' }}</dd></div></dl>
						</section>
						<section class="card ref-card">
							<div class="ref-card-head"><h3>Derniers échanges</h3><button type="button" class="ref-link" @click="emit('tab', 'relation')">Tout voir</button></div>
							<p v-if="nextEchange"><span class="font-semibold text-ink-gray-9">À venir, {{ formatDay(nextEchange.date) }} :</span> {{ nextEchange.kind.toLowerCase() }}<template v-if="nextEchange.objet">, {{ nextEchange.objet }}</template>.</p>
							<p v-if="lastEchange"><span class="font-semibold text-ink-gray-9">{{ lastEchange.kind }} du {{ formatDay(lastEchange.date) }} :</span> {{ lastEchange.note || lastEchange.objet || 'Sans compte rendu.' }}</p>
							<p v-if="!nextEchange && !lastEchange" class="text-ink-gray-6">Aucun échange enregistré pour ce client.</p>
						</section>
						</div>
						<section class="card ref-card">
							<div class="ref-card-head"><h3>Derniers devis et commandes</h3><button type="button" class="ref-link" @click="emit('tab', 'affaires')">Tout voir</button></div>
							<p v-if="!lastVentes.length" class="text-ink-gray-6">Aucun devis ni commande.</p>
							<div v-else class="ref-scroll"><table class="ref-table">
								<thead><tr><th>Pièce</th><th>Numéro</th><th>Date</th><th>Statut</th><th class="end">Montant (DA)</th></tr></thead>
								<tbody><tr v-for="row in lastVentes" :key="row.name"><td>{{ row.piece }}</td><td><a class="ref-link" :href="deskUrl(row.doctype, row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.date) }}</td><td><StatusPill :status="row.status" /></td><td class="end tabular-nums">{{ formatAmount(row.total) }}</td></tr></tbody>
							</table></div>
						</section>
				</div>

				<!-- Affaires. -->
				<div v-else-if="activeTab === 'affaires'" class="bureau-center">
					<section class="card ref-card"><h3>Tickets</h3><ClientTicketsTable :tickets="client.tickets" empty="Aucun ticket pour ce client." /></section>
					<section v-if="client.creance" class="card ref-card">
						<div class="ref-card-head"><h3>Créance <a class="ref-link" :href="deskUrl('Creance Client', client.creance.name)" target="_blank" rel="noopener noreferrer">{{ client.creance.name }}</a></h3></div>
						<div class="amount-row"><span class="amount tabular-nums">{{ formatAmount(client.creance.solde_restant) }} DA</span><StatusPill :status="client.creance.statut" /></div>
						<dl class="kv"><div><dt>Prochaine relance</dt><dd class="tabular-nums">{{ formatDay(client.creance.date_prochaine_relance) || '—' }}</dd></div><div><dt>Dernier résultat</dt><dd>{{ client.creance.dernier_resultat_recouvrement || '—' }}</dd></div></dl>
						<p v-if="!client.creance.mouvements.length" class="text-ink-gray-6">Aucun mouvement.</p>
						<div v-else class="ref-scroll"><table class="ref-table">
							<thead><tr><th>Date</th><th>Mouvement</th><th class="end">Montant (DA)</th></tr></thead>
							<tbody><tr v-for="row in client.creance.mouvements" :key="row.name"><td class="tabular-nums">{{ formatDay(row.date_mouvement) }}</td><td>{{ row.type_mouvement }}<template v-if="row.type_paiement">, {{ row.type_paiement.toLowerCase() }}</template></td><td class="end tabular-nums">{{ row.sens === 'Crédit' ? '−' : '' }}{{ formatAmount(row.montant) }}</td></tr></tbody>
						</table></div>
					</section>
					<section v-for="group in [{ title: 'Devis', doctype: 'Quotation', rows: client.devis, empty: 'Aucun devis pour ce client.' }, { title: 'Commandes', doctype: 'Sales Order', rows: client.commandes, empty: 'Aucune commande pour ce client.' }]" :key="group.title" class="card ref-card">
						<h3>{{ group.title }}</h3>
						<p v-if="!group.rows.length" class="text-ink-gray-6">{{ group.empty }}</p>
						<div v-else class="ref-scroll"><table class="ref-table">
							<thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th class="end">Montant (DA)</th></tr></thead>
							<tbody><tr v-for="row in group.rows" :key="row.name"><td><a class="ref-link" :href="deskUrl(group.doctype, row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.transaction_date) }}</td><td><StatusPill :status="row.custom_statut_commande || row.status" /></td><td class="end tabular-nums">{{ formatAmount(row.grand_total) }}</td></tr></tbody>
						</table></div>
					</section>
				</div>

				<!-- Articles. -->
				<div v-else-if="activeTab === 'articles'" class="bureau-center">
					<section class="card ref-card">
						<template v-if="client.articles.length">
							<div class="ref-card-head"><h3>Articles du client</h3><button v-if="client.can_edit" type="button" class="btn-secondary" @click="newArticle = true">Nouvel article</button></div>
							<div class="ref-scroll"><table class="ref-table">
								<thead><tr><th>Code</th><th>Désignation</th><th>Réf. client</th><th>Procédé</th><th>Dernier BAT</th><th>Dernière commande</th></tr></thead>
								<tbody><tr v-for="row in client.articles" :key="row.name"><td><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: row.name } }">{{ row.name }}</RouterLink></td><td class="font-semibold text-ink-gray-9">{{ row.designation }}</td><td class="tabular-nums">{{ row.reference || '—' }}</td><td>{{ row.procede || '—' }}</td><td><StatusPill v-if="row.bat" :status="row.bat" /><span v-else class="text-ink-gray-6">Aucun</span></td><td class="tabular-nums">{{ formatDay(row.derniere_commande) || '—' }}</td></tr></tbody>
							</table></div>
						</template>
						<ListState v-else dieline title="Aucun article pour ce client" text="Les articles apparaissent ici dès leur création.">
							<button v-if="client.can_edit" type="button" class="btn-secondary" @click="newArticle = true">Nouvel article</button>
						</ListState>
					</section>
				</div>

				<!-- Visites et appels. -->
				<div v-else-if="activeTab === 'relation'" class="bureau-center">
					<section class="card ref-card">
						<div class="ref-card-head"><div class="seg" role="group" aria-label="Filtrer les échanges"><button v-for="item in RELATION_FILTERS" :key="item.key" type="button" :aria-pressed="relationFilter === item.key" @click="relationFilter = item.key">{{ item.label }}</button></div></div>
						<ListState v-if="!client.relation.length" dieline title="Aucun échange" text="Les visites, rendez-vous et appels du client apparaissent ici." />
						<p v-else-if="!shownRelation.length" class="text-ink-gray-6">Aucun échange pour ce filtre.</p>
						<div v-else class="ref-scroll"><table class="ref-table">
							<thead><tr><th>Date</th><th>Type</th><th>Objet et compte rendu</th><th>Commercial</th><th>Statut</th></tr></thead>
							<tbody><tr v-for="row in shownRelation" :key="`${row.doctype}-${row.name}`"><td class="tabular-nums"><a class="ref-link" :href="deskUrl(row.doctype, row.name)" target="_blank" rel="noopener noreferrer">{{ formatDay(row.date) || 'Sans date' }}</a></td><td>{{ row.kind }}</td><td><span v-if="row.objet" class="block font-semibold text-ink-gray-9">{{ row.objet }}</span><span class="text-ink-gray-7">{{ row.note }}</span></td><td>{{ row.who || '—' }}</td><td><StatusPill :status="row.status" /></td></tr></tbody>
						</table></div>
					</section>
				</div>

				<!-- Informations. -->
				<div v-else-if="activeTab === 'infos'" class="info-grid">
					<section class="card ref-card">
						<h3>Identité</h3>
						<dl class="kv">
							<div><dt>Raison sociale</dt><dd>{{ client.client }}</dd></div>
							<div><dt>Forme juridique</dt><dd>{{ client.forme_juridique || '—' }}</dd></div>
							<div><dt>Catégorie</dt><dd>{{ client.categorie || '—' }}</dd></div>
							<div><dt>Groupe de sociétés</dt><dd>{{ client.groupe || '—' }}</dd></div>
							<div><dt>Début de la relation</dt><dd class="tabular-nums">{{ formatDay(client.depuis) || '—' }}</dd></div>
							<div><dt>Code</dt><dd class="tabular-nums">{{ client.name }}</dd></div>
						</dl>
					</section>
					<section class="card ref-card">
						<div class="ref-card-head"><h3>Pièces administratives</h3><StatusPill :status="missingPieces ? `${missingPieces} manquante${missingPieces > 1 ? 's' : ''}` : 'Complet'" :tone="missingPieces ? 'amber' : 'green'" /></div>
						<div class="ref-scroll"><table class="ref-table">
							<thead><tr><th>Pièce</th><th>Numéro</th><th>Fichier</th></tr></thead>
							<tbody><tr v-for="piece in client.pieces" :key="piece.key">
								<td>{{ piece.label }}</td>
								<td class="tabular-nums" :class="!piece.numero && 'text-ink-gray-6'">{{ piece.numero || 'Non renseigné' }}</td>
								<td>
									<a v-if="piece.fichier" class="ref-link" :href="piece.fichier" target="_blank" rel="noopener noreferrer">Ouvrir</a>
									<button v-else-if="client.can_edit" type="button" class="ref-link" :disabled="busy" :aria-label="`Joindre le fichier ${piece.label}`" @click="joinPiece(piece.key)">Joindre</button>
									<span v-else class="text-ink-gray-6">Aucun</span>
								</td>
							</tr></tbody>
						</table></div>
					</section>
					<section class="card ref-card">
						<h3>Contacts</h3>
						<p v-if="!client.contacts.length" class="text-ink-gray-6">Aucun contact enregistré.</p>
						<div v-for="(contact, index) in client.contacts" :key="index" class="contact">
							<p><span class="font-semibold text-ink-gray-9">{{ contact.nom || 'Sans nom' }}</span><span v-if="contact.principal" class="text-sm text-ink-gray-6"> Principal</span></p>
							<p v-if="contact.fonction" class="text-sm text-ink-gray-6">{{ contact.fonction }}</p>
							<p class="contact-links">
								<a v-if="contact.telephone" class="ref-link tabular-nums" :href="`tel:${contact.telephone}`"><LucidePhone class="h-3.5 w-3.5" aria-hidden="true" />{{ contact.telephone }}</a>
								<a v-if="contact.email" class="ref-link" :href="`mailto:${contact.email}`"><LucideMail class="h-3.5 w-3.5" aria-hidden="true" />{{ contact.email }}</a>
							</p>
						</div>
					</section>
					<section class="card ref-card">
						<h3>Adresses</h3>
						<div v-for="(adresse, index) in client.adresses" :key="index" class="contact">
							<p class="font-semibold text-ink-gray-9">{{ adresse.label }}</p>
							<p class="text-ink-gray-7">{{ adresse.texte || [adresse.commune, adresse.wilaya].filter(Boolean).join(', ') || 'Non renseignée' }}</p>
						</div>
					</section>
					<section class="card ref-card">
						<h3>Attribution</h3>
						<p v-if="!client.attributions.length" class="text-ink-gray-6">Aucun commercial attribué.</p>
						<div v-else class="ref-scroll"><table class="ref-table">
							<thead><tr><th>Société</th><th>Commercial</th><th>Rôle</th></tr></thead>
							<tbody><tr v-for="(row, index) in client.attributions" :key="index"><td>{{ row.societe }}</td><td>{{ row.commercial }}</td><td>{{ row.principal ? 'Principal' : 'Secondaire' }}</td></tr></tbody>
						</table></div>
					</section>
					<section class="card ref-card">
						<h3>Classification</h3>
						<p v-if="flags.length" class="font-semibold text-ink-gray-9">{{ flags.join(' · ') }}</p>
						<dl class="kv">
							<div><dt>Qualité client</dt><dd :class="client.qualite === null && 'text-ink-gray-6'">{{ note(client.qualite) || 'Non renseignée' }}</dd></div>
							<div><dt>Satisfaction</dt><dd :class="client.satisfaction === null && 'text-ink-gray-6'">{{ note(client.satisfaction) || 'Non renseignée' }}</dd></div>
							<div v-for="item in SENSIBILITES" :key="item.key"><dt>{{ item.label }}</dt><dd :class="!client.sensibilites[item.key] && 'text-ink-gray-6'">{{ client.sensibilites[item.key] || 'Non renseignée' }}</dd></div>
						</dl>
					</section>
				</div>
				<!-- Le fil vient après le contenu, quel que soit l'onglet. -->
				<aside v-if="client.can_view_activity" class="record-activity" aria-label="Commentaires et activité du client">
					<ActivityFeed ref="feed" :api="activityApi" :version="client.modified" :user-name="userName" @changed="refresh()" />
				</aside>
			</div>
			</div>
			</div>
		</template>

		<ClientDialog v-if="editing && client" :client="client" @close="editing = false" @saved="onSaved" />
		<ArticleDialog v-if="newArticle && ticketClient" :initial-client="ticketClient" @close="newArticle = false" @created="onArticleCreated" />
		<NewTicketDialog v-if="newTicket && ticketClient" :initial-client="ticketClient" @close="newTicket = false" @created="onTicketCreated" />
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
		<AppToast :message="createdTicket ? `Ticket ${createdTicket} créé.` : ''" :duration="0" @close="createdTicket = null">
			<button type="button" class="app-toast-action" @click="router.push({ name: 'Ticket', params: { id: createdTicket! } })">Ouvrir la fiche</button>
		</AppToast>
	</main>
</template>
