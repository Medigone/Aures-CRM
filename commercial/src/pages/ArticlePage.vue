<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideTicket from '~icons/lucide/ticket'
import LucideRepeat from '~icons/lucide/repeat'
import LucideCalculator from '~icons/lucide/calculator'
import OfflineFile from '@/components/OfflineFile.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay, relativeDays } from '@/lib/format'
import { fileUrl, formatMoney } from '@/lib/text'
import { isLocal } from '@/lib/mutations'
import type { ArticleHistory } from '@/types'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const router = useRouter()
// Un article créé sur l'appareil prend son code serveur (CLIENT-NNN) à la synchro : la page suit.
watch(
	() => store.resolveKey(props.id),
	(next) => {
		if (next !== props.id) router.replace({ name: 'Article', params: { id: next } })
	},
)
const article = computed(() => store.articlesByName.get(props.id) ?? null)
const client = computed(() => (article.value ? store.clientsByName.get(article.value.client) ?? null : null))
const parent = computed(() => (article.value?.parent ? store.articlesByName.get(article.value.parent) ?? null : null))
// BAT de l'article (instantané, consultables hors-ligne), du plus récent au plus ancien.
const bats = computed(() => [...(store.batsByArticle.get(props.id) ?? [])].sort((a, b) => b.modified.localeCompare(a.modified)))
const ticketQuery = (type?: string) => ({ name: 'NewTicket', query: { client: article.value?.client, article: props.id, ...(type ? { type } : {}) } })
const sousArticlesLocaux = computed(() => store.articles.filter((a) => a.parent === props.id))

const essentiels = computed(() => {
	const a = article.value
	if (!a) return []
	return [
		['Procédé', a.procede],
		['Dimensions H x L', a.dimensions],
		['Support', a.support],
		['Groupe', a.groupe],
		['Consommation annuelle', a.consommation_annuelle ? new Intl.NumberFormat('fr-FR').format(a.consommation_annuelle) : null],
	].filter(([, v]) => v) as [string, string][]
})

// Historique : en ligne, puis gardé pour la consultation hors-ligne.
const history = ref<ArticleHistory | null>(null)
const loadingHistory = ref(false)
const historyError = ref<string | null>(null)
async function loadHistory() {
	// Pas encore créé côté serveur : aucun historique à demander.
	if (isLocal(props.id)) return
	loadingHistory.value = true
	historyError.value = null
	history.value = await store.cachedHistory(props.id)
	try {
		history.value = await store.fetchHistory(props.id)
	} catch (error) {
		historyError.value = (error as Error).message
	} finally {
		loadingHistory.value = false
	}
}
watch(() => props.id, loadHistory, { immediate: true })
</script>

