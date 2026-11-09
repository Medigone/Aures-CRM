<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideCalendar from '~icons/lucide/calendar'
import LucideCalendarClock from '~icons/lucide/calendar-clock'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import LucideSend from '~icons/lucide/send'
import LucideShoppingCart from '~icons/lucide/shopping-cart'
import LucideTicket from '~icons/lucide/ticket'
import LucideTruck from '~icons/lucide/truck'
import LucideUser from '~icons/lucide/user'
import LucideWallet from '~icons/lucide/wallet'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import DevisActions from './DevisActions.vue'
import RecordHeader from './RecordHeader.vue'
import StepTimeline from './StepTimeline.vue'
import TagEditor from './TagEditor.vue'
import { devisActivity } from '@/lib/api'
import { commandeLink } from '@/lib/commandes'
import { DEVIS_DOCTYPE, devisPdfUrl, envoiText, devisStage, devisTimeline, devisTip, devisTypeLabel, moneyText, parsePrice, quantityText, type DevisLine } from '@/lib/devis'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import { useDevis } from '@/lib/useDevis'

const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ changed: [] }>()

const { devis, error, notFound, actionError, notice, noticeTone, busy, load, refresh, setPrice, setValidity, validate, order, lose, cancel, markSent } = useDevis(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const actions = ref<InstanceType<typeof DevisActions> | null>(null)
const activityApi = computed(() => devisActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, devis })

watch(feed, async (current) => {
	if (!current || props.tab !== 'activite') return
	await nextTick()
	current.root?.scrollIntoView?.({ block: 'start' })
})

const canSeeDemande = canRead('Demande Faisabilite')
const canSeeTicket = canRead('Ticket Commercial')
const canSeeClient = canRead('Customer')
const canSeeCommande = canRead('Sales Order')
const has = (action: string) => Boolean(devis.value?.actions.includes(action as never))
const editable = computed(() => has('prix'))
const prices = computed(() => Boolean(devis.value?.lignes.some((line) => line.prix !== null)))
const stage = computed(() => (devis.value ? devisStage({ status: devis.value.status, lignes: devis.value.lignes.length, chiffrees: devis.value.chiffrees, envoye_le: devis.value.envoi?.le }) : null))
const timeline = computed(() => (devis.value ? devisTimeline(devis.value) : null))
const tip = computed(() => (devis.value ? devisTip(devis.value) : ''))

// Une saisie par ligne : le texte tapé reste tant qu'il n'est pas enregistré.
const drafts = reactive<Record<string, string>>({})
const invalid = reactive<Record<string, boolean>>({})
watch(
	() => devis.value?.lignes,
	(lines) => {
		for (const line of lines ?? []) {
			drafts[line.name] = line.chiffree && line.prix !== null ? moneyText(line.prix) : ''
			invalid[line.name] = false
		}
	},
	{ immediate: true },
)
async function savePrice(line: DevisLine) {
	const text = drafts[line.name] ?? ''
	const value = parsePrice(text)
	invalid[line.name] = text.trim() !== '' && value === null
	if (invalid[line.name]) return
	const next = value ?? 0
	if (next === (line.prix ?? 0)) {
		drafts[line.name] = next ? moneyText(next) : ''
		return
	}
	await setPrice(line.name, next)
}
async function saveValidity(event: Event) {
	const value = (event.target as HTMLInputElement).value
	if (value && value !== devis.value?.valable) await setValidity(value)
}

