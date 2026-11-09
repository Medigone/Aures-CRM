<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideBuilding2 from '~icons/lucide/building-2'
import LucideCalendar from '~icons/lucide/calendar'
import LucideClipboardList from '~icons/lucide/clipboard-list'
import LucideFactory from '~icons/lucide/factory'
import LucideFileCheck from '~icons/lucide/file-check'
import LucideFileText from '~icons/lucide/file-text'
import LucideHash from '~icons/lucide/hash'
import LucidePaperclip from '~icons/lucide/paperclip'
import LucideTicket from '~icons/lucide/ticket'
import LucideTruck from '~icons/lucide/truck'
import LucideUser from '~icons/lucide/user'
import LucideWallet from '~icons/lucide/wallet'
import ActivityFeed from '@shared/components/ActivityFeed.vue'
import FileUploader from '@shared/components/FileUploader.vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import type { UploadedFile } from '@shared/api'
import AppToast from './AppToast.vue'
import CommandeActions from './CommandeActions.vue'
import RecordHeader from './RecordHeader.vue'
import StepTimeline from './StepTimeline.vue'
import TagEditor from './TagEditor.vue'
import { commandeActivity } from '@/lib/api'
import { COMMANDE_DOCTYPE, commandeTimeline, commandeTip, isLate, moneyText, percentText, quantityText } from '@/lib/commandes'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import { useCommande } from '@/lib/useCommande'

/** Fiche d'une commande : bon de commande, validation, puis suivi jusqu'à la facture. */
const props = defineProps<{ id: string; tab?: string }>()
const emit = defineEmits<{ changed: [] }>()
const router = useRouter()

const { commande, error, notFound, actionError, notice, noticeTone, busy, load, refresh, setBon, setScan, validate, cancel, remove } = useCommande(
	() => props.id,
	() => emit('changed'),
)
const feed = ref<InstanceType<typeof ActivityFeed> | null>(null)
const actions = ref<InstanceType<typeof CommandeActions> | null>(null)
const activityApi = computed(() => commandeActivity(props.id))
const userName = window.user_fullname || window.user || ''
function refreshAll(message = '') {
	refresh(message)
	feed.value?.refresh()
}
defineExpose({ refresh: refreshAll, commande })

watch(feed, async (current) => {
	if (!current || props.tab !== 'activite') return
	await nextTick()
	current.root?.scrollIntoView?.({ block: 'start' })
})

const canSeeDevis = canRead('Quotation')
const canSeeDemande = canRead('Demande Faisabilite')
const canSeeTicket = canRead('Ticket Commercial')
const canSeeClient = canRead('Customer')
const has = (action: string) => Boolean(commande.value?.actions.includes(action as never))
const amounts = computed(() => commande.value?.total_ttc !== null && commande.value?.total_ttc !== undefined)
const timeline = computed(() => (commande.value ? commandeTimeline(commande.value) : null))
const tip = computed(() => (commande.value ? commandeTip(commande.value) : ''))
const late = computed(() => (commande.value ? isLate(commande.value) : false))
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

// Le n° se garde tant qu'il n'est pas enregistré ; il part en quittant le champ.
const bonDraft = ref('')
watch(
	() => commande.value?.bon_commande,
	(value) => {
		bonDraft.value = value ?? ''
	},
	{ immediate: true },
)
async function saveBon() {
	const value = bonDraft.value.trim()
	if (value === (commande.value?.bon_commande ?? '')) return
	await setBon({ bon_commande: value })
}
async function saveDateBon(event: Event) {
	const value = (event.target as HTMLInputElement).value
	if (value !== (commande.value?.date_bon ?? '')) await setBon({ date_bon: value })
}

const scanUploader = ref<InstanceType<typeof FileUploader> | null>(null)
function onScanUploaded(file: UploadedFile) {
	setScan(file.file_url)
}

async function removeDraft() {
	const result = await remove()
	if (!result) return
	const devis = (result as { devis: string | null }).devis
	router.push(devis && canSeeDevis ? { name: 'DevisFiche', params: { id: devis } } : { name: 'Commandes' })
}

