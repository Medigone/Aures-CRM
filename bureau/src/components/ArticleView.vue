<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { UploadedFile } from '@shared/api'
import FileUploader from '@shared/components/FileUploader.vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideX from '~icons/lucide/x'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import ListState from '@shared/components/ListState.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import ArticleDialog from './ArticleDialog.vue'
import ArticleColors from './ArticleColors.vue'
import BatImportDialog from './BatImportDialog.vue'
import ArticleDocuments from './ArticleDocuments.vue'
import ArticleImage from './ArticleImage.vue'
import ArticlePrepresse from './ArticlePrepresse.vue'
import ClientTicketsTable from './ClientTicketsTable.vue'
import NewTicketDialog from './NewTicketDialog.vue'
import SousArticleDialog from './SousArticleDialog.vue'
import TagEditor from './TagEditor.vue'
import { articleActivity, getArticleOptions, makeComposed, setArticleFile } from '@/lib/api'
import { articleDoc, colorsAfterCard, ficheCards, ficheCardValues, finishesSummary, formatQuantity, formatRate, posesLabel, prepresseState, PROCEDE_FLEXO, TYPE_GENERAL, type ArticleDetail, type ArticleOptions } from '@/lib/articles'
import { formatAmount } from '@/lib/clients'
import { deskUrl, formatDay } from '@/lib/display'
import { useArticle } from '@/lib/useArticle'
import type { ClientChoice } from '@/types'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ tab: [tab: string]; changed: [] }>()

