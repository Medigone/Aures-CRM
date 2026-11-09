<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucideX from '~icons/lucide/x'
import { exactTime, relativeTime } from '@shared/activity'
import CommentText from '@shared/components/CommentText.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import TagEditor from './TagEditor.vue'
import { getCommande } from '@/lib/api'
import { COMMANDE_DOCTYPE, isLate, moneyText, percentText, quantityText, type CommandeDetail } from '@/lib/commandes'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import { useDrawerControls } from '@/lib/useDrawerControls'
import { useRecord } from '@/lib/useRecord'

/** Aperçu d'une commande. Sa fiche viendra avec le lot suivant : en attendant, elle s'ouvre sur le Desk. */
const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; changed: [] }>()

const { record: commande, error, notFound, notice, noticeTone, load, refresh } = useRecord<CommandeDetail>(
	() => props.id,
	getCommande,
	() => emit('changed'),
)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

const canSeeDevis = canRead('Quotation')
const canSeeDemande = canRead('Demande Faisabilite')
const canSeeTicket = canRead('Ticket Commercial')
const canSeeClient = canRead('Customer')
const amounts = computed(() => commande.value?.total_ttc !== null && commande.value?.total_ttc !== undefined)
const late = computed(() => (commande.value ? isLate(commande.value) : false))
function onTags(tags: string[]) {
	if (commande.value) commande.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu de la commande">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Commande précédente" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Commande suivante" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
			<span class="text-xs text-ink-gray-6">{{ position }}</span>
			<span class="flex-auto"></span>
			<a class="btn-primary" :href="deskUrl(COMMANDE_DOCTYPE, id)" target="_blank" rel="noopener noreferrer">
				Ouvrir sur le Desk
				<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
			</a>
			<button type="button" class="icon-btn" aria-label="Fermer l'aperçu" @click="emit('close')"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
		</div>

		<div class="bureau-drawer-body">
			<p v-if="error" role="alert" class="text-tone-red">
				{{ error }}
				<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
			</p>
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Cette commande n'existe pas ou n'existe plus.</p>
			<p v-else-if="!commande" class="py-8 text-center text-ink-gray-6">Chargement de la commande…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold tabular-nums">{{ commande.name }}</h2>
						<StatusPill :status="commande.status" />
						<span class="urgence" :class="`urgence-${commande.urgence}`">{{ commande.urgence }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [commande.client_label, commande.retirage ? 'Retirage' : '', `${commande.lignes.length} ${commande.lignes.length > 1 ? 'articles' : 'article'}`].filter(Boolean).join(' · ') }}</p>
					<TagEditor class="mt-1.5" :doctype="COMMANDE_DOCTYPE" :name="commande.name" :modified="commande.modified" :tags="commande.tags" :can-edit="commande.can_write" @changed="onTags" />
				</div>

				<dl class="bureau-drawer-facts">
					<div>
						<dt>Client</dt>
						<dd class="truncate" :title="commande.client_label">
							<RouterLink v-if="canSeeClient" class="ref-link" :to="{ name: 'Client', params: { id: commande.client } }">{{ commande.client_label }}</RouterLink>
							<template v-else>{{ commande.client_label }}</template>
						</dd>
					</div>
					<div><dt>Commercial</dt><dd class="truncate" :title="commande.commercial || undefined">{{ commande.commercial || 'Non attribué' }}</dd></div>
					<div>
						<dt>Bon de commande</dt>
						<dd class="tabular-nums" :class="!commande.bon_commande && 'text-ink-gray-6'">{{ commande.bon_commande ? `${commande.bon_commande}${commande.date_bon ? ` du ${formatDay(commande.date_bon)}` : ''}` : 'À saisir' }}</dd>
					</div>
					<div>
						<dt>Devis</dt>
						<dd class="truncate tabular-nums">
							<RouterLink v-if="commande.devis && canSeeDevis" class="ref-link" :to="{ name: 'DevisFiche', params: { id: commande.devis } }">{{ commande.devis }}</RouterLink>
							<template v-else>{{ commande.devis || '—' }}</template>
						</dd>
					</div>
					<div>
						<dt>Demande</dt>
						<dd class="truncate tabular-nums">
							<RouterLink v-if="commande.demande && canSeeDemande" class="ref-link" :to="{ name: 'Demande', params: { id: commande.demande } }">{{ commande.demande }}</RouterLink>
							<template v-else>{{ commande.demande || '—' }}</template>
						</dd>
					</div>
					<div>
						<dt>Ticket</dt>
						<dd class="truncate tabular-nums">
							<RouterLink v-if="commande.ticket && canSeeTicket" class="ref-link" :to="{ name: 'Ticket', params: { id: commande.ticket } }">{{ commande.ticket }}</RouterLink>
							<template v-else>{{ commande.ticket || '—' }}</template>
						</dd>
					</div>
					<div><dt>Date de commande</dt><dd class="tabular-nums">{{ formatDay(commande.date) || '—' }}</dd></div>
					<div>
						<dt>Livraison</dt>
						<dd class="tabular-nums" :class="late && 'font-semibold text-tone-red'">{{ formatDay(commande.livraison) || '—' }}{{ late ? ' · en retard' : '' }}</dd>
					</div>
					<div>
						<dt>Dossier de fabrication</dt>
						<dd class="truncate">
							<a v-if="commande.dossier" class="ref-link" :href="deskUrl('Dossier Fabrication', commande.dossier.name)" target="_blank" rel="noopener noreferrer">{{ commande.dossier.status }}</a>
							<span v-else class="text-ink-gray-6">{{ commande.docstatus === 0 ? 'Créé à la validation' : 'Aucun' }}</span>
						</dd>
					</div>
					<div><dt>Livré · facturé</dt><dd class="tabular-nums">{{ percentText(commande.livre) }} · {{ percentText(commande.facture) }}</dd></div>
				</dl>

				<section class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Articles commandés</h3>
					<div class="ref-scroll">
						<table class="ref-table">
							<thead>
								<tr>
									<th>Article</th>
									<th class="end">Quantité</th>
									<th>Livraison</th>
									<th v-if="amounts" class="end">Montant</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="line in commande.lignes" :key="line.name">
									<td class="!whitespace-normal">
										<RouterLink class="ref-link" :to="{ name: 'Article', params: { id: line.article } }">{{ line.designation }}</RouterLink>
										<span v-if="line.livree" class="block text-xs text-ink-gray-6 tabular-nums">{{ quantityText(line.livree) }} livrés</span>
									</td>
									<td class="end tabular-nums">{{ quantityText(line.quantite) }}</td>
									<td class="tabular-nums">{{ formatDay(line.livraison) || '—' }}</td>
									<td v-if="amounts" class="end tabular-nums">{{ moneyText(line.montant) }}</td>
								</tr>
							</tbody>
						</table>
					</div>
					<dl v-if="amounts" class="devis-totals">
						<div><dt>Total HT</dt><dd>{{ moneyText(commande.total) }} DA</dd></div>
						<div><dt>Taxes</dt><dd>{{ moneyText(commande.taxes) }} DA</dd></div>
						<div class="devis-totals-grand"><dt>Total TTC</dt><dd>{{ moneyText(commande.total_ttc) }} DA</dd></div>
					</dl>
				</section>

				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="commande.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ commande.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="commande.comments.last.at" :title="exactTime(commande.comments.last.at)">{{ relativeTime(commande.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="commande.comments.last.parts" />
					</template>
					<p v-else class="text-ink-gray-6">Aucun commentaire.</p>
				</section>
			</template>
		</div>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</aside>
</template>
