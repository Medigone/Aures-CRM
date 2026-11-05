<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideX from '~icons/lucide/x'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import ListState from '@shared/components/ListState.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import ArticleDialog from './ArticleDialog.vue'
import ClientTicketsTable from './ClientTicketsTable.vue'
import NewTicketDialog from './NewTicketDialog.vue'
import SousArticleDialog from './SousArticleDialog.vue'
import TagEditor from './TagEditor.vue'
import { articleActivity, attachArticleFile, getArticleOptions, makeComposed } from '@/lib/api'
import { articleDoc, ficheCards, ficheCardValues, finishesSummary, formatQuantity, formatRate, posesLabel, PROCEDE_FLEXO, TYPE_GENERAL, type ArticleDetail, type ArticleOptions } from '@/lib/articles'
import { formatAmount } from '@/lib/clients'
import { deskUrl, formatDay } from '@/lib/display'
import { useArticle } from '@/lib/useArticle'
import type { ClientChoice } from '@/types'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ tab: [tab: string]; changed: [] }>()

const { article, error, notFound, actionError, notice, busy, load, perform, refresh } = useArticle(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const activityApi = computed(() => articleActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, article })

const options = ref<ArticleOptions | null>(null)
onMounted(async () => {
	try {
		options.value = await getArticleOptions()
	} catch (e) {
		actionError.value = (e as Error).message
	}
})

const general = computed(() => article.value?.type === TYPE_GENERAL)
const flexo = computed(() => article.value?.procede === PROCEDE_FLEXO)
const doc = computed(() => (article.value ? articleDoc(article.value) : {}))
// Un article général n'a pas de fiche technique, même si le Desk garde quelques champs communs sans condition.
const hasFiche = computed(() => !general.value && ficheCards(options.value?.schema, doc.value).length > 0)
const cards = computed(() => ficheCardValues(options.value?.schema, doc.value))
const finishes = computed(() => finishesSummary(cards.value))
function fieldValue(card: string, label: string) {
	return cards.value.find((item) => item.title === card)?.rows.find((row) => row.label === label)?.value
}

const openTickets = computed(() => (article.value?.tickets ?? []).filter((ticket) => ticket.is_open))
const prepresseCount = computed(() => {
	const current = article.value?.prepresse
	return current ? current.maquettes.length + current.bats.length + current.traces.length + current.impositions.length + current.cliches.length + current.plans_flexo.length + current.etudes_techniques.length : 0
})
const affairesCount = computed(() => {
	const current = article.value
	return current ? current.commandes.length + current.devis.length + current.etudes.length + current.tickets.length : 0
})
const tabs = computed(() => {
	const current = article.value
	if (!current) return []
	const list: { key: string; label: string; count?: number }[] = [{ key: 'apercu', label: 'Aperçu' }]
	if (hasFiche.value) list.push({ key: 'technique', label: 'Fiche technique' })
	if (current.compose) list.push({ key: 'sous-articles', label: 'Sous-articles', count: current.sous_articles.length })
	if (!general.value) list.push({ key: 'prepresse', label: 'Prépresse', count: prepresseCount.value })
	list.push({ key: 'affaires', label: 'Affaires', count: affairesCount.value })
	list.push({ key: 'activite', label: 'Activité', count: current.comments.count })
	return list
})
const activeTab = computed(() => (tabs.value.some((tab) => tab.key === props.tab) ? props.tab! : 'apercu'))