const { article, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh } = useArticle(
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
const teintes = computed(() => (article.value?.compose ? [] : article.value?.teintes ?? []))
const colorsAfter = computed(() => colorsAfterCard(cards.value.map((card) => card.title)))
function fieldValue(card: string, label: string) {
	return cards.value.find((item) => item.title === card)?.rows.find((row) => row.label === label)?.value
}

const openTickets = computed(() => (article.value?.tickets ?? []).filter((ticket) => ticket.is_open))
const prepresseTodo = computed(() => Boolean(article.value && !general.value && prepresseState(article.value).next))
const affairesCount = computed(() => {
	const current = article.value
	return current ? current.commandes.length + current.devis.length + current.etudes.length + current.tickets.length : 0
})
const tabs = computed(() => {
	const current = article.value
	if (!current) return []
	const list: { key: string; label: string; count?: number; todo?: boolean }[] = [{ key: 'apercu', label: 'Aperçu' }]
	if (hasFiche.value) list.push({ key: 'technique', label: 'Fiche technique' })
	if (current.compose) list.push({ key: 'sous-articles', label: 'Sous-articles', count: current.sous_articles.length })
	if (!general.value) list.push({ key: 'prepresse', label: 'Prépresse', todo: prepresseTodo.value })
	list.push({ key: 'documents', label: 'Documents', count: current.documents.length })
	list.push({ key: 'affaires', label: 'Affaires', count: affairesCount.value })
	return list
})
const activeTab = computed(() => (tabs.value.some((tab) => tab.key === props.tab) ? props.tab! : 'apercu'))
// Depuis l'aperçu, « Voir le fil » amène au fil ; sans commentaire, le curseur est déjà prêt pour écrire.
watch(feed, (current) => {
	if (!current || props.tab !== 'activite') return
	current.root?.scrollIntoView?.({ block: 'nearest' })
	if (!article.value?.comments.count) current.focusInput()
})

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
// Envoi : la barre reste visible quel que soit l'onglet, et un dépôt marche partout sur la fiche.
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const pieceUploader = ref<InstanceType<typeof FileUploader> | null>(null)
const dragging = ref(false)
let dragDepth = 0
function hasFiles(event: DragEvent) {
	return Boolean(article.value?.can_edit && event.dataTransfer?.types.includes('Files'))
}
function onDragEnter(event: DragEvent) {
	if (!hasFiles(event)) return
	dragDepth += 1
	dragging.value = true
}
function onDragLeave(event: DragEvent) {
	if (!hasFiles(event)) return
	dragDepth = Math.max(0, dragDepth - 1)
	if (!dragDepth) dragging.value = false
}
function onDrop(event: DragEvent) {
	dragDepth = 0
	dragging.value = false
	if (hasFiles(event) && event.dataTransfer?.files.length) uploader.value?.add(event.dataTransfer.files)
}
function onUploadsSettled(sent: number) {
	load()
	feed.value?.refresh()
	if (sent) notice.value = sent > 1 ? `${sent} fichiers joints à l'article.` : "Fichier joint à l'article."
}
// Une pièce précise : le fichier part, puis se range dans son champ.
let pendingPiece = ''
function joinPiece(piece: string) {
	pendingPiece = piece
	pieceUploader.value?.pick()
}
function onPieceUploaded(file: UploadedFile) {
	const current = article.value
	if (current && pendingPiece) perform(() => setArticleFile(current, pendingPiece, file.file_url))
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
// Un article composé n'a pas de fiche technique : son BAT se joint sans analyse.
const canImportBat = computed(() => Boolean(article.value?.can_edit && !general.value && !article.value?.compose))
const importingBat = ref(false)
function onBatSaved(updated: ArticleDetail, message: string) {
	article.value = updated
	notice.value = message
	feed.value?.refresh()
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
// L'onglet Prépresse y place l'action de sa prochaine étape.
const decisionsBar = ref<HTMLElement | null>(null)
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
			<div class="client-dossier" @dragenter="onDragEnter" @dragover.prevent @dragleave="onDragLeave" @drop.prevent="onDrop">
				<div v-if="dragging" class="record-drop" aria-hidden="true"><div><b>Déposer pour joindre à {{ article.designation }}</b><span>Ils arrivent dans Documents.</span></div></div>
				<aside class="card client-side" aria-label="Identité de l'article">
					<ArticleImage :article="article" :busy="busy" :perform="perform" />
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
						<div class="record-actions record-actions-rail">
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
						<div ref="decisionsBar" class="record-actions record-actions-start empty:hidden"></div>
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
							<div v-for="piece in [{ key: 'fiche_technique', label: 'BAT', url: article.fichiers.fiche_technique }, { key: 'trace_decoupe', label: 'Tracé forme de découpe', url: article.fichiers.trace_decoupe }]" :key="piece.key">
								<dt>{{ piece.label }}</dt>
								<dd>
									<a v-if="piece.url" class="ref-link" :href="piece.url" target="_blank" rel="noopener noreferrer">Ouvrir</a>
									<button v-if="!piece.url && article.can_edit && !(piece.key === 'fiche_technique' && canImportBat)" type="button" class="ref-link" :disabled="busy" :aria-label="`Joindre : ${piece.label}`" @click="joinPiece(piece.key)">Joindre</button>
									<span v-else-if="!piece.url" class="font-normal text-ink-gray-6">Aucun</span>
								</dd>
							</div>
						</dl>
						<button v-if="canImportBat" type="button" class="btn-secondary mt-1" :disabled="busy" @click="importingBat = true">{{ article.fichiers.fiche_technique ? 'Importer un autre BAT' : 'Joindre le BAT' }}</button>
						<button v-if="article.can_edit" type="button" class="btn-secondary mt-1" @click="uploader?.pick()">Joindre des fichiers</button>
					</div>
				</aside>

				<div class="client-main">
					<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>

					<div class="record-tabs" role="tablist">
						<button v-for="item in tabs" :key="item.key" type="button" class="record-tab" role="tab" :aria-selected="activeTab === item.key" @click="emit('tab', item.key)">
							{{ item.label }}<span v-if="item.count" class="ml-1 tabular-nums text-ink-gray-6">{{ item.count }}</span><span v-if="item.todo" class="tab-todo" title="Une étape à faire"><span class="sr-only">, une étape à faire</span></span>
						</button>
					</div>

					<div class="bureau-detail">
						<FileUploader ref="uploader" class="w-full" doctype="Item" :docname="article.name" :zone="activeTab === 'documents' && article.can_edit" @settled="onUploadsSettled" />
						<FileUploader ref="pieceUploader" class="w-full" doctype="Item" :docname="article.name" :zone="false" :multiple="false" @uploaded="onPieceUploaded" />
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
							<div v-if="cards.length || teintes.length" class="card fiche-releve">
								<section v-if="teintes.length && !colorsAfter" class="fiche-rubrique">
									<h3>Couleurs</h3>
									<ArticleColors :teintes="teintes" />
								</section>
								<template v-for="card in cards" :key="card.title">
									<section class="fiche-rubrique">
										<h3>{{ card.title }}</h3>
										<dl v-if="card.rows.length" class="fiche-champs">
											<div v-for="row in card.rows" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
										</dl>
										<p v-if="card.checks.length" class="fiche-coches">{{ card.checks.join(' · ') }}</p>
									</section>
									<section v-if="teintes.length && colorsAfter === card.title" class="fiche-rubrique">
										<h3>Couleurs</h3>
										<ArticleColors :teintes="teintes" />
									</section>
								</template>
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
						<ArticlePrepresse v-else-if="activeTab === 'prepresse'" :article="article" :busy="busy" :perform="perform" :actions-bar="decisionsBar" @notice="notice = $event" @problem="actionError = $event" />

						<!-- Documents : la zone de dépôt est au-dessus, avec l'envoi en cours. -->
						<div v-else-if="activeTab === 'documents'" class="bureau-center">
							<ArticleDocuments :article="article" :busy="busy" :perform="perform" />
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
						<!-- Le fil vient après le contenu, quel que soit l'onglet. -->
						<aside class="record-activity" aria-label="Commentaires et activité de l'article">
							<ActivityFeed ref="feed" :api="activityApi" :version="article.modified" :user-name="userName" @changed="refresh()" />
						</aside>
					</div>
				</div>
			</div>
		</template>

		<ArticleDialog v-if="editing && article" :article="article" @close="editing = false" @saved="onSaved" />
		<BatImportDialog v-if="importingBat && article" :article="article" :options="options" @close="importingBat = false" @saved="onBatSaved" />
		<SousArticleDialog v-if="newSous && article" :article="article" @close="newSous = false" @created="onSousCreated" />
		<NewTicketDialog v-if="newTicket && ticketClient" :initial-client="ticketClient" @close="newTicket = false" @created="onTicketCreated" />
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
		<AppToast :message="createdTicket ? `Ticket ${createdTicket} créé.` : ''" :duration="0" @close="createdTicket = null">
			<button type="button" class="app-toast-action" @click="router.push({ name: 'Ticket', params: { id: createdTicket! } })">Ouvrir la fiche</button>
		</AppToast>
	</main>
</template>