<template>
	<div v-if="!article" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Article introuvable" :back="{ name: 'Clients' }" />
		Cet article n'est pas sur cet appareil.
	</div>
	<div v-else>
		<PageHeader :title="article.designation" :subtitle="isLocal(article.name) ? 'Code attribué à l\'envoi' : article.name" :back="{ name: 'Client', params: { id: article.client } }" />

		<RouterLink v-if="client" :to="{ name: 'Client', params: { id: client.name } }" class="mb-3 block text-sm text-accent">{{ client.customer_name }}</RouterLink>

		<img v-if="article.image" :src="fileUrl(article.image) || undefined" :alt="article.designation" class="mb-4 max-h-64 w-full rounded-xl border border-outline-gray-2 bg-surface-white object-contain" loading="lazy" />

		<section class="card mb-4 divide-y divide-outline-gray-1">
			<div v-if="article.code_client" class="flex justify-between gap-4 px-3 py-2.5 text-sm">
				<span class="text-ink-gray-6">Réf. article client</span><span class="text-right font-medium">{{ article.code_client }}</span>
			</div>
			<div v-for="[label, value] in essentiels" :key="label" class="flex justify-between gap-4 px-3 py-2.5 text-sm">
				<span class="text-ink-gray-6">{{ label }}</span><span class="text-right font-medium">{{ value }}</span>
			</div>
			<div v-if="article.bat" class="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
				<span class="text-ink-gray-6">Dernier BAT</span>
				<span class="flex items-center gap-2"><StatusPill :status="article.bat.status" /><span class="text-ink-gray-6">{{ formatDay(article.bat.date) }}</span></span>
			</div>
			<div v-if="parent" class="flex justify-between gap-4 px-3 py-2.5 text-sm">
				<span class="text-ink-gray-6">Article parent</span>
				<RouterLink :to="{ name: 'Article', params: { id: parent.name } }" class="text-right font-medium text-accent">{{ parent.designation }}</RouterLink>
			</div>
		</section>

		<div class="quick-actions mb-4">
			<RouterLink :to="ticketQuery('Bon de commande')" class="quick-action"><LucideRepeat aria-hidden="true" />Retirage</RouterLink>
			<RouterLink :to="ticketQuery('Demande de devis')" class="quick-action"><LucideCalculator aria-hidden="true" />Devis</RouterLink>
			<RouterLink :to="ticketQuery()" class="quick-action"><LucideTicket aria-hidden="true" />Ticket</RouterLink>
		</div>

		<section v-if="bats.length" class="mb-4">
			<h2 class="section-title mb-2">BAT</h2>
			<div class="space-y-2">
				<div v-for="b in bats" :key="b.name">
					<p class="mb-1 flex items-center justify-between gap-2 text-sm">
						<span class="font-medium">{{ b.code_bat_client || b.name }} · {{ formatDay(b.date) }}</span>
						<StatusPill :status="b.status === 'Nouveau' ? 'BAT en cours' : b.status" />
					</p>
					<OfflineFile v-if="b.image" :path="b.image" :label="`Image du BAT ${b.name}`" image />
					<OfflineFile v-if="b.fichier_valide" :path="b.fichier_valide" :label="`Fichier validé${b.valide_par_nom ? ` (${b.valide_par_nom})` : ''}`" class="mt-2" />
				</div>
			</div>
		</section>

		<div v-if="article.fiche_technique || article.trace_decoupe" class="mb-4 space-y-2">
			<OfflineFile v-if="article.fiche_technique" :path="article.fiche_technique" label="Fiche technique" />
			<OfflineFile v-if="article.trace_decoupe" :path="article.trace_decoupe" label="Tracé forme de découpe" />
		</div>

		<section v-for="section in article.caracteristiques" :key="section.section" class="mb-4">
			<h2 class="section-title mb-2">{{ section.section }}</h2>
			<div class="card divide-y divide-outline-gray-1">
				<div v-for="item in section.valeurs" :key="item.label" class="flex justify-between gap-4 px-3 py-2.5 text-sm">
					<span class="text-ink-gray-6">{{ item.label }}</span><span class="text-right font-medium">{{ item.valeur }}</span>
				</div>
			</div>
		</section>

		<section v-if="sousArticlesLocaux.length" class="mb-4">
			<h2 class="section-title mb-2">Sous-articles</h2>
			<div class="space-y-2">
				<RouterLink v-for="s in sousArticlesLocaux" :key="s.name" :to="{ name: 'Article', params: { id: s.name } }" class="card-link p-3">
					<p class="font-medium">{{ s.designation }}</p>
					<p class="text-sm text-ink-gray-6">{{ s.name }}</p>
				</RouterLink>
			</div>
		</section>

		<section class="mb-4">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="section-title">Historique de l'article</h2>
				<span v-if="history" class="text-xs text-ink-gray-6">mis à jour : {{ relativeDays(history.fetched_at).toLowerCase() }}</span>
			</div>
			<p v-if="loadingHistory && !history" class="text-sm text-ink-gray-6">Chargement…</p>
			<p v-else-if="!history && !store.online" class="text-sm text-ink-gray-6">Historique non consulté sur cet appareil : il se chargera dès le retour du réseau.</p>
			<p v-else-if="historyError && !history" class="text-sm text-ink-red-3">{{ historyError }}</p>

			<template v-if="history">
				<h3 class="mb-1 mt-3 text-xs font-medium uppercase text-ink-gray-6">Devis</h3>
				<p v-if="!history.devis.length" class="text-sm text-ink-gray-6">Aucun devis.</p>
				<div v-for="d in history.devis" :key="d.name" class="card mb-2 p-3 text-sm">
					<div class="flex justify-between gap-2">
						<RouterLink v-if="store.devisByName.has(d.name)" :to="{ name: 'Devis', params: { id: d.name } }" class="font-medium text-accent">{{ d.name }}</RouterLink>
						<span v-else class="font-medium">{{ d.name }}</span><StatusPill :status="d.statut_commande || d.status" /></div>
					<p class="text-ink-gray-6">{{ formatDay(d.date) }} · {{ d.qty }} × {{ formatMoney(d.rate, d.currency) }}</p>
				</div>

				<h3 class="mb-1 mt-3 text-xs font-medium uppercase text-ink-gray-6">Commandes</h3>
				<p v-if="!history.commandes.length" class="text-sm text-ink-gray-6">Aucune commande.</p>
				<div v-for="c in history.commandes" :key="c.name" class="card mb-2 p-3 text-sm">
					<div class="flex justify-between gap-2">
						<RouterLink v-if="store.commandesByName.has(c.name)" :to="{ name: 'Commande', params: { id: c.name } }" class="font-medium text-accent">{{ c.name }}</RouterLink>
						<span v-else class="font-medium">{{ c.name }}</span><StatusPill :status="c.status" /></div>
					<p class="text-ink-gray-6">
						{{ formatDay(c.date) }} · {{ c.qty }} × {{ formatMoney(c.rate, c.currency) }}<template v-if="c.bon_commande_client"> · BC {{ c.bon_commande_client }}</template>
					</p>
					<p v-if="c.delivery_date" class="text-ink-gray-6">Livraison prévue {{ formatDay(c.delivery_date) }} · livré {{ Math.round(c.per_delivered || 0) }} %</p>
				</div>

				<h3 class="mb-1 mt-3 text-xs font-medium uppercase text-ink-gray-6">Historique des BAT</h3>
				<p v-if="!history.bat.length" class="text-sm text-ink-gray-6">Aucun BAT.</p>
				<div v-for="b in history.bat" :key="b.name" class="card mb-2 p-3 text-sm">
					<div class="flex justify-between gap-2"><span class="font-medium">{{ b.code_bat_client || b.name }}</span><StatusPill :status="b.status" /></div>
					<p class="text-ink-gray-6">{{ formatDay(b.date) }}<template v-if="b.valide_par_nom"> · validé par {{ b.valide_par_nom }}</template></p>
				</div>

				<h3 class="mb-1 mt-3 text-xs font-medium uppercase text-ink-gray-6">Maquettes</h3>
				<p v-if="!history.maquettes.length" class="text-sm text-ink-gray-6">Aucune maquette.</p>
				<div v-for="m in history.maquettes" :key="m.name" class="card mb-2 p-3 text-sm">
					<div class="flex justify-between gap-2"><span class="font-medium">{{ m.name }}<template v-if="m.ver"> · v{{ m.ver }}</template></span><StatusPill :status="m.status" /></div>
					<p v-if="m.mode_couleur || m.resume_couleurs" class="text-ink-gray-6">{{ [m.mode_couleur, m.resume_couleurs].filter(Boolean).join(' · ') }}</p>
					<img v-if="m.fichier_maquette" :src="fileUrl(m.fichier_maquette) || undefined" :alt="`Maquette ${m.name}`" class="mt-2 max-h-56 w-full rounded-lg object-contain" loading="lazy" />
				</div>

				<h3 class="mb-1 mt-3 text-xs font-medium uppercase text-ink-gray-6">Réclamations récentes du client</h3>
				<p v-if="!history.reclamations_client.length" class="text-sm text-ink-gray-6">Aucune réclamation.</p>
				<div v-for="r in history.reclamations_client" :key="r.name" class="card mb-2 p-3 text-sm">
					<div class="flex justify-between gap-2"><span class="font-medium">{{ r.type_reclamation || r.name }}</span><StatusPill :status="r.status" /></div>
					<p class="text-ink-gray-6">{{ formatDay(r.date_creation) }}<template v-if="r.procede"> · {{ r.procede }}</template></p>
				</div>
			</template>
		</section>
	</div>
</template>