const chain = computed(() => {
	const current = article.value?.prepresse
	if (!current) return []
	const trace = current.traces[0]
	const maquette = current.maquettes.find((row) => row.status === 'Version Activée') ?? current.maquettes[0]
	const imposition = current.impositions[0]
	const cliche = current.cliches[0]
	const bat = current.bats.find((row) => row.status !== 'Obsolète') ?? current.bats[0]
	const chutes = imposition?.taux_chutes ? ` · chutes ${String(imposition.taux_chutes).replace('.', ',')} %` : ''
	return [
		{ label: 'Tracé', doctype: 'Trace', name: trace?.name, sub: trace?.dimensions ? `${trace.dimensions} mm` : '', status: '' },
		{ label: 'Maquette', doctype: 'Maquette', name: maquette?.name, sub: '', status: maquette?.status ?? '' },
		flexo.value
			? { label: 'Cliché', doctype: 'Cliche', name: cliche?.name, sub: '', status: cliche?.status ?? '' }
			: { label: 'Imposition', doctype: 'Imposition', name: imposition?.name, sub: imposition?.nbr_poses ? `${posesLabel(imposition.nbr_poses)}${chutes}` : '', status: '' },
		{ label: 'BAT', doctype: 'BAT', name: bat?.name, sub: '', status: bat?.status ?? '' },
	]
})

interface Vente {
	piece: string
	name: string
	doctype: string
	date: string
	status: string
	qty: number
	rate: number
}
function ventes(current: ArticleDetail): Vente[] {
	return [
		...current.devis.map((row) => ({ piece: 'Devis', name: row.name, doctype: 'Quotation', date: row.transaction_date, status: row.custom_statut_commande || row.status, qty: row.qty, rate: row.rate })),
		...current.commandes.map((row) => ({ piece: 'Commande', name: row.name, doctype: 'Sales Order', date: row.transaction_date, status: row.status, qty: row.qty, rate: row.rate })),
	]
}
const lastVentes = computed(() => (article.value ? ventes(article.value).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : []))
const lastOrder = computed(() => article.value?.commandes[0])

function onTags(tags: string[]) {
	if (article.value) article.value.tags = tags
	emit('changed')
}
function onFile(piece: string, event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	input.value = ''
	const current = article.value
	if (file && current) perform(() => attachArticleFile(current, piece, file))
}
async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}
function transform() {
	const current = article.value
	if (current && window.confirm('Cet article deviendra un article composé : vous pourrez lui créer des sous-articles. Continuer ?')) perform(() => makeComposed(current))
}