const commandeCreee = ref('')
async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}
function onTags(tags: string[]) {
	if (devis.value) devis.value.tags = tags
	emit('changed')
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Ce devis n'existe pas ou n'existe plus.</div>
		<div v-else-if="!devis" class="card p-8 text-center text-ink-gray-6">Chargement du devis…</div>

		<template v-else>
			<RecordHeader>
				<template #title><span class="tabular-nums">{{ devis.name }}</span></template>
				<template #flags>
					<span v-if="stage" class="list-tag" :class="stage.tone">{{ stage.label }}</span>
					<StatusPill v-else :status="devis.status" />
					<span class="urgence" :class="`urgence-${devis.urgence}`">{{ devis.urgence }}</span>
				</template>
				<template #sub>
					<RouterLink v-if="canSeeClient" class="ref-link" :to="{ name: 'Client', params: { id: devis.client } }">{{ devis.client_label }}</RouterLink>
					<span v-else>{{ devis.client_label }}</span>
					<span>{{ devisTypeLabel(devis.type) }}</span>
					<span class="tabular-nums">{{ devis.lignes.length }} article{{ devis.lignes.length > 1 ? 's' : '' }}</span>
					<div v-if="devis.tags.length || devis.can_write"><TagEditor :doctype="DEVIS_DOCTYPE" :name="devis.name" :modified="devis.modified" :tags="devis.tags" :can-edit="devis.can_write" @changed="onTags" /></div>
				</template>
				<template #actions>
					<button v-if="has('valider')" type="button" class="btn-primary" :disabled="busy || devis.blocked.length > 0" :title="devis.blocked.join(' ') || undefined" @click="actions?.run('valider')">Valider le devis</button>
					<button v-if="has('envoye')" type="button" class="btn-secondary" :disabled="busy" @click="actions?.run('envoye')">Marquer envoyé</button>
					<button v-if="has('commande')" type="button" class="btn-primary" :disabled="busy" @click="actions?.run('commande')">Créer la commande</button>
					<a v-if="devis.can_print" class="btn-secondary" :href="devisPdfUrl(devis.name)" target="_blank" rel="noopener noreferrer">Voir le PDF</a>
					<MoreMenu>
						<template v-if="has('perdu') || has('annuler')">
							<button v-if="has('perdu')" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="actions?.run('perdu')">Marquer perdu…</button>
							<button v-if="has('annuler')" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="actions?.run('annuler')">Annuler le devis…</button>
							<div class="app-menu-sep"></div>
						</template>
						<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
						<a class="app-menu-item" role="menuitem" :href="deskUrl(DEVIS_DOCTYPE, devis.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
					</MoreMenu>
				</template>
			</RecordHeader>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>
			<p v-if="devis.perte" class="flex-none rounded-control tone-red px-3.5 py-2.5">Perdu · {{ devis.perte.raisons.join(', ') || 'raison non précisée' }}<template v-if="devis.perte.precisions"> · {{ devis.perte.precisions }}</template></p>

			<div class="ticket-dossier">
				<div class="bureau-detail demande-detail">
					<aside class="card record-rail" aria-label="Informations du devis">
						<dl class="record-facts">
							<div><dt><LucideBuilding2 aria-hidden="true" />Client</dt><dd><RouterLink v-if="canSeeClient" class="ref-link" :to="{ name: 'Client', params: { id: devis.client } }">{{ devis.client_label }}</RouterLink><template v-else>{{ devis.client_label }}</template></dd></div>
							<div><dt><LucideUser aria-hidden="true" />Commercial</dt><dd :class="!devis.commercial && 'record-fact-none'">{{ devis.commercial || 'Non attribué' }}</dd></div>
							<div><dt><LucideClipboardList aria-hidden="true" />Demande</dt>
								<dd v-if="devis.demande"><RouterLink v-if="canSeeDemande" class="ref-link tabular-nums" :to="{ name: 'Demande', params: { id: devis.demande } }">{{ devis.demande }}</RouterLink><span v-else class="tabular-nums">{{ devis.demande }}</span></dd>
								<dd v-else class="record-fact-none">Aucune</dd>
							</div>
							<div v-if="devis.ticket"><dt><LucideTicket aria-hidden="true" />Ticket</dt><dd><RouterLink v-if="canSeeTicket" class="ref-link tabular-nums" :to="{ name: 'Ticket', params: { id: devis.ticket } }">{{ devis.ticket }}</RouterLink><span v-else class="tabular-nums">{{ devis.ticket }}</span></dd></div>
							<div><dt><LucideCalendar aria-hidden="true" />Date du devis</dt><dd class="tabular-nums">{{ formatDay(devis.date) || '—' }}</dd></div>
							<div>
								<dt><LucideCalendarClock aria-hidden="true" /><label for="devis-valable">Valable jusqu'au</label></dt>
								<dd v-if="editable"><input id="devis-valable" class="field-input devis-date" type="date" :value="devis.valable || ''" :min="devis.date || undefined" :disabled="busy" @change="saveValidity" /></dd>
								<dd v-else class="tabular-nums">{{ formatDay(devis.valable) || '—' }}</dd>
							</div>
							<div><dt><LucideTruck aria-hidden="true" />Livraison souhaitée</dt><dd class="tabular-nums" :class="!devis.livraison && 'record-fact-none'">{{ formatDay(devis.livraison) || '—' }}</dd></div>
							<div v-if="devis.docstatus === 1"><dt><LucideSend aria-hidden="true" />Envoi au client</dt><dd :class="!devis.envoi && 'record-fact-none'">{{ devis.envoi ? envoiText(devis.envoi) : 'Pas encore envoyé' }}</dd></div>
							<div v-if="devis.commandes.length">
								<dt><LucideShoppingCart aria-hidden="true" />{{ devis.commandes.length > 1 ? 'Commandes' : 'Commande' }}</dt>
								<dd class="flex flex-col">
									<template v-for="sale in devis.commandes" :key="sale.name">
										<RouterLink v-if="canSeeCommande" class="ref-link tabular-nums" :to="commandeLink(sale.name)">{{ sale.name }}</RouterLink>
										<span v-else class="tabular-nums">{{ sale.name }}</span>
									</template>
								</dd>
							</div>
							<div><dt><LucideWallet aria-hidden="true" />Total TTC</dt><dd class="tabular-nums">{{ moneyText(devis.total_ttc) }} DA</dd></div>
						</dl>
					</aside>

					<div class="bureau-center">
						<section class="card ref-card">
							<div class="ref-card-head">
								<h3>Lignes du devis</h3>
								<span class="text-sm tabular-nums text-ink-gray-6">{{ devis.chiffrees }} prix sur {{ devis.lignes.length }}</span>
							</div>
							<div class="ref-scroll">
								<table class="ref-table">
									<thead>
										<tr><th>Article</th><th class="end">Quantité</th><th v-if="prices" class="end">Prix unitaire HT</th><th v-if="prices" class="end">Montant HT</th></tr>
									</thead>
									<tbody>
										<tr v-for="line in devis.lignes" :key="line.name">
											<td class="!whitespace-normal">
												<RouterLink class="ref-link" :to="{ name: 'Article', params: { id: line.article } }">{{ line.designation }}</RouterLink>
												<span class="block text-xs text-ink-gray-6 tabular-nums">{{ line.article }}</span>
											</td>
											<td class="end tabular-nums">{{ quantityText(line.quantite) }}</td>
											<td v-if="prices" class="end">
												<template v-if="editable">
													<input
														v-model="drafts[line.name]"
														class="field-input devis-price"
														:class="!line.chiffree && 'is-missing'"
														inputmode="decimal"
														placeholder="À saisir"
														:aria-label="`Prix unitaire HT de ${line.designation}`"
														:aria-invalid="invalid[line.name] ? 'true' : undefined"
														:disabled="busy"
														@change="savePrice(line)"
														@keydown.enter="($event.target as HTMLInputElement).blur()"
													/>
													<span v-if="invalid[line.name]" role="alert" class="block text-xs text-tone-red">Saisissez un nombre, par exemple 8,70.</span>
												</template>
												<span v-else class="tabular-nums" :class="!line.chiffree && 'text-ink-gray-6'">{{ line.chiffree ? moneyText(line.prix) : 'Sans prix' }}</span>
											</td>
											<td v-if="prices" class="end tabular-nums" :class="!line.chiffree && 'text-ink-gray-6'">{{ line.chiffree ? moneyText(line.montant) : '—' }}</td>
										</tr>
									</tbody>
								</table>
							</div>
							<dl v-if="prices" class="devis-totals">
								<div><dt>Total HT</dt><dd>{{ moneyText(devis.total) }} DA</dd></div>
								<div><dt>Taxes</dt><dd>{{ moneyText(devis.taxes) }} DA</dd></div>
								<div class="devis-totals-grand"><dt>Total TTC</dt><dd>{{ moneyText(devis.total_ttc) }} DA</dd></div>
							</dl>
							<p v-else class="m-0 text-sm text-ink-gray-6">Les prix ne sont pas visibles pour votre rôle.</p>
						</section>

						<section v-if="devis.commandes.length" class="card ref-card">
							<div class="ref-card-head"><h3>Commandes</h3><span class="text-sm tabular-nums text-ink-gray-6">{{ devis.commandes.length }}</span></div>
							<div class="ref-scroll">
								<table class="ref-table">
									<thead><tr><th>Commande</th><th>Date</th><th>Statut</th><th class="end">Total (DA)</th></tr></thead>
									<tbody>
										<tr v-for="sale in devis.commandes" :key="sale.name">
											<td><RouterLink v-if="canSeeCommande" class="ref-link tabular-nums" :to="commandeLink(sale.name)">{{ sale.name }}</RouterLink><span v-else class="tabular-nums">{{ sale.name }}</span></td>
											<td class="tabular-nums">{{ formatDay(sale.date) || '—' }}</td>
											<td><StatusPill :status="sale.status" /></td>
											<td class="end tabular-nums">{{ sale.total === null ? '—' : moneyText(sale.total) }}</td>
										</tr>
									</tbody>
								</table>
							</div>
						</section>

						<aside class="record-activity" aria-label="Commentaires et activité du devis">
							<ActivityFeed ref="feed" :api="activityApi" :version="devis.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
						</aside>
					</div>

					<div class="bureau-side">
						<StepTimeline v-if="timeline" :steps="timeline.steps" :viewed="timeline.focus" :current="timeline.current" :focus="timeline.focus" :tip="tip" label="Étapes du devis" />
					</div>
				</div>
			</div>
			<DevisActions ref="actions" :devis="devis" :busy="busy" :validate="validate" :order="order" :lose="lose" :cancel="cancel" :mark-sent="markSent" @ordered="commandeCreee = $event" />
		</template>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
		<AppToast :message="commandeCreee ? `Commande ${commandeCreee} créée en brouillon.` : ''" :duration="0" @close="commandeCreee = ''">
			<RouterLink class="app-toast-action" :to="commandeLink(commandeCreee)" @click="commandeCreee = ''">Voir la commande</RouterLink>
		</AppToast>
	</main>
</template>
