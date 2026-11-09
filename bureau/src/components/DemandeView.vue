<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideCalendar from '~icons/lucide/calendar'
import LucideFileText from '~icons/lucide/file-text'
import LucideRepeat from '~icons/lucide/repeat'
import LucideTicket from '~icons/lucide/ticket'
import LucideTruck from '~icons/lucide/truck'
import LucideUser from '~icons/lucide/user'
import LucideUserPlus from '~icons/lucide/user-plus'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import DemandeActions from './DemandeActions.vue'
import DemandeLinesTable from './DemandeLinesTable.vue'
import RecordHeader from './RecordHeader.vue'
import StepTimeline from './StepTimeline.vue'
import TagEditor from './TagEditor.vue'
import { demandeActivity } from '@/lib/api'
import { demandeNext, demandeOverview, demandeSteps, demandeTimeline, formatDraftQuantity, typeLabel, type DemandeAction, DEMANDE_ACTION_LABELS, demandeHeaderActions, isPrimaryDemandeAction } from '@/lib/demandes'
import { deskUrl, formatDay } from '@/lib/display'
import { useDemande } from '@/lib/useDemande'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ tab: [tab: string]; changed: [] }>()

const { demande, error, notFound, actionError, notice, noticeTone, busy, load, perform, refresh } = useDemande(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const actions = ref<InstanceType<typeof DemandeActions> | null>(null)
const activityApi = computed(() => demandeActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, demande })

const tabs = computed(() => {
	const record = demande.value
	const linked = record ? record.etudes.length + record.devis.length + record.commandes.length : 0
	return [
		{ key: 'apercu', label: 'Aperçu' },
		{ key: 'articles', label: 'Articles', count: record?.lines.length ?? 0 },
		{ key: 'etudes', label: 'Études et devis', count: linked, todo: record?.actions.includes('devis') && !record.devis.length },
	]
})
const activeTab = computed(() => (tabs.value.some((tab) => tab.key === props.tab) ? props.tab! : 'apercu'))
const overview = computed(() => (demande.value ? demandeOverview(demande.value) : null))
const timeline = computed(() => (demande.value ? demandeTimeline(demande.value) : null))
const next = computed(() => (demande.value ? demandeNext(demande.value) : null))
const tip = computed(() => (next.value ? `${next.value.title}. ${next.value.text}` : ''))
function openStep(index: number) {
	emit('tab', timeline.value?.steps[index]?.key === 'demande' ? 'articles' : 'etudes')
}
async function showActivity() {
	await nextTick()
	feed.value?.root?.scrollIntoView?.({ block: 'start' })
}
// Depuis l'aperçu : la fiche s'ouvre sur le fil.
watch(feed, (current) => {
	if (current && props.tab === 'activite') showActivity()
})

// Boutons de l'en-tête : la prochaine action d'abord. Le reste passe dans le menu.
const sideActions = computed(() => (demande.value ? demandeHeaderActions(demande.value) : []))
const menuActions = computed(() => (demande.value?.actions ?? []).filter((action) => !sideActions.value.includes(action)))

