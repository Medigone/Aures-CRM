<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import LucideCheck from '~icons/lucide/check'
import LucidePlus from '~icons/lucide/plus'
import LucideSearch from '~icons/lucide/search'
import LucideX from '~icons/lucide/x'
import FormDialog from '@shared/components/FormDialog.vue'
import { htmlToText } from '@shared/text'
import ArticleDialog from './ArticleDialog.vue'
import { createDemande, getDemandeArticles, getTicketDemandeContext, updateDemande } from '@/lib/api'
import { BAT_TONES, catalogRows, DEMANDE_TYPES, digitsOnly, draftStatus, draftValues, duplicateLines, expectedProcede, formatDraftQuantity, typeLabel, type ArticleChoice, type CatalogRow, type DemandeDetail, type DraftLine, type TicketDemandeContext } from '@/lib/demandes'
import type { ClientChoice } from '@/types'

/**
 * Création depuis un ticket et modification d'un brouillon : les articles du client à gauche, la demande à droite.
 * Un clic ajoute une ligne ; le serveur reste seul juge des règles, l'écran ne fait qu'éviter les refus certains.
 */
const props = defineProps<{ demande?: DemandeDetail; ticket?: string }>()
const emit = defineEmits<{ close: []; created: [name: string]; saved: [demande: DemandeDetail] }>()

const editing = computed(() => Boolean(props.demande))
const ticketName = computed(() => props.demande?.ticket ?? props.ticket)
const context = ref<TicketDemandeContext | null>(null)
const articles = ref<ArticleChoice[]>([])
const articlesLoading = ref(false)
const loadError = ref('')
const serverError = ref('')
const busy = ref(false)

const client = ref<ClientChoice | null>(props.demande ? choiceOf(props.demande.client, props.demande.client_label) : null)
const type = ref<string>(props.demande?.type ?? 'Premier Tirage')
const date = ref(props.demande?.livraison ?? '')
const bonCommande = ref(props.demande?.bon_commande ?? '')
const query = ref('')
const creatingArticle = ref(false)

let nextId = 1
const lines = ref<DraftLine[]>(
	(props.demande?.lines ?? []).map((line) => ({ id: nextId++, article: line.article, designation: line.designation, last_quantity: 0, quantity: String(line.quantite), est_creation: Boolean(line.est_creation) })),
)
const signature = () => JSON.stringify([type.value, date.value, bonCommande.value, client.value?.name, lines.value.map((line) => [line.article, line.quantity, line.est_creation])])
const baseline = ref(signature())
const dirty = computed(() => signature() !== baseline.value)

function choiceOf(name: string, label: string): ClientChoice {
	return { name, label, wilaya: null, commercial: null, commercial_name: null, open_tickets: 0 }
}

const fromTicket = computed(() => Boolean(ticketName.value))
const procede = computed(() => expectedProcede(context.value?.procede, lines.value, articles.value))
const catalog = computed(() => catalogRows(articles.value, lines.value, { procede: procede.value, fromTicket: fromTicket.value, query: query.value }))
const duplicates = computed(() => duplicateLines(lines.value))
const state = computed(() => draftStatus({ lines: lines.value, date: date.value, type: type.value, bonCommande: bonCommande.value, client: client.value?.name ?? null }))
const procedeHint = computed(() => {
	if (context.value?.procede) return `Procédé du site : ${context.value.procede}`
	return procede.value ? `Procédé de la demande : ${procede.value}` : 'Le premier article fixe le procédé'
})
const maskedHint = computed(() => {
	const { masked, maskedProcede } = catalog.value
	return masked ? `${masked} article${masked > 1 ? 's' : ''} ${maskedProcede} masqué${masked > 1 ? 's' : ''} : autre site` : ''
})
const ticketText = computed(() => htmlToText(context.value?.description ?? ''))
// Le ticket a pu changer depuis l'ouverture de sa fiche : la raison s'affiche, et le serveur refuserait de toute façon.
const ticketBlocked = computed(() => (!editing.value && context.value && context.value.state !== 'ready' ? (context.value.reason ?? 'Ce ticket ne permet pas de créer une demande.') : ''))
const canSubmit = computed(() => !busy.value && !state.value.blocking && !ticketBlocked.value)
const dateHint = computed(() => {
	if (editing.value) return 'Se fixe à la création.'
	if (!context.value) return ''
	return context.value.from_echeance ? 'Échéance du ticket.' : 'Dans 7 jours, sans échéance.'
})

async function loadArticles() {
	articles.value = []
	if (!client.value) return
	const wanted = client.value.name
	articlesLoading.value = true
	loadError.value = ''
	try {
		const found = await getDemandeArticles(wanted)
		if (client.value?.name !== wanted) return
		articles.value = found
		// La dernière quantité n'est connue qu'ici : elle complète les lignes d'un brouillon qu'on reprend.
		for (const line of lines.value) line.last_quantity = found.find((article) => article.name === line.article)?.last_quantity ?? 0
	} catch (e) {
		loadError.value = (e as Error).message
	} finally {
		articlesLoading.value = false
	}
}