async function copyLink() {
	try {
		await navigator.clipboard.writeText(window.location.href)
		notice.value = 'Lien de la fiche copié.'
	} catch {
		actionError.value = "Le navigateur a refusé la copie : copiez l'adresse de la page."
	}
}
function onTags(tags: string[]) {
	if (commande.value) commande.value.tags = tags
	emit('changed')
}
</script>

<template>
	<main class="bureau-main">
		<div v-if="error" role="alert" class="card p-3.5 text-tone-red">
			{{ error }}
			<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
		</div>
		<div v-else-if="notFound" class="card p-8 text-center text-ink-gray-6">Cette commande n'existe pas ou n'existe plus.</div>
		<div v-else-if="!commande" class="card p-8 text-center text-ink-gray-6">Chargement de la commande…</div>

		<template v-else>
			<RecordHeader>
				<template #title><span class="tabular-nums">{{ commande.name }}</span></template>
				<template #flags>
					<StatusPill :status="commande.status" />
					<span class="urgence" :class="`urgence-${commande.urgence}`">{{ commande.urgence }}</span>
				</template>
				<template #sub>
					<RouterLink v-if="canSeeClient" class="ref-link" :to="{ name: 'Client', params: { id: commande.client } }">{{ commande.client_label }}</RouterLink>
					<span v-else>{{ commande.client_label }}</span>
					<span v-if="commande.retirage">Retirage</span>
					<span class="tabular-nums">{{ commande.lignes.length }} article{{ commande.lignes.length > 1 ? 's' : '' }}</span>
					<span class="tabular-nums">{{ commande.bon_commande ? `BC ${commande.bon_commande}${commande.date_bon ? ` du ${formatDay(commande.date_bon)}` : ''}` : 'Bon de commande à saisir' }}</span>
					<div v-if="commande.tags.length || commande.can_write"><TagEditor :doctype="COMMANDE_DOCTYPE" :name="commande.name" :modified="commande.modified" :tags="commande.tags" :can-edit="commande.can_write" @changed="onTags" /></div>
				</template>
				<template #actions>
					<button v-if="has('valider')" type="button" class="btn-primary" :disabled="busy || commande.blocked.length > 0" :title="commande.blocked.join(' ') || undefined" @click="actions?.run('valider')">Valider la commande</button>
					<MoreMenu>
						<template v-if="(has('annuler') && !commande.annulation_bloquee) || has('supprimer')">
							<button v-if="has('annuler') && !commande.annulation_bloquee" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="actions?.run('annuler')">Annuler la commande…</button>
							<button v-if="has('supprimer')" type="button" class="app-menu-item text-tone-red" role="menuitem" :disabled="busy" @click="actions?.run('supprimer')">Supprimer le brouillon…</button>
							<div class="app-menu-sep"></div>
						</template>
						<button type="button" class="app-menu-item" role="menuitem" @click="copyLink">Copier le lien</button>
						<a v-if="commande.dossier" class="app-menu-item" role="menuitem" :href="deskUrl('Dossier Fabrication', commande.dossier.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir le dossier de fabrication</a>
						<a class="app-menu-item" role="menuitem" :href="deskUrl(COMMANDE_DOCTYPE, commande.name)" target="_blank" rel="noopener noreferrer"><LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />Ouvrir sur le Desk</a>
					</MoreMenu>
				</template>
			</RecordHeader>

			<p v-if="actionError" role="alert" class="flex-none rounded-control tone-red px-3.5 py-2.5">{{ actionError }}</p>
			<p v-if="commande.annulation_bloquee" class="flex-none rounded-control tone-amber px-3.5 py-2.5">Cette commande ne s'annule plus : {{ commande.annulation_bloquee }}</p>

			<div class="ticket-dossier">
				<div class="bureau-detail demande-detail">
					<aside class="card record-rail" aria-label="Informations de la commande">
						<dl class="record-facts">
							<div><dt><LucideBuilding2 aria-hidden="true" />Client</dt><dd><RouterLink v-if="canSeeClient" class="ref-link" :to="{ name: 'Client', params: { id: commande.client } }">{{ commande.client_label }}</RouterLink><template v-else>{{ commande.client_label }}</template></dd></div>
							<div><dt><LucideUser aria-hidden="true" />Commercial</dt><dd :class="!commande.commercial && 'record-fact-none'">{{ commande.commercial || 'Non attribué' }}</dd></div>
							<div>
								<dt><LucideFileText aria-hidden="true" />Devis</dt>
								<dd v-if="commande.devis"><RouterLink v-if="canSeeDevis" class="ref-link tabular-nums" :to="{ name: 'DevisFiche', params: { id: commande.devis } }">{{ commande.devis }}</RouterLink><span v-else class="tabular-nums">{{ commande.devis }}</span></dd>
								<dd v-else class="record-fact-none">Aucun</dd>
							</div>
							<div v-if="commande.demande"><dt><LucideClipboardList aria-hidden="true" />Demande</dt><dd><RouterLink v-if="canSeeDemande" class="ref-link tabular-nums" :to="{ name: 'Demande', params: { id: commande.demande } }">{{ commande.demande }}</RouterLink><span v-else class="tabular-nums">{{ commande.demande }}</span></dd></div>
							<div v-if="commande.ticket"><dt><LucideTicket aria-hidden="true" />Ticket</dt><dd><RouterLink v-if="canSeeTicket" class="ref-link tabular-nums" :to="{ name: 'Ticket', params: { id: commande.ticket } }">{{ commande.ticket }}</RouterLink><span v-else class="tabular-nums">{{ commande.ticket }}</span></dd></div>
							<div>
								<dt><LucideHash aria-hidden="true" /><label for="commande-bon">N° bon de commande</label></dt>
								<dd v-if="has('bon')"><input id="commande-bon" v-model="bonDraft" class="field-input devis-date" :class="!commande.bon_commande && 'is-missing'" placeholder="À saisir" :disabled="busy" @change="saveBon" @keydown.enter="($event.target as HTMLInputElement).blur()" /></dd>
								<dd v-else class="tabular-nums" :class="!commande.bon_commande && 'record-fact-none'">{{ commande.bon_commande || '—' }}</dd>
							</div>
							<div>
								<dt><LucideCalendar aria-hidden="true" /><label for="commande-date-bon">Date du bon</label></dt>
								<dd v-if="has('bon')"><input id="commande-date-bon" class="field-input devis-date" :class="!commande.date_bon && 'is-missing'" type="date" :value="commande.date_bon || ''" :max="today()" :disabled="busy" @change="saveDateBon" /></dd>
								<dd v-else class="tabular-nums" :class="!commande.date_bon && 'record-fact-none'">{{ formatDay(commande.date_bon) || '—' }}</dd>
							</div>
							<div>
								<dt><LucidePaperclip aria-hidden="true" />Bon scanné</dt>
								<dd class="flex min-w-0 flex-col items-start gap-1">
									<a v-if="commande.scan" class="ref-link truncate" :href="commande.scan.url" target="_blank" rel="noopener noreferrer" :title="commande.scan.name">{{ commande.scan.name }}</a>
									<span v-else-if="!has('scan')" class="record-fact-none">Non joint</span>
									<button v-if="has('scan')" type="button" class="text-sm text-link" :disabled="busy" @click="scanUploader?.pick()">{{ commande.scan ? 'Remplacer' : 'Joindre le PDF ou la photo' }}</button>
								</dd>
							</div>
							<div><dt><LucideCalendar aria-hidden="true" />Date de commande</dt><dd class="tabular-nums">{{ formatDay(commande.date) || '—' }}</dd></div>
							<div><dt><LucideTruck aria-hidden="true" />Livraison</dt><dd class="tabular-nums" :class="late ? 'font-semibold text-tone-red' : !commande.livraison && 'record-fact-none'">{{ formatDay(commande.livraison) || '—' }}{{ late ? ' · en retard' : '' }}</dd></div>
							<div v-if="commande.docstatus === 1">
								<dt><LucideFactory aria-hidden="true" />Fabrication</dt>
								<dd v-if="commande.dossier"><a class="ref-link" :href="deskUrl('Dossier Fabrication', commande.dossier.name)" target="_blank" rel="noopener noreferrer">{{ commande.dossier.status }}</a></dd>
								<dd v-else class="record-fact-none">Pas de dossier</dd>
							</div>
							<div v-if="commande.docstatus === 1"><dt><LucideFileCheck aria-hidden="true" />Livré · facturé</dt><dd class="tabular-nums">{{ percentText(commande.livre) }} · {{ percentText(commande.facture) }}</dd></div>
							<div v-if="amounts"><dt><LucideWallet aria-hidden="true" />Total TTC</dt><dd class="tabular-nums">{{ moneyText(commande.total_ttc) }} DA</dd></div>
						</dl>
						<FileUploader v-if="has('scan')" ref="scanUploader" class="w-full" :doctype="COMMANDE_DOCTYPE" :docname="commande.name" :zone="false" :multiple="false" accept=".pdf,application/pdf,image/*" @uploaded="onScanUploaded" />
					</aside>

					<div class="bureau-center">
						<section class="card ref-card">
							<div class="ref-card-head">
								<h3>Articles commandés</h3>
								<span class="text-sm text-ink-gray-6">Prix du devis, livraison de la demande</span>
							</div>
							<div class="ref-scroll">
								<table class="ref-table">
									<thead>
										<tr>
											<th>Article</th>
											<th class="end">Quantité</th>
											<th v-if="amounts" class="end">Prix unitaire HT</th>
											<th v-if="amounts" class="end">Montant HT</th>
											<th>Livraison</th>
											<th v-if="commande.docstatus === 1" class="end">Livré</th>
										</tr>
									</thead>
									<tbody>
										<tr v-for="line in commande.lignes" :key="line.name">
											<td class="min-w-48 !whitespace-normal">
												<RouterLink class="ref-link !whitespace-normal" :to="{ name: 'Article', params: { id: line.article } }">{{ line.designation }}</RouterLink>
												<span class="block text-xs text-ink-gray-6 tabular-nums">{{ line.article }}</span>
											</td>
											<td class="end tabular-nums">{{ quantityText(line.quantite) }}</td>
											<td v-if="amounts" class="end tabular-nums">{{ moneyText(line.prix) }}</td>
											<td v-if="amounts" class="end tabular-nums">{{ moneyText(line.montant) }}</td>
											<td class="tabular-nums" :class="!line.livraison && 'text-ink-gray-6'">{{ formatDay(line.livraison) || 'À définir' }}</td>
											<td v-if="commande.docstatus === 1" class="end tabular-nums">{{ quantityText(line.livree) }}</td>
										</tr>
									</tbody>
								</table>
							</div>
							<dl v-if="amounts" class="devis-totals">
								<div><dt>Total HT</dt><dd>{{ moneyText(commande.total) }} DA</dd></div>
								<div><dt>Taxes</dt><dd>{{ moneyText(commande.taxes) }} DA</dd></div>
								<div class="devis-totals-grand"><dt>Total TTC</dt><dd>{{ moneyText(commande.total_ttc) }} DA</dd></div>
							</dl>
							<p v-else class="m-0 text-sm text-ink-gray-6">Les montants ne sont pas visibles pour votre rôle.</p>
						</section>

						<aside class="record-activity" aria-label="Commentaires et activité de la commande">
							<ActivityFeed ref="feed" :api="activityApi" :version="commande.modified" :user-name="userName" @changed="refresh(); emit('changed')" />
						</aside>
					</div>

					<div class="bureau-side">
						<StepTimeline v-if="timeline" :steps="timeline.steps" :viewed="timeline.focus" :current="timeline.current" :focus="timeline.focus" :tip="tip" label="Étapes de la commande" />
					</div>
				</div>
			</div>
			<CommandeActions ref="actions" :commande="commande" :busy="busy" :validate="validate" :cancel="cancel" :remove="removeDraft" />
		</template>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</main>
</template>