// Fenêtres.
const editing = ref(false)
function onSaved(updated: ArticleDetail) {
	article.value = updated
	notice.value = 'Article enregistré.'
	emit('changed')
}
const newSous = ref(false)
function onSousCreated(updated: ArticleDetail, name: string) {
	article.value = updated
	notice.value = `Sous-article ${name} créé.`
	emit('changed')
	emit('tab', 'sous-articles')
}
const newTicket = ref(false)
const createdTicket = ref<string | null>(null)
const router = useRouter()
const ticketClient = computed<ClientChoice | undefined>(() => {
	const current = article.value
	if (!current?.client) return undefined
	return { name: current.client, label: current.client_label || current.client, wilaya: current.wilaya, commercial: current.commercial_user, commercial_name: current.commercial, open_tickets: 0 }
})
function onTicketCreated(result: { name: string; failedFiles: number }) {
	createdTicket.value = result.name
	load()
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Cet article n'existe pas ou n'existe plus.</div>
		<div v-else-if="!article" class="card p-8 text-center text-ink-gray-6">Chargement de l'article…</div>

		<template v-else>
			<div class="client-dossier">
				<aside class="card client-side" aria-label="Identité de l'article">
					<div class="article-visual">
						<img v-if="article.image" :src="article.image" alt="Visuel de l'article" />
						<svg v-else class="dieline" viewBox="0 0 120 84" aria-hidden="true"><path class="cut" d="M8 24 L8 60 L20 60 L24 76 L52 76 L56 60 L92 60 L96 76 L108 76 L112 60 L112 24 L108 8 L96 8 L92 24 L56 24 L52 8 L24 8 L20 24 Z" /><path class="fold" d="M20 24 L20 60 M56 24 L56 60 M92 24 L92 60 M20 24 L56 24 M92 24 L112 24 M20 60 L56 60 M92 60 L112 60" /></svg>
						<label v-if="article.can_edit && !article.image" class="ref-link cursor-pointer">Joindre un visuel<input class="sr-only" type="file" accept="image/*" :disabled="busy" aria-label="Joindre un visuel" @change="onFile('image', $event)" /></label>
					</div>
					<div class="side-block gap-2 !border-t-0">
						<h2 class="page-title leading-tight">{{ article.designation }}</h2>
						<div class="flex flex-wrap items-center gap-1.5">
							<StatusPill v-if="article.bat" :status="article.bat" />
							<span v-else-if="!general" class="text-sm text-ink-gray-6">Aucun BAT</span>
							<span v-if="article.compose" class="record-flag">Composé</span>
							<span v-if="article.sous_article" class="record-flag">Sous-article</span>
							<span v-if="general" class="record-flag">Article général</span>
						</div>
						<p class="text-sm text-ink-gray-7">{{ [article.name, article.reference && `Réf. client ${article.reference}`].filter(Boolean).join(' · ') }}</p>
						<TagEditor doctype="Item" :name="article.name" :modified="article.modified" :tags="article.tags" :can-edit="article.can_edit" @changed="onTags" />
						<div class="mt-1 flex items-center gap-1.5">
							<button v-if="ticketClient" type="button" class="btn-primary flex-auto" @click="newTicket = true">Nouveau ticket</button>
							<button v-if="article.can_edit" type="button" :class="ticketClient ? 'btn-secondary' : 'btn-primary flex-auto'" :disabled="busy" @click="editing = true">Modifier</button>
							<MoreMenu>
								<button v-if="article.can_edit && !article.compose && !article.sous_article && !general" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="transform">Transformer en article composé</button>
								<button v-if="article.can_edit && article.compose" type="button" class="app-menu-item" role="menuitem" @click="newSous = true">Créer un sous-article</button>
								<a v-if="!general" class="app-menu-item" role="menuitem" :href="deskUrl('Item', article.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Étude de faisabilité sur le Desk</a>
								<div v-if="!general || article.can_edit" class="app-menu-sep"></div>
								<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
								<a class="app-menu-item" role="menuitem" :href="deskUrl('Item', article.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
							</MoreMenu>
						</div>
					</div>
					<div v-if="article.client" class="side-block">
						<p class="side-label">Client</p>
						<p><RouterLink class="ref-link font-semibold" :to="{ name: 'Client', params: { id: article.client } }">{{ article.client_label }}</RouterLink></p>
						<p class="text-ink-gray-6">{{ [article.wilaya, article.commercial].filter(Boolean).join(' · ') || 'Non attribué' }}</p>
					</div>
					<div v-if="article.parent" class="side-block">
						<p class="side-label">Article parent</p>
						<p><RouterLink class="ref-link font-semibold" :to="{ name: 'Article', params: { id: article.parent } }">{{ article.parent_label || article.parent }}</RouterLink></p>
						<p class="text-ink-gray-6">Quantité par article parent : {{ formatQuantity(article.quantite_parent) }}</p>
					</div>
					<div class="side-block">
						<dl class="side-kv">
							<div v-if="!general"><dt>Procédé</dt><dd :class="!article.procede && 'font-normal text-ink-gray-6'">{{ article.procede || 'Non renseigné' }}</dd></div>
							<div><dt>Groupe</dt><dd>{{ article.groupe || '—' }}</dd></div>
							<div><dt>Unité</dt><dd>{{ article.unite || '—' }}</dd></div>
							<div v-if="!general"><dt>Consommation annuelle</dt><dd class="tabular-nums" :class="!article.consommation && 'font-normal text-ink-gray-6'">{{ article.consommation ? formatAmount(article.consommation) : '—' }}</dd></div>
							<div v-if="article.ancien_code"><dt>Ancien code ERP</dt><dd>{{ article.ancien_code }}</dd></div>
						</dl>
					</div>
					<div v-if="!general" class="side-block">
						<p class="side-label">Documents</p>
						<dl class="side-kv">
							<div v-for="piece in [{ key: 'fiche_technique', label: 'Fiche technique', url: article.fichiers.fiche_technique }, { key: 'trace_decoupe', label: 'Tracé forme de découpe', url: article.fichiers.trace_decoupe }]" :key="piece.key">
								<dt>{{ piece.label }}</dt>
								<dd>
									<a v-if="piece.url" class="ref-link" :href="piece.url" target="_blank" rel="noopener noreferrer">Ouvrir</a>
									<label v-else-if="article.can_edit" class="ref-link cursor-pointer">Joindre<input class="sr-only" type="file" :disabled="busy" :aria-label="`Joindre : ${piece.label}`" @change="onFile(piece.key, $event)" /></label>
									<span v-else class="font-normal text-ink-gray-6">Aucun</span>
								</dd>
							</div>
						</dl>
					</div>
				</aside>

				<div class="client-main">
					<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>
					<p v-if="notice" role="status" class="flex-none rounded-control tone-blue px-3.5 py-2.5">{{ notice }}</p>
					<div v-if="createdTicket" role="status" class="flex flex-none items-center gap-2 rounded-control tone-blue px-3.5 py-2.5">
						<span class="flex-auto">Ticket {{ createdTicket }} créé.</span>
						<button type="button" class="font-semibold underline" @click="router.push({ name: 'Ticket', params: { id: createdTicket } })">Ouvrir la fiche</button>
						<button type="button" aria-label="Fermer ce message" @click="createdTicket = null"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
					</div>

					<div class="record-tabs" role="tablist">
						<button v-for="item in tabs" :key="item.key" type="button" class="record-tab" role="tab" :aria-selected="activeTab === item.key" @click="emit('tab', item.key)">
							{{ item.label }}<span v-if="item.count" class="ml-1 tabular-nums text-ink-gray-6">{{ item.count }}</span>
						</button>
					</div>

					<div class="bureau-detail">
						<!-- Aperçu : il résume les autres onglets. -->
						<div v-if="activeTab === 'apercu'" class="bureau-center">
							<p v-if="article.ecart_bat" role="status" class="rounded-control tone-amber px-3.5 py-2.5">
								<strong class="font-semibold">Le BAT validé ne couvre pas la maquette active :</strong>
								{{ article.ecart_bat.bat }} porte sur {{ article.ecart_bat.maquette_bat }}, la version activée est {{ article.ecart_bat.maquette_active }}. Vérifiez avant de relancer une commande.
							</p>
							<section v-if="!general" class="card ref-card">
								<div class="ref-card-head"><h3>Prépresse</h3><button type="button" class="ref-link" @click="emit('tab', 'prepresse')">Tout voir</button></div>
								<div class="article-chain">
									<div v-for="item in chain" :key="item.label">
										<span class="side-label">{{ item.label }}</span>
										<template v-if="item.name">
											<a class="ref-link inline-link tabular-nums" :href="deskUrl(item.doctype, item.name)" target="_blank" rel="noopener noreferrer">{{ item.name }}</a>
											<span v-if="item.sub" class="text-sm text-ink-gray-7">{{ item.sub }}</span>
											<StatusPill v-if="item.status" :status="item.status" />
										</template>
										<span v-else class="text-ink-gray-6">Aucun</span>
									</div>
								</div>
							</section>
							<div class="client-cards">
								<section v-if="!general" class="card ref-card">
									<div class="ref-card-head"><h3>Essentiel technique</h3><button v-if="hasFiche" type="button" class="ref-link" @click="emit('tab', 'technique')">Tout voir</button></div>
									<dl class="kv">
										<div><dt>Support</dt><dd>{{ article.support || '—' }}</dd></div>
										<div><dt>Format</dt><dd class="tabular-nums">{{ article.format ? `${article.format} mm` : '—' }}</dd></div>
										<div><dt>Couleurs</dt><dd>{{ article.couleurs || '—' }}</dd></div>
										<div><dt>Finitions</dt><dd>{{ finishes || '—' }}</dd></div>
										<div v-if="fieldValue('Impression', 'Nombre Passages')"><dt>Passages</dt><dd class="tabular-nums">{{ fieldValue('Impression', 'Nombre Passages') }}</dd></div>
									</dl>
								</section>
								<section class="card ref-card">
									<div class="ref-card-head"><h3>Dernière commande</h3><button v-if="lastOrder" type="button" class="ref-link" @click="emit('tab', 'affaires')">Tout voir</button></div>
									<dl v-if="lastOrder" class="kv">
										<div><dt>Commande</dt><dd><a class="ref-link inline-link" :href="deskUrl('Sales Order', lastOrder.name)" target="_blank" rel="noopener noreferrer">{{ lastOrder.name }}</a></dd></div>
										<div><dt>Date</dt><dd class="tabular-nums">{{ formatDay(lastOrder.transaction_date) }}</dd></div>
										<div><dt>Quantité</dt><dd class="tabular-nums">{{ formatQuantity(lastOrder.qty) }}</dd></div>
										<div><dt>Prix unitaire</dt><dd class="tabular-nums">{{ formatRate(lastOrder.rate) }} DA</dd></div>
										<div><dt>Statut</dt><dd><StatusPill :status="lastOrder.status" /></dd></div>
									</dl>
									<p v-else class="text-ink-gray-6">Aucune commande pour cet article.</p>
								</section>
							</div>
							<section v-if="!general" class="card ref-card">
								<div class="ref-card-head"><h3>Tickets ouverts</h3><button v-if="openTickets.length > 5" type="button" class="ref-link" @click="emit('tab', 'affaires')">Voir les {{ openTickets.length }} tickets</button></div>
								<ClientTicketsTable :tickets="openTickets.slice(0, 5)" empty="Aucun ticket ouvert." />
							</section>
							<section class="card ref-card">
								<div class="ref-card-head"><h3>Derniers devis et commandes</h3><button v-if="lastVentes.length" type="button" class="ref-link" @click="emit('tab', 'affaires')">Tout voir</button></div>
								<p v-if="!lastVentes.length" class="text-ink-gray-6">Aucun devis ni commande.</p>
								<div v-else class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Pièce</th><th>Numéro</th><th>Date</th><th>Statut</th><th class="end">Quantité</th><th class="end">Prix unitaire (DA)</th></tr></thead>
									<tbody><tr v-for="row in lastVentes" :key="`${row.doctype}-${row.name}`"><td>{{ row.piece }}</td><td><a class="ref-link" :href="deskUrl(row.doctype, row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.date) }}</td><td><StatusPill :status="row.status" /></td><td class="end tabular-nums">{{ formatQuantity(row.qty) }}</td><td class="end tabular-nums">{{ formatRate(row.rate) }}</td></tr></tbody>
								</table></div>
							</section>
						</div>

						<!-- Fiche technique : les champs du procédé de l'article, seuls ceux qui sont renseignés. -->
						<div v-else-if="activeTab === 'technique'" class="bureau-center">
							<div v-if="cards.length" class="article-cards">
								<section v-for="card in cards" :key="card.title" class="card ref-card">
									<h3>{{ card.title }}</h3>
									<dl v-if="card.rows.length" class="kv">
										<div v-for="row in card.rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
									</dl>
									<p v-if="card.checks.length" class="font-medium text-ink-gray-9">{{ card.checks.join(' · ') }}</p>
								</section>
							</div>
							<section v-else class="card ref-card">
								<ListState dieline title="Fiche technique non renseignée" text="Complétez-la pour qu'elle serve aux études et à la prépresse.">
									<button v-if="article.can_edit" type="button" class="btn-secondary" @click="editing = true">Modifier</button>
								</ListState>
							</section>
						</div>

						<!-- Sous-articles. -->
						<div v-else-if="activeTab === 'sous-articles'" class="bureau-center">
							<section class="card ref-card">
								<template v-if="article.sous_articles.length">
									<div class="ref-card-head"><h3>Sous-articles</h3><button v-if="article.can_edit" type="button" class="btn-secondary" @click="newSous = true">Créer un sous-article</button></div>
									<div class="ref-scroll"><table class="ref-table">
										<thead><tr><th>Code</th><th>Désignation</th><th class="end">Quantité</th><th>Support</th><th>Format (mm)</th><th>Dernier BAT</th></tr></thead>
										<tbody><tr v-for="row in article.sous_articles" :key="row.name"><td><RouterLink class="ref-link" :to="{ name: 'Article', params: { id: row.name } }">{{ row.name }}</RouterLink></td><td class="font-semibold text-ink-gray-9">{{ row.designation }}</td><td class="end tabular-nums">{{ formatQuantity(row.quantite) }}</td><td>{{ row.support || '—' }}</td><td class="tabular-nums">{{ row.format || '—' }}</td><td><StatusPill v-if="row.bat" :status="row.bat" /><span v-else class="text-ink-gray-6">Aucun</span></td></tr></tbody>
									</table></div>
								</template>
								<ListState v-else dieline title="Aucun sous-article" text="Les éléments qui composent cet article apparaissent ici.">
									<button v-if="article.can_edit" type="button" class="btn-secondary" @click="newSous = true">Créer un sous-article</button>
								</ListState>
							</section>
						</div>

						<!-- Prépresse. -->
						<div v-else-if="activeTab === 'prepresse'" class="bureau-center">
							<section class="card ref-card">
								<h3>Maquettes</h3>
								<p v-if="!article.prepresse.maquettes.length" class="text-ink-gray-6">Aucune maquette pour cet article.</p>
								<div v-else class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Numéro</th><th>Statut</th><th>Couleurs</th><th>Créée le</th><th>Changements</th><th>Fichier</th></tr></thead>
									<tbody><tr v-for="row in article.prepresse.maquettes" :key="row.name"><td><a class="ref-link" :href="deskUrl('Maquette', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td><StatusPill :status="row.status" /></td><td>{{ row.resume_couleurs || '—' }}</td><td class="tabular-nums">{{ formatDay(row.date_creation) || '—' }}</td><td class="max-w-64 truncate" :title="row.desc_changements || undefined">{{ row.desc_changements || '—' }}</td><td><a v-if="row.fichier_maquette" class="ref-link" :href="row.fichier_maquette" target="_blank" rel="noopener noreferrer">Ouvrir</a><span v-else class="text-ink-gray-6">Aucun</span></td></tr></tbody>
								</table></div>
							</section>
							<section class="card ref-card">
								<h3>BAT</h3>
								<p v-if="!article.prepresse.bats.length" class="text-ink-gray-6">Aucun BAT pour cet article.</p>
								<div v-else class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Numéro</th><th>Statut</th><th>Date</th><th>Maquette</th><th>Validé par</th><th>Fichier</th></tr></thead>
									<tbody><tr v-for="row in article.prepresse.bats" :key="row.name"><td><a class="ref-link" :href="deskUrl('BAT', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td><StatusPill :status="row.status" /></td><td class="tabular-nums">{{ formatDay(row.date) || '—' }}</td><td>{{ row.maquette || '—' }}</td><td>{{ row.valide_par_nom || '—' }}</td><td><a v-if="row.fichier_valide" class="ref-link" :href="row.fichier_valide" target="_blank" rel="noopener noreferrer">Ouvrir</a><span v-else class="text-ink-gray-6">Aucun</span></td></tr></tbody>
								</table></div>
							</section>
							<div class="client-cards">
								<section class="card ref-card">
									<h3>Tracé</h3>
									<p v-if="!article.prepresse.traces.length" class="text-ink-gray-6">Aucun tracé pour cet article.</p>
									<div v-else class="ref-scroll"><table class="ref-table">
										<thead><tr><th>Numéro</th><th>Dimensions</th><th>Fichier</th></tr></thead>
										<tbody><tr v-for="row in article.prepresse.traces" :key="row.name"><td><a class="ref-link" :href="deskUrl('Trace', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ row.dimensions || '—' }}</td><td><a v-if="row.fichier_trace" class="ref-link" :href="row.fichier_trace" target="_blank" rel="noopener noreferrer">Ouvrir</a><span v-else class="text-ink-gray-6">Aucun</span></td></tr></tbody>
									</table></div>
								</section>
								<section v-if="flexo" class="card ref-card">
									<h3>Clichés</h3>
									<p v-if="!article.prepresse.cliches.length" class="text-ink-gray-6">Aucun cliché pour cet article.</p>
									<div v-else class="ref-scroll"><table class="ref-table">
										<thead><tr><th>Numéro</th><th>Statut</th><th>Date</th><th class="end">Version</th></tr></thead>
										<tbody><tr v-for="row in article.prepresse.cliches" :key="row.name"><td><a class="ref-link" :href="deskUrl('Cliche', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td><StatusPill :status="row.status" /></td><td class="tabular-nums">{{ formatDay(row.date) || '—' }}</td><td class="end tabular-nums">{{ row.version || '—' }}</td></tr></tbody>
									</table></div>
								</section>
								<section v-else class="card ref-card">
									<h3>Imposition</h3>
									<p v-if="!article.prepresse.impositions.length" class="text-ink-gray-6">Aucune imposition pour cet article.</p>
									<div v-else class="ref-scroll"><table class="ref-table">
										<thead><tr><th>Numéro</th><th>Machine</th><th class="end">Poses</th><th class="end">Chutes</th></tr></thead>
										<tbody><tr v-for="row in article.prepresse.impositions" :key="row.name"><td><a class="ref-link" :href="deskUrl('Imposition', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td>{{ row.machine_impression || '—' }}</td><td class="end tabular-nums">{{ row.nbr_poses || '—' }}</td><td class="end tabular-nums">{{ row.taux_chutes ? `${String(row.taux_chutes).replace('.', ',')} %` : '—' }}</td></tr></tbody>
									</table></div>
								</section>
							</div>
							<section v-if="article.prepresse.plans_flexo.length" class="card ref-card">
								<h3>Plans Flexo</h3>
								<div class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Numéro</th><th>Date</th><th>Dimensions</th><th>Laize</th><th>Fichier</th></tr></thead>
									<tbody><tr v-for="row in article.prepresse.plans_flexo" :key="row.name"><td><a class="ref-link" :href="deskUrl('Plan Flexo', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.date) || '—' }}</td><td class="tabular-nums">{{ row.dimensions || '—' }}</td><td class="tabular-nums">{{ row.laize || '—' }}</td><td><a v-if="row.fichier" class="ref-link" :href="row.fichier" target="_blank" rel="noopener noreferrer">Ouvrir</a><span v-else class="text-ink-gray-6">Aucun</span></td></tr></tbody>
								</table></div>
							</section>
							<section class="card ref-card">
								<h3>Études techniques</h3>
								<p v-if="!article.prepresse.etudes_techniques.length" class="text-ink-gray-6">Aucune étude technique pour cet article.</p>
								<div v-else class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Numéro</th><th>Statut</th><th>Date</th><th>Technicien</th><th>Machine</th><th class="end">Passages</th></tr></thead>
									<tbody><tr v-for="row in article.prepresse.etudes_techniques" :key="row.name"><td><a class="ref-link" :href="deskUrl('Etude Technique', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td><StatusPill :status="row.status" /></td><td class="tabular-nums">{{ formatDay(row.date) || '—' }}</td><td>{{ row.nom_utilisateur || '—' }}</td><td>{{ row.machine || '—' }}</td><td class="end tabular-nums">{{ row.nb_passages || '—' }}</td></tr></tbody>
								</table></div>
							</section>
						</div>

						<!-- Affaires. -->
						<div v-else-if="activeTab === 'affaires'" class="bureau-center">
							<section class="card ref-card">
								<h3>Commandes</h3>
								<p v-if="!article.commandes.length" class="text-ink-gray-6">Aucune commande pour cet article.</p>
								<div v-else class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th class="end">Quantité</th><th class="end">Prix unitaire (DA)</th><th class="end">Montant (DA)</th></tr></thead>
									<tbody><tr v-for="(row, index) in article.commandes" :key="`${row.name}-${index}`"><td><a class="ref-link" :href="deskUrl('Sales Order', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.transaction_date) }}</td><td><StatusPill :status="row.status" /></td><td class="end tabular-nums">{{ formatQuantity(row.qty) }}</td><td class="end tabular-nums">{{ formatRate(row.rate) }}</td><td class="end tabular-nums">{{ formatAmount(row.amount) }}</td></tr></tbody>
								</table></div>
							</section>
							<section class="card ref-card">
								<h3>Devis</h3>
								<p v-if="!article.devis.length" class="text-ink-gray-6">Aucun devis pour cet article.</p>
								<div v-else class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th class="end">Quantité</th><th class="end">Prix unitaire (DA)</th></tr></thead>
									<tbody><tr v-for="(row, index) in article.devis" :key="`${row.name}-${index}`"><td><a class="ref-link" :href="deskUrl('Quotation', row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.transaction_date) }}</td><td><StatusPill :status="row.custom_statut_commande || row.status" /></td><td class="end tabular-nums">{{ formatQuantity(row.qty) }}</td><td class="end tabular-nums">{{ formatRate(row.rate) }}</td></tr></tbody>
								</table></div>
							</section>
							<section v-if="!general" class="card ref-card">
								<h3>Études de faisabilité</h3>
								<p v-if="!article.etudes.length" class="text-ink-gray-6">Aucune étude de faisabilité pour cet article.</p>
								<div v-else class="ref-scroll"><table class="ref-table">
									<thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th class="end">Quantité</th></tr></thead>
									<tbody><tr v-for="row in article.etudes" :key="row.name"><td><a class="ref-link" :href="deskUrl(row.doctype, row.name)" target="_blank" rel="noopener noreferrer">{{ row.name }}</a></td><td class="tabular-nums">{{ formatDay(row.date_creation) || '—' }}</td><td><StatusPill :status="row.status" /></td><td class="end tabular-nums">{{ row.quantite ? formatQuantity(row.quantite) : '—' }}</td></tr></tbody>
								</table></div>
							</section>
							<section v-if="!general" class="card ref-card">
								<h3>Tickets</h3>
								<ClientTicketsTable :tickets="article.tickets" empty="Aucun ticket rattaché à cet article." />
							</section>
						</div>

						<!-- Activité. -->
						<div v-else class="bureau-center">
							<ActivityFeed ref="feed" :api="activityApi" :version="article.modified" :user-name="userName" @changed="refresh()" />
						</div>
					</div>
				</div>
			</div>
		</template>

		<ArticleDialog v-if="editing && article" :article="article" @close="editing = false" @saved="onSaved" />
		<SousArticleDialog v-if="newSous && article" :article="article" @close="newSous = false" @created="onSousCreated" />
		<NewTicketDialog v-if="newTicket && ticketClient" :initial-client="ticketClient" @close="newTicket = false" @created="onTicketCreated" />
	</main>
</template>