onMounted(async () => {
	if (ticketName.value) {
		try {
			context.value = await getTicketDemandeContext(ticketName.value)
			if (!editing.value) {
				client.value = choiceOf(context.value.client, context.value.client_label)
				date.value = context.value.livraison
				// Prérempli : ce n'est pas une saisie, la fermeture ne demande pas de confirmation.
				baseline.value = signature()
			}
		} catch (e) {
			loadError.value = (e as Error).message
			return
		}
	}
	await loadArticles()
})

const list = ref<HTMLElement | null>(null)
async function focusLine(id: number) {
	await nextTick()
	list.value?.querySelector<HTMLInputElement>(`#demande-qty-${id}`)?.focus()
}
function addArticle(article: Pick<ArticleChoice, 'name' | 'designation' | 'last_quantity'>) {
	const id = nextId++
	lines.value.push({ id, article: article.name, designation: article.designation, last_quantity: article.last_quantity, quantity: '', est_creation: false })
	focusLine(id)
}
function addRow(row: CatalogRow) {
	if (!row.locked) addArticle(row)
}
/** Entrée dans la recherche : ajoute le premier article qu'on peut ajouter. */
function addFirst() {
	const first = catalog.value.rows.find((row) => !row.locked)
	if (first) {
		addArticle(first)
		query.value = ''
	}
}
function removeLine(id: number) {
	lines.value = lines.value.filter((line) => line.id !== id)
}
function setQuantity(line: DraftLine, event: Event) {
	const input = event.target as HTMLInputElement
	line.quantity = digitsOnly(input.value)
	input.value = formatDraftQuantity(line.quantity)
}

async function onArticleCreated(name: string) {
	creatingArticle.value = false
	await loadArticles()
	const created = articles.value.find((article) => article.name === name)
	if (!created) return
	const blocked = catalogRows([created], lines.value, { procede: procede.value, fromTicket: false, query: '' }).rows[0]
	if (blocked.locked) serverError.value = `L'article ${created.designation} est créé, mais il ne peut pas entrer dans cette demande : ${blocked.actionLabel}.`
	else addArticle(created)
}

