<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideRepeat from '~icons/lucide/repeat'
import LucideCalculator from '~icons/lucide/calculator'
import LucidePencil from '~icons/lucide/pencil'
import LucideTriangleAlert from '~icons/lucide/triangle-alert'
import LucideChevronDown from '~icons/lucide/chevron-down'
import OfflineFile from '@/components/OfflineFile.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay, relativeDays } from '@/lib/format'
import { fileUrl, formatMoney } from '@/lib/text'
import { isLocal } from '@/lib/mutations'
import { ficheDoc, ficheGroups, formatFicheValue, groupTitle } from '@/lib/fiche'
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

// Fiche technique : seuls les groupes du procédé de l'article (conditions d'affichage du Desk), champs renseignés.
const groups = computed(() => (article.value ? ficheGroups(store.references?.fiche_article, ficheDoc(article.value, article.value.fiche)) : []))
const consommation = computed(() => (article.value?.consommation_annuelle ? new Intl.NumberFormat('fr-FR').format(article.value.consommation_annuelle) : null))

// Historique replié par rubrique : on ouvre celle dont on a besoin.
type Rubrique = 'devis' | 'commandes' | 'bat' | 'maquettes' | 'reclamations'
const opened = ref<Rubrique | null>(null)
const toggle = (r: Rubrique) => (opened.value = opened.value === r ? null : r)

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
		<PageHeader :title="article.designation" :subtitle="client?.customer_name" :back="{ name: 'Client', params: { id: article.client } }">
			<template #actions>
				<RouterLink :to="{ name: 'EditArticle', params: { id: article.name } }" class="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-semibold text-on-primary">
					<LucidePencil class="h-4 w-4" aria-hidden="true" />Modifier
				</RouterLink>
			</template>
		</PageHeader>

		<p class="-mt-2 mb-3 text-sm text-ink-gray-6">
			<template v-if="isLocal(article.name)"><span class="pending-dot mr-1" />Code attribué à l'envoi</template>
			<template v-else>{{ article.name }}</template>
			<template v-if="article.code_client"> · réf. client {{ article.code_client }}</template>
			<span v-if="article._pending && !isLocal(article.name)" class="ml-1 inline-flex items-center gap-1"><span class="pending-dot" />modifié</span>
		</p>
		<div class="mb-4 flex flex-wrap gap-1.5">
			<span v-if="article.procede" class="badge bg-primary font-semibold text-on-primary">{{ article.procede }}</span>
			<StatusPill v-if="article.bat" :status="article.bat.status === 'Nouveau' ? 'BAT en cours' : article.bat.status" />
			<span v-if="article.sous_article" class="badge bg-surface-gray-3 font-semibold text-ink-gray-7">Sous-article</span>
			<span v-if="article.compose" class="badge bg-surface-gray-3 font-semibold text-ink-gray-7">Article composé</span>
		</div>

		<img v-if="article.image" :src="fileUrl(article.image) || undefined" :alt="article.designation" class="mb-4 max-h-64 w-full rounded-[20px] bg-surface-white object-contain" loading="lazy" />

		<div class="mb-6 grid grid-cols-3 gap-2">
			<RouterLink :to="ticketQuery('Bon de commande')" class="card flex flex-col items-center gap-1.5 !rounded-2xl px-1.5 py-3 text-xs font-semibold active:scale-[0.98]"><LucideRepeat class="h-5 w-5" aria-hidden="true" />Retirage</RouterLink>
			<RouterLink :to="ticketQuery('Demande de devis')" class="card flex flex-col items-center gap-1.5 !rounded-2xl px-1.5 py-3 text-xs font-semibold active:scale-[0.98]"><LucideCalculator class="h-5 w-5" aria-hidden="true" />Devis</RouterLink>
			<RouterLink :to="ticketQuery('Réclamation')" class="card flex flex-col items-center gap-1.5 !rounded-2xl px-1.5 py-3 text-xs font-semibold active:scale-[0.98]"><LucideTriangleAlert class="h-5 w-5" aria-hidden="true" />Réclamation</RouterLink>
		</div>

		<section class="mb-6 space-y-2.5">
			<div class="flex items-baseline justify-between">
				<h2 class="section-title">Fiche technique{{ article.procede ? ` ${article.procede}` : '' }}</h2>
				<span class="text-xs text-ink-gray-6">champs vides masqués</span>
			</div>
			<p v-if="!groups.length && !consommation" class="text-sm text-ink-gray-6">Fiche technique non renseignée.</p>
			<div v-for="g in groups" :key="g.label" class="card overflow-hidden">
				<p class="px-4 pb-1.5 pt-3.5 text-xs font-semibold uppercase tracking-wide text-ink-gray-6">{{ groupTitle(g.label) }}</p>
				<div v-for="r in g.rows" :key="r.field.fieldname" class="flex justify-between gap-4 border-t border-outline-gray-1 px-4 py-2.5 text-sm">
					<span class="text-ink-gray-6">{{ r.field.label }}</span><span class="text-right font-semibold">{{ formatFicheValue(r.field, r.value) }}</span>
				</div>
				<div v-if="g.checks.length" class="flex flex-wrap gap-1.5 border-t border-outline-gray-1 px-4 py-3">
					<span v-for="c in g.checks" :key="c.fieldname" class="rounded-full bg-surface-gray-2 px-3 py-1.5 text-[13px] font-medium">{{ c.label }}</span>
				</div>
			</div>
			<div v-if="consommation || parent" class="card divide-y divide-outline-gray-1 overflow-hidden">
				<div v-if="consommation" class="flex justify-between gap-4 px-4 py-2.5 text-sm"><span class="text-ink-gray-6">Consommation annuelle</span><span class="font-semibold">{{ consommation }}</span></div>
				<div v-if="parent" class="flex justify-between gap-4 px-4 py-2.5 text-sm">
					<span class="text-ink-gray-6">Article parent</span>
					<RouterLink :to="{ name: 'Article', params: { id: parent.name } }" class="text-right font-semibold text-accent">{{ parent.designation }}</RouterLink>
				</div>
			</div>
		</section>

		<section v-if="article.fiche_technique || article.trace_decoupe" class="mb-6 space-y-2">
			<h2 class="section-title">Fichiers</h2>
			<OfflineFile v-if="article.fiche_technique" :path="article.fiche_technique" label="Fiche technique" />
			<OfflineFile v-if="article.trace_decoupe" :path="article.trace_decoupe" label="Tracé forme de découpe" />
		</section>

		<section v-if="bats.length" class="mb-6">
			<h2 class="section-title mb-2">BAT</h2>
			<div class="space-y-2">
				<div v-for="b in bats" :key="b.name" class="card p-3">
					<p class="mb-1 flex items-center justify-between gap-2 text-sm">
						<span class="font-medium">{{ b.code_bat_client || b.name }} · {{ formatDay(b.date) }}</span>
						<StatusPill :status="b.status === 'Nouveau' ? 'BAT en cours' : b.status" />
					</p>
					<OfflineFile v-if="b.image" :path="b.image" :label="`Image du BAT ${b.name}`" image />
					<OfflineFile v-if="b.fichier_valide" :path="b.fichier_valide" :label="`Fichier validé${b.valide_par_nom ? ` (${b.valide_par_nom})` : ''}`" class="mt-2" />
				</div>
			</div>
		</section>

		<section v-if="sousArticlesLocaux.length" class="mb-6">
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
				<h2 class="section-title">Historique</h2>
				<span v-if="history" class="text-xs text-ink-gray-6">mis à jour : {{ relativeDays(history.fetched_at).toLowerCase() }}</span>
			</div>
			<p v-if="isLocal(article.name)" class="text-sm text-ink-gray-6">Disponible une fois l'article envoyé.</p>
			<p v-else-if="loadingHistory && !history" class="text-sm text-ink-gray-6">Chargement…</p>
			<p v-else-if="!history && !store.online" class="text-sm text-ink-gray-6">Historique non consulté sur cet appareil : il se chargera dès le retour du réseau.</p>
			<p v-else-if="historyError && !history" class="text-sm text-ink-red-3">{{ historyError }}</p>

			<div v-if="history" class="card divide-y divide-outline-gray-1 overflow-hidden">
				<div>
					<button type="button" class="flex min-h-[54px] w-full items-center gap-3 px-4 text-left" :aria-expanded="opened === 'devis'" @click="toggle('devis')">
						<span class="flex-1 font-medium">Devis</span><span class="text-sm text-ink-gray-6">{{ history.devis.length }}</span>
						<LucideChevronDown class="h-[18px] w-[18px] text-ink-gray-6 transition" :class="opened === 'devis' && 'rotate-180'" aria-hidden="true" />
					</button>
					<div v-if="opened === 'devis'" class="space-y-2 px-4 pb-3">
						<p v-if="!history.devis.length" class="text-sm text-ink-gray-6">Aucun devis.</p>
						<div v-for="d in history.devis" :key="d.name" class="rounded-xl bg-surface-gray-1 p-3 text-sm dark:bg-surface-gray-2">
							<div class="flex justify-between gap-2">
								<RouterLink v-if="store.devisByName.has(d.name)" :to="{ name: 'Devis', params: { id: d.name } }" class="font-medium text-accent">{{ d.name }}</RouterLink>
								<span v-else class="font-medium">{{ d.name }}</span><StatusPill :status="d.statut_commande || d.status" />
							</div>
							<p class="text-ink-gray-6">{{ formatDay(d.date) }} · {{ d.qty }} × {{ formatMoney(d.rate, d.currency) }}</p>
						</div>
					</div>
				</div>
				<div>
					<button type="button" class="flex min-h-[54px] w-full items-center gap-3 px-4 text-left" :aria-expanded="opened === 'commandes'" @click="toggle('commandes')">
						<span class="flex-1 font-medium">Commandes</span><span class="text-sm text-ink-gray-6">{{ history.commandes.length }}</span>
						<LucideChevronDown class="h-[18px] w-[18px] text-ink-gray-6 transition" :class="opened === 'commandes' && 'rotate-180'" aria-hidden="true" />
					</button>
					<div v-if="opened === 'commandes'" class="space-y-2 px-4 pb-3">
						<p v-if="!history.commandes.length" class="text-sm text-ink-gray-6">Aucune commande.</p>
						<div v-for="c in history.commandes" :key="c.name" class="rounded-xl bg-surface-gray-1 p-3 text-sm dark:bg-surface-gray-2">
							<div class="flex justify-between gap-2">
								<RouterLink v-if="store.commandesByName.has(c.name)" :to="{ name: 'Commande', params: { id: c.name } }" class="font-medium text-accent">{{ c.name }}</RouterLink>
								<span v-else class="font-medium">{{ c.name }}</span><StatusPill :status="c.status" />
							</div>
							<p class="text-ink-gray-6">
								{{ formatDay(c.date) }} · {{ c.qty }} × {{ formatMoney(c.rate, c.currency) }}<template v-if="c.bon_commande_client"> · BC {{ c.bon_commande_client }}</template>
							</p>
							<p v-if="c.delivery_date" class="text-ink-gray-6">Livraison prévue {{ formatDay(c.delivery_date) }} · livré {{ Math.round(c.per_delivered || 0) }} %</p>
						</div>
					</div>
				</div>
				<div>
					<button type="button" class="flex min-h-[54px] w-full items-center gap-3 px-4 text-left" :aria-expanded="opened === 'bat'" @click="toggle('bat')">
						<span class="flex-1 font-medium">Historique des BAT</span><span class="text-sm text-ink-gray-6">{{ history.bat.length }}</span>
						<LucideChevronDown class="h-[18px] w-[18px] text-ink-gray-6 transition" :class="opened === 'bat' && 'rotate-180'" aria-hidden="true" />
					</button>
					<div v-if="opened === 'bat'" class="space-y-2 px-4 pb-3">
						<p v-if="!history.bat.length" class="text-sm text-ink-gray-6">Aucun BAT.</p>
						<div v-for="b in history.bat" :key="b.name" class="rounded-xl bg-surface-gray-1 p-3 text-sm dark:bg-surface-gray-2">
							<div class="flex justify-between gap-2"><span class="font-medium">{{ b.code_bat_client || b.name }}</span><StatusPill :status="b.status" /></div>
							<p class="text-ink-gray-6">{{ formatDay(b.date) }}<template v-if="b.valide_par_nom"> · validé par {{ b.valide_par_nom }}</template></p>
						</div>
					</div>
				</div>
				<div>
					<button type="button" class="flex min-h-[54px] w-full items-center gap-3 px-4 text-left" :aria-expanded="opened === 'maquettes'" @click="toggle('maquettes')">
						<span class="flex-1 font-medium">Maquettes</span><span class="text-sm text-ink-gray-6">{{ history.maquettes.length }}</span>
						<LucideChevronDown class="h-[18px] w-[18px] text-ink-gray-6 transition" :class="opened === 'maquettes' && 'rotate-180'" aria-hidden="true" />
					</button>
					<div v-if="opened === 'maquettes'" class="space-y-2 px-4 pb-3">
						<p v-if="!history.maquettes.length" class="text-sm text-ink-gray-6">Aucune maquette.</p>
						<div v-for="m in history.maquettes" :key="m.name" class="rounded-xl bg-surface-gray-1 p-3 text-sm dark:bg-surface-gray-2">
							<div class="flex justify-between gap-2"><span class="font-medium">{{ m.name }}<template v-if="m.ver"> · v{{ m.ver }}</template></span><StatusPill :status="m.status" /></div>
							<p v-if="m.mode_couleur || m.resume_couleurs" class="text-ink-gray-6">{{ [m.mode_couleur, m.resume_couleurs].filter(Boolean).join(' · ') }}</p>
							<img v-if="m.fichier_maquette" :src="fileUrl(m.fichier_maquette) || undefined" :alt="`Maquette ${m.name}`" class="mt-2 max-h-56 w-full rounded-lg object-contain" loading="lazy" />
						</div>
					</div>
				</div>
				<div>
					<button type="button" class="flex min-h-[54px] w-full items-center gap-3 px-4 text-left" :aria-expanded="opened === 'reclamations'" @click="toggle('reclamations')">
						<span class="flex-1 font-medium">Réclamations du client</span><span class="text-sm text-ink-gray-6">{{ history.reclamations_client.length }}</span>
						<LucideChevronDown class="h-[18px] w-[18px] text-ink-gray-6 transition" :class="opened === 'reclamations' && 'rotate-180'" aria-hidden="true" />
					</button>
					<div v-if="opened === 'reclamations'" class="space-y-2 px-4 pb-3">
						<p v-if="!history.reclamations_client.length" class="text-sm text-ink-gray-6">Aucune réclamation.</p>
						<div v-for="r in history.reclamations_client" :key="r.name" class="rounded-xl bg-surface-gray-1 p-3 text-sm dark:bg-surface-gray-2">
							<div class="flex justify-between gap-2"><span class="font-medium">{{ r.type_reclamation || r.name }}</span><StatusPill :status="r.status" /></div>
							<p class="text-ink-gray-6">{{ formatDay(r.date_creation) }}<template v-if="r.procede"> · {{ r.procede }}</template></p>
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
</template>
