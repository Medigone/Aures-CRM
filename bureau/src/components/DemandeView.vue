<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideCheck from '~icons/lucide/check'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import DemandeActions from './DemandeActions.vue'
import DemandeLinesTable from './DemandeLinesTable.vue'
import TagEditor from './TagEditor.vue'
import { demandeActivity } from '@/lib/api'
import { demandeNext, demandeSteps, typeLabel, type DemandeAction, type DemandeStep } from '@/lib/demandes'
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
const steps = computed(() => (demande.value ? demandeSteps(demande.value) : []))
const next = computed(() => (demande.value ? demandeNext(demande.value) : null))
function openStep(step: DemandeStep) {
	emit('tab', step.key === 'demande' ? 'articles' : 'etudes')
}

// Boutons de la colonne : l'action principale d'abord. Le reste passe dans le menu.
const LABELS: Record<DemandeAction, string> = { confirm: 'Confirmer', edit: 'Modifier', devis: 'Créer le devis', close: 'Fermer', retirage: 'Créer un retirage', cancel: 'Annuler la demande' }
const sideActions = computed(() => (demande.value?.actions ?? []).filter((action) => action !== 'cancel' || demande.value!.actions.length === 1).slice(0, 2))
const menuActions = computed(() => (demande.value?.actions ?? []).filter((action) => !sideActions.value.includes(action)))
const isPrimary = (action: DemandeAction) => ['confirm', 'devis'].includes(action)

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
			<div class="client-dossier with-activity">
				<aside class="card client-side" aria-label="Identité de la demande">
					<div class="side-block gap-2">
						<h2 class="page-title leading-tight tabular-nums">{{ demande.name }}</h2>
						<div class="flex flex-wrap items-center gap-1.5">
							<StatusPill :status="demande.status" />
							<span class="urgence" :class="`urgence-${demande.urgence}`">{{ demande.urgence }}</span>
						</div>
						<p class="text-sm text-ink-gray-7">{{ [typeLabel(demande.type), demande.procede].filter(Boolean).join(' · ') }}</p>
						<TagEditor doctype="Demande Faisabilite" :name="demande.name" :modified="demande.modified" :tags="demande.tags" :can-edit="demande.can_write" @changed="onTags" />
						<div class="mt-1 flex items-center gap-1.5">
							<button v-for="(action, index) in sideActions" :key="action" type="button" :class="[isPrimary(action) ? 'btn-primary' : 'btn-secondary', index === 0 && 'flex-auto']" :disabled="busy" @click="actions?.run(action)">{{ LABELS[action] }}</button>
							<MoreMenu>
								<button v-for="action in menuActions" :key="action" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="actions?.run(action)">{{ LABELS[action] }}</button>
								<div v-if="menuActions.length" class="app-menu-sep"></div>
								<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
								<a class="app-menu-item" role="menuitem" :href="deskUrl('Demande Faisabilite', demande.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
							</MoreMenu>
						</div>
					</div>
					<div class="side-block">
						<p class="side-label">Client</p>
						<p><RouterLink class="ref-link font-semibold" :to="{ name: 'Client', params: { id: demande.client } }">{{ demande.client_label }}</RouterLink></p>
						<p class="text-ink-gray-6">{{ [demande.wilaya, demande.commercial].filter(Boolean).join(' · ') || 'Non attribué' }}</p>
					</div>
					<div class="side-block">
						<dl class="side-kv">
							<div><dt>Livraison souhaitée</dt><dd class="tabular-nums">{{ formatDay(demande.livraison) || '—' }}</dd></div>
							<div><dt>Créée le</dt><dd class="tabular-nums">{{ formatDay(demande.creation) || '—' }}</dd></div>
							<div><dt>Créée par</dt><dd>{{ demande.cree_par || '—' }}</dd></div>
							<div><dt>Ticket</dt><dd v-if="demande.ticket"><RouterLink class="ref-link tabular-nums" :to="{ name: 'Ticket', params: { id: demande.ticket } }">{{ demande.ticket }}</RouterLink></dd><dd v-else class="font-normal text-ink-gray-6">Aucun</dd></div>
							<div v-if="demande.bon_commande"><dt>Bon de commande</dt><dd class="tabular-nums">{{ demande.bon_commande }}</dd></div>
							<div v-if="demande.demande_origin"><dt>Demande d'origine</dt><dd><RouterLink class="ref-link tabular-nums" :to="{ name: 'Demande', params: { id: demande.demande_origin } }">{{ demande.demande_origin }}</RouterLink></dd></div>
						</dl>
					</div>
				</aside>

				<div class="client-main">
					<div class="record-tabs" role="tablist">
						<button v-for="item in tabs" :key="item.key" type="button" class="record-tab" role="tab" :aria-selected="activeTab === item.key" @click="emit('tab', item.key)">
							{{ item.label }}<span v-if="item.count !== undefined" class="ml-1 tabular-nums text-ink-gray-6">{{ item.count }}</span><span v-if="item.todo" class="tab-todo" title="Une étape à faire"><span class="sr-only">, une étape à faire</span></span>
						</button>
					</div>
					<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>

					<div v-if="activeTab === 'apercu'" class="bureau-center">
						<section class="card" aria-label="Avancement de la demande">
							<div class="pp-chain">
								<button v-for="step in steps" :key="step.key" type="button" class="pp-step" :data-next="!step.done" @click="openStep(step)">
									<span class="pp-mark" :class="!step.done && !step.next && 'pp-mark-later'" :data-todo="step.next" aria-hidden="true"><LucideCheck v-if="step.done" class="h-3.5 w-3.5" /></span>
									<b>{{ step.label }}</b>
									<span class="pp-step-sub" :class="step.next && 'font-medium text-tone-amber'">{{ step.sub }}</span>
								</button>
							</div>
						</section>

						<section v-if="next" class="step-hero" aria-label="Prochaine étape">
							<span class="text-xs font-semibold text-selection-ink">{{ next.eyebrow }}</span>
							<h3 class="text-base font-semibold">{{ next.title }}</h3>
							<p class="text-selection-ink">{{ next.text }}</p>
							<div v-if="next.action || demande.actions.includes('edit')" class="mt-0.5 flex flex-wrap gap-1.5">
								<button v-if="next.action" type="button" class="btn-primary" :disabled="busy" @click="actions?.run(next!.action!)">{{ next.actionLabel }}</button>
								<button v-if="demande.actions.includes('edit')" type="button" class="btn-secondary" :disabled="busy" @click="actions?.run('edit')">Modifier</button>
							</div>
						</section>

						<section v-if="demande.etudes.length" class="card ref-card">
							<h3>{{ demande.status === 'Confirmée' || demande.status === 'En Cours' ? 'Études de faisabilité' : 'Résultat des études' }}</h3>
							<DemandeLinesTable :demande="demande" kind="etudes" :result-label="demande.status === 'Confirmée' || demande.status === 'En Cours' ? 'Statut' : 'Résultat'" />
						</section>
						<section v-else class="card ref-card">
							<h3>Articles demandés</h3>
							<DemandeLinesTable :demande="demande" kind="articles" />
						</section>
					</div>

					<div v-else-if="activeTab === 'articles'" class="bureau-center">
						<section class="card ref-card">
							<h3>Articles demandés</h3>
							<DemandeLinesTable :demande="demande" kind="articles" />
						</section>
					</div>

					<div v-else class="bureau-center">
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
				</div>

				<!-- Le fil reste visible, quel que soit l'onglet regardé. -->
				<aside class="record-activity" aria-label="Commentaires et activité de la demande">
					<ActivityFeed ref="feed" :api="activityApi" :version="demande.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
				</aside>
			</div>
			<DemandeActions ref="actions" :demande="demande" :busy="busy" :perform="perform" @error="actionError = $event" />
		</template>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</main>
</template>