async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}
function onTags(tags: string[]) {
	if (demande.value) demande.value.tags = tags
	emit('changed')
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Cette demande n'existe pas ou n'existe plus.</div>
		<div v-else-if="!demande" class="card p-8 text-center text-ink-gray-6">Chargement de la demande…</div>

		<template v-else>
			<RecordHeader>
				<template #title><span class="tabular-nums">{{ demande.name }}</span></template>
				<template #flags>
					<StatusPill :status="demande.status" />
					<span class="urgence" :class="`urgence-${demande.urgence}`">{{ demande.urgence }}</span>
				</template>
				<template #sub>
					<RouterLink class="ref-link" :to="{ name: 'Client', params: { id: demande.client } }">{{ demande.client_label }}</RouterLink>
					<span v-if="demande.type">{{ typeLabel(demande.type) }}</span>
					<span v-if="demande.procede">{{ demande.procede }}</span>
					<div v-if="demande.tags.length || demande.can_write"><TagEditor doctype="Demande Faisabilite" :name="demande.name" :modified="demande.modified" :tags="demande.tags" :can-edit="demande.can_write" @changed="onTags" /></div>
				</template>
				<template #actions>
					<button v-for="action in sideActions" :key="action" type="button" :class="isPrimaryDemandeAction(action) ? 'btn-primary' : 'btn-secondary'" :disabled="busy" @click="actions?.run(action)">{{ DEMANDE_ACTION_LABELS[action] }}</button>
					<MoreMenu>
						<button v-for="action in menuActions" :key="action" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="actions?.run(action)">{{ DEMANDE_ACTION_LABELS[action] }}</button>
						<div v-if="menuActions.length" class="app-menu-sep"></div>
						<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
						<a class="app-menu-item" role="menuitem" :href="deskUrl('Demande Faisabilite', demande.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
					</MoreMenu>
				</template>
			</RecordHeader>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>

			<div class="ticket-dossier">
			<div class="bureau-detail demande-detail">
				<aside class="card record-rail" aria-label="Informations de la demande">
					<dl class="record-facts">
						<div><dt><LucideUser aria-hidden="true" />Commercial</dt><dd>{{ demande.commercial || 'Non attribué' }}</dd></div>
						<div><dt><LucideTruck aria-hidden="true" />Livraison souhaitée</dt><dd class="tabular-nums">{{ formatDay(demande.livraison) || '—' }}</dd></div>
						<div><dt><LucideTicket aria-hidden="true" />Ticket</dt><dd><RouterLink v-if="demande.ticket" class="ref-link tabular-nums" :to="{ name: 'Ticket', params: { id: demande.ticket } }">{{ demande.ticket }}</RouterLink><template v-else>Aucun</template></dd></div>
						<div><dt><LucideCalendar aria-hidden="true" />Créée le</dt><dd class="tabular-nums">{{ formatDay(demande.creation) || '—' }}</dd></div>
						<div><dt><LucideUserPlus aria-hidden="true" />Créée par</dt><dd>{{ demande.cree_par || '—' }}</dd></div>
						<div v-if="demande.bon_commande"><dt><LucideFileText aria-hidden="true" />Bon de commande</dt><dd class="tabular-nums">{{ demande.bon_commande }}</dd></div>
						<div v-if="demande.demande_origin"><dt><LucideRepeat aria-hidden="true" />Demande d'origine</dt><dd><RouterLink class="ref-link tabular-nums" :to="{ name: 'Demande', params: { id: demande.demande_origin } }">{{ demande.demande_origin }}</RouterLink></dd></div>
					</dl>
				</aside>
				<div class="bureau-center">
					<div class="record-tabs" role="tablist">
						<button v-for="item in tabs" :key="item.key" type="button" class="record-tab" role="tab" :aria-selected="activeTab === item.key" @click="emit('tab', item.key)">
							{{ item.label }}<span v-if="item.count !== undefined" class="ml-1 tabular-nums text-ink-gray-6">{{ item.count }}</span><span v-if="item.todo" class="tab-todo" title="Une étape à faire"><span class="sr-only">, une étape à faire</span></span>
						</button>
					</div>
					<!-- Aperçu : il résume les autres onglets. -->
					<div v-if="activeTab === 'apercu'" class="detail-tab">
						<section v-if="overview" class="card demande-resume">
							<div class="demande-resume-grid">
								<div class="ref-card">
									<div class="ref-card-head"><h3>Articles</h3><button type="button" class="ref-link" @click="emit('tab', 'articles')">Tout voir</button></div>
									<dl>
										<div><dt>Articles demandés</dt><dd>{{ overview.articles }}</dd></div>
										<div><dt>Quantité totale</dt><dd>{{ formatDraftQuantity(String(overview.quantity)) }}</dd></div>
										<div><dt>Créations</dt><dd>{{ overview.creations }}</dd></div>
									</dl>
								</div>
								<div class="ref-card">
									<div class="ref-card-head"><h3>Études</h3><button type="button" class="ref-link" @click="emit('tab', 'etudes')">Tout voir</button></div>
									<dl>
										<div v-for="row in overview.studies" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.count }}</dd></div>
									</dl>
								</div>
								<div class="ref-card">
									<div class="ref-card-head"><h3>Devis et commandes</h3><button type="button" class="ref-link" @click="emit('tab', 'etudes')">Tout voir</button></div>
									<dl>
										<div v-if="demande.devis[0]"><dt><RouterLink class="ref-link inline-link" :title="demande.devis[0].name" :to="{ name: 'Devis', query: { apercu: demande.devis[0].name } }">{{ demande.devis[0].name }}</RouterLink></dt><dd><StatusPill :status="demande.devis[0].status" /></dd></div>
										<div v-else><dt>Devis</dt><dd class="demande-resume-none">Aucun</dd></div>
										<div><dt>Montant du devis</dt><dd :class="{ 'demande-resume-none': overview.devisAmount === '—' }">{{ overview.devisAmount }}</dd></div>
										<div v-if="demande.commandes[0]"><dt><a class="ref-link inline-link" :title="demande.commandes[0].name" :href="deskUrl('Sales Order', demande.commandes[0].name)" target="_blank" rel="noopener noreferrer">{{ demande.commandes[0].name }}</a></dt><dd><StatusPill :status="demande.commandes[0].status" /></dd></div>
										<div v-else><dt>Commande</dt><dd class="demande-resume-none">Aucune</dd></div>
									</dl>
								</div>
							</div>
						</section>
					</div>

					<div v-else-if="activeTab === 'articles'" class="detail-tab">
						<section class="card ref-card">
							<h3>Articles demandés</h3>
							<DemandeLinesTable :demande="demande" kind="articles" />
						</section>
					</div>

					<div v-else class="detail-tab">
						<section class="card ref-card">
							<h3>Études de faisabilité</h3>
							<DemandeLinesTable v-if="demande.etudes.length" :demande="demande" kind="etudes" />
							<p v-else class="text-ink-gray-6">Les études se créent à la confirmation de la demande.</p>
						</section>
						<section class="card ref-card">
							<h3>Devis</h3>
							<DemandeLinesTable v-if="demande.devis.length" :demande="demande" kind="devis" />
							<p v-else class="text-ink-gray-6">Aucun devis pour l'instant.</p>
						</section>
						<section class="card ref-card">
							<h3>Commandes</h3>
							<DemandeLinesTable v-if="demande.commandes.length" :demande="demande" kind="commandes" />
							<p v-else class="text-ink-gray-6">Aucune commande pour l'instant.</p>
						</section>
						<p class="text-xs text-ink-gray-6">Ces pièces s'ouvrent sur le Desk tant que leurs pages n'existent pas sur le poste de bureau.</p>
					</div>

					<!-- Le fil vient après le contenu, quel que soit l'onglet. -->
					<aside class="record-activity" aria-label="Commentaires et activité de la demande">
						<ActivityFeed ref="feed" :api="activityApi" :version="demande.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
					</aside>
				</div>

				<div class="bureau-side">
					<StepTimeline v-if="timeline" :steps="timeline.steps" :viewed="timeline.focus" :current="timeline.current" :focus="timeline.focus" :tip="tip" label="Étapes de la demande" @pick="openStep" />
				</div>
			</div>
			</div>
			<DemandeActions ref="actions" :demande="demande" :busy="busy" :perform="perform" @error="actionError = $event" />
		</template>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</main>
</template>