async function submit() {
	if (!canSubmit.value) return
	busy.value = true
	serverError.value = ''
	const values = draftValues({ lines: lines.value, date: date.value, type: type.value, bonCommande: bonCommande.value, client: client.value?.name ?? null })
	try {
		if (props.demande) emit('saved', await updateDemande(props.demande, values))
		else emit('created', (await createDemande(values, props.ticket)).name)
	} catch (e) {
		serverError.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog class="demande-dialog" :title="editing ? `Modifier la demande ${demande!.name}` : 'Nouvelle demande de faisabilité'" :dirty="dirty" :busy="busy" @close="emit('close')" @submit="submit">
		<template #top>
			<p v-if="client" class="demande-context">
				<strong>{{ client.label }}</strong>
				<template v-if="ticketName">
					<span aria-hidden="true">·</span>
					<a class="ref-link tabular-nums" :href="`/bureau/ticket/${encodeURIComponent(ticketName)}`" target="_blank" rel="noopener noreferrer">{{ ticketName }}</a>
				</template>
				<template v-if="context"><span aria-hidden="true">·</span><span>{{ context.request_type }}</span></template>
			</p>
			<div class="demande-params">
				<div class="form-field demande-param-date">
					<label class="field-label" for="demande-date">Livraison souhaitée</label>
					<input id="demande-date" v-model="date" class="field-input" type="date" :disabled="editing" />
					<small class="text-xs text-ink-gray-6">{{ dateHint }}</small>
				</div>
				<div class="form-field flex-none">
					<span class="field-label">Type</span>
					<div class="seg" role="group" aria-label="Type de demande">
						<button v-for="option in DEMANDE_TYPES" :key="option" type="button" :aria-pressed="type === option" @click="type = option">{{ typeLabel(option) }}</button>
					</div>
				</div>
				<div v-if="type === 'Retirage'" class="form-field demande-param-date">
					<label class="field-label" for="demande-bc">Nº de bon de commande</label>
					<input id="demande-bc" v-model="bonCommande" class="field-input" type="text" placeholder="Propre à ce retirage" />
				</div>
				<div v-if="ticketText" class="demande-brief">
					<span class="side-label">Demande du commercial</span>
					<span class="line-clamp-3 whitespace-pre-line" :title="ticketText">{{ ticketText }}</span>
				</div>
			</div>
			<p v-if="!editing && context?.devis_rapproche" class="demande-banner rounded-control tone-amber px-3 py-2 text-sm">
				<strong class="font-semibold">Ce ticket a un devis retenu, {{ context.devis_rapproche }}.</strong>
				Créer cette demande retire ce devis du rapprochement et enregistre la décision « Nouvelle demande de faisabilité ».
			</p>
			<p v-if="ticketBlocked" role="alert" class="demande-banner rounded-control tone-amber px-3 py-2 text-sm">{{ ticketBlocked }}</p>
			<p v-if="loadError" role="alert" class="demande-banner rounded-control tone-red px-3 py-2 text-sm">{{ loadError }}</p>
			<p v-if="serverError" role="alert" class="demande-banner rounded-control tone-red px-3 py-2 text-sm">{{ serverError }}</p>
		</template>

		<div class="demande-split">
			<section class="demande-pane demande-pane-catalog" aria-label="Articles du client">
				<div class="demande-pane-head">
					<h3>Articles du client</h3>
					<span class="demande-hint">{{ procedeHint }}</span>
				</div>
				<div class="demande-search">
					<LucideSearch class="h-3.5 w-3.5" aria-hidden="true" />
					<input v-model="query" class="field-input" type="search" aria-label="Rechercher un article du client" placeholder="Désignation, code ou réf. client" :disabled="!client" @keydown.enter.prevent="addFirst" />
				</div>
				<div class="demande-scroll demande-catalog">
					<p v-if="loadError" class="demande-empty">Articles indisponibles.</p>
					<p v-else-if="!client || articlesLoading" class="demande-empty">Chargement des articles…</p>
					<p v-else-if="!catalog.rows.length && query" class="demande-empty"><strong>Aucun article ne correspond à « {{ query }} »</strong><span>Vérifiez le code ou créez l'article.</span></p>
					<p v-else-if="!catalog.rows.length" class="demande-empty"><strong>Ce client n'a aucun article disponible</strong><span>Créez le premier ci-dessous.</span></p>
					<button v-for="row in catalog.rows" v-else :key="row.name" type="button" class="demande-row" :class="[row.locked && 'is-locked', row.inDemande && 'is-in']" :disabled="row.locked" :title="`${row.name} · ${row.designation}`" @click="addRow(row)">
						<span class="min-w-0">
							<span class="demande-name"><span>{{ row.designation }}</span><LucideCheck v-if="row.inDemande" class="demande-check" aria-label="Déjà dans la demande" /></span>
							<span class="demande-sub">{{ row.detail || row.name }}</span>
						</span>
						<span class="demande-meta">
							<span class="demande-facts">
								<span class="demande-bat" :class="BAT_TONES[row.bat || ''] || 'bat-none'">{{ row.bat || 'Sans BAT' }}</span>
								<span v-if="row.last_quantity" class="demande-last">Dernière {{ formatDraftQuantity(String(row.last_quantity)) }}</span>
							</span>
							<span class="demande-add" :class="row.locked && 'is-locked'">{{ row.actionLabel }}</span>
						</span>
					</button>
				</div>
				<div class="demande-pane-foot">
					<span class="demande-hint">{{ maskedHint }}</span>
					<button type="button" class="tag-add flex-none" :disabled="!client" @click="creatingArticle = true"><LucidePlus class="h-3 w-3" aria-hidden="true" />Créer un article</button>
				</div>
			</section>

			<section class="demande-pane" aria-label="Articles de la demande">
				<div class="demande-pane-head">
					<h3>Dans la demande <span class="demande-count">{{ lines.length }}</span></h3>
					<span class="demande-hint">Une ligne par quantité à étudier</span>
				</div>
				<div v-if="lines.length" class="demande-columns"><span>Article</span><span>Quantité</span><span></span></div>
				<div ref="list" class="demande-scroll">
					<p v-if="!lines.length" class="demande-empty"><strong>Aucun article pour l'instant</strong><span>Cliquez sur un article à gauche pour l'ajouter, puis saisissez sa quantité.</span></p>
					<div v-for="line in lines" :key="line.id" class="demande-line">
						<span class="min-w-0" :title="line.designation">
							<span class="demande-name"><span>{{ line.designation }}</span></span>
							<span class="demande-sub">{{ line.article }}</span>
						</span>
						<input :id="`demande-qty-${line.id}`" class="demande-qty" :class="!line.quantity && 'is-missing'" type="text" inputmode="numeric" placeholder="À saisir" :aria-label="`Quantité pour ${line.designation}`" :aria-invalid="duplicates.has(line.id)" :value="formatDraftQuantity(line.quantity)" @input="setQuantity(line, $event)" />
						<button type="button" class="demande-remove" :aria-label="`Retirer ${line.designation}`" @click="removeLine(line.id)"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
						<label class="demande-crea"><input v-model="line.est_creation" type="checkbox" />Nouvelle création</label>
						<button v-if="!line.quantity && line.last_quantity" type="button" class="demande-last-btn" :aria-label="`Reprendre la dernière quantité commandée, ${formatDraftQuantity(String(line.last_quantity))}`" @click="line.quantity = String(line.last_quantity)">Reprendre {{ formatDraftQuantity(String(line.last_quantity)) }}</button>
						<p v-if="duplicates.has(line.id)" class="demande-dup" role="alert">Cet article est déjà dans la demande avec cette quantité.</p>
					</div>
				</div>
			</section>
		</div>

		<template #hint>
			<span class="demande-status" :class="`is-${state.tone}`" role="status">{{ state.text }}</span>
		</template>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="!canSubmit" @click="submit">{{ busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la demande' }}</button>
		</template>
	</FormDialog>
	<ArticleDialog v-if="creatingArticle && client" :initial-client="client" @close="creatingArticle = false" @created="onArticleCreated" />
</template>
