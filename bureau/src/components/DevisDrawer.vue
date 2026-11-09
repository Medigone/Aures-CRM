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
import { commandeText, DEVIS_DOCTYPE, devisStage, devisTypeLabel, moneyText, quantityText } from '@/lib/devis'
import { deskUrl, formatDay } from '@/lib/display'
import { canRead } from '@/lib/droits'
import { useDevis } from '@/lib/useDevis'
import { useDrawerControls } from '@/lib/useDrawerControls'

/** Aperçu d'un devis : le chiffrage et les décisions se font sur la fiche. */
const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [tab?: string]; changed: [] }>()

const { devis, error, notFound, notice, noticeTone, load, refresh } = useDevis(
	() => props.id,
	() => emit('changed'),
)
defineExpose({ refresh })

const root = ref<HTMLElement | null>(null)
useDrawerControls(root, { close: () => emit('close'), prev: () => emit('prev'), next: () => emit('next') })

const canSeeDemande = canRead('Demande Faisabilite')
const canSeeTicket = canRead('Ticket Commercial')
const canSeeClient = canRead('Customer')
const stage = computed(() => (devis.value ? devisStage({ status: devis.value.status, lignes: devis.value.lignes.length, chiffrees: devis.value.chiffrees }) : null))
const prices = computed(() => Boolean(devis.value?.lignes.some((line) => line.prix !== null)))
const order = computed(() => (devis.value ? commandeText(devis.value) : ''))
function onTags(tags: string[]) {
	if (devis.value) devis.value.tags = tags
	emit('changed')
}
</script>

<template>
	<aside ref="root" class="bureau-drawer" aria-label="Aperçu du devis">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Devis précédent" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Devis suivant" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
			<span class="text-xs text-ink-gray-6">{{ position }}</span>
			<span class="flex-auto"></span>
			<button type="button" class="btn-primary" @click="emit('open')">
				Ouvrir la fiche
				<LucideArrowUpRight class="h-3.5 w-3.5" aria-hidden="true" />
			</button>
			<button type="button" class="icon-btn" aria-label="Fermer l'aperçu" @click="emit('close')"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
		</div>

		<div class="bureau-drawer-body">
			<p v-if="error" role="alert" class="text-tone-red">
				{{ error }}
				<button type="button" class="ml-1 font-semibold underline" @click="load">Réessayer</button>
			</p>
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Ce devis n'existe pas ou n'existe plus.</p>
			<p v-else-if="!devis" class="py-8 text-center text-ink-gray-6">Chargement du devis…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold tabular-nums">{{ devis.name }}</h2>
						<span v-if="stage" class="list-tag" :class="stage.tone">{{ stage.label }}</span>
						<StatusPill v-else :status="devis.status" />
						<span class="urgence" :class="`urgence-${devis.urgence}`">{{ devis.urgence }}</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [devis.client_label, devisTypeLabel(devis.type), `${devis.lignes.length} ${devis.lignes.length > 1 ? 'articles' : 'article'}`].join(' · ') }}</p>
					<TagEditor class="mt-1.5" :doctype="DEVIS_DOCTYPE" :name="devis.name" :modified="devis.modified" :tags="devis.tags" :can-edit="devis.can_write" @changed="onTags" />
				</div>

				<dl class="bureau-drawer-facts">
					<div>
						<dt>Client</dt>
						<dd class="truncate" :title="devis.client_label">
							<RouterLink v-if="canSeeClient" class="ref-link" :to="{ name: 'Client', params: { id: devis.client } }">{{ devis.client_label }}</RouterLink>
							<template v-else>{{ devis.client_label }}</template>
						</dd>
					</div>
					<div><dt>Commercial</dt><dd class="truncate" :title="devis.commercial || undefined">{{ devis.commercial || 'Non attribué' }}</dd></div>
					<div>
						<dt>Demande</dt>
						<dd class="truncate tabular-nums">
							<RouterLink v-if="devis.demande && canSeeDemande" class="ref-link" :to="{ name: 'Demande', params: { id: devis.demande } }">{{ devis.demande }}</RouterLink>
							<template v-else>{{ devis.demande || '—' }}</template>
						</dd>
					</div>
					<div>
						<dt>Ticket</dt>
						<dd class="truncate tabular-nums">
							<RouterLink v-if="devis.ticket && canSeeTicket" class="ref-link" :to="{ name: 'Ticket', params: { id: devis.ticket } }">{{ devis.ticket }}</RouterLink>
							<template v-else>{{ devis.ticket || '—' }}</template>
						</dd>
					</div>
					<div><dt>Date du devis</dt><dd class="tabular-nums">{{ formatDay(devis.date) || '—' }}</dd></div>
					<div><dt>Valable jusqu'au</dt><dd class="tabular-nums">{{ formatDay(devis.valable) || '—' }}</dd></div>
					<div><dt>Livraison souhaitée</dt><dd class="tabular-nums">{{ formatDay(devis.livraison) || '—' }}</dd></div>
					<div><dt>Commande</dt><dd>{{ order || '—' }}</dd></div>
				</dl>

				<section class="card flex flex-col gap-1">
					<div class="flex items-baseline justify-between gap-2">
						<h3 class="text-base font-semibold">Lignes du devis</h3>
						<span class="text-xs text-ink-gray-6 tabular-nums">{{ devis.chiffrees }} chiffrée{{ devis.chiffrees > 1 ? 's' : '' }} sur {{ devis.lignes.length }}</span>
					</div>
					<div class="ref-scroll">
						<table class="ref-table">
							<thead>
								<tr>
									<th>Article</th>
									<th class="end">Quantité</th>
									<th v-if="prices" class="end">Prix</th>
									<th v-if="prices" class="end">Montant</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="line in devis.lignes" :key="line.name">
									<td class="!whitespace-normal">
										<RouterLink class="ref-link" :to="{ name: 'Article', params: { id: line.article } }">{{ line.designation }}</RouterLink>
									</td>
									<td class="end tabular-nums">{{ quantityText(line.quantite) }}</td>
									<td v-if="prices" class="end tabular-nums" :class="!line.chiffree && 'text-ink-gray-6'">{{ line.chiffree ? moneyText(line.prix) : 'À chiffrer' }}</td>
									<td v-if="prices" class="end tabular-nums">{{ line.chiffree ? moneyText(line.montant) : '—' }}</td>
								</tr>
							</tbody>
						</table>
					</div>
					<dl class="devis-totals">
						<div><dt>Total HT</dt><dd>{{ moneyText(devis.total) }} DA</dd></div>
						<div><dt>Taxes</dt><dd>{{ moneyText(devis.taxes) }} DA</dd></div>
						<div class="devis-totals-grand"><dt>Total TTC</dt><dd>{{ moneyText(devis.total_ttc) }} DA</dd></div>
					</dl>
				</section>

				<section v-if="devis.commandes.length" class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Commandes</h3>
					<div class="ref-scroll">
						<table class="ref-table">
							<thead><tr><th>Commande</th><th>Statut</th><th class="end">Total (DA)</th></tr></thead>
							<tbody>
								<tr v-for="sale in devis.commandes" :key="sale.name">
									<td><a class="ref-link tabular-nums" :href="deskUrl('Sales Order', sale.name)" target="_blank" rel="noopener noreferrer">{{ sale.name }}</a></td>
									<td><StatusPill :status="sale.status" /></td>
									<td class="end tabular-nums">{{ sale.total === null ? '—' : moneyText(sale.total) }}</td>
								</tr>
							</tbody>
						</table>
					</div>
				</section>

				<section class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="devis.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ devis.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="devis.comments.last.at" :title="exactTime(devis.comments.last.at)">{{ relativeTime(devis.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="devis.comments.last.parts" />
					</template>
					<p v-else class="text-ink-gray-6">Aucun commentaire.</p>
					<button type="button" class="text-sm text-link" @click="emit('open', 'activite')">{{ devis.comments.count > 1 ? `Voir les ${devis.comments.count} commentaires` : devis.comments.last ? 'Voir le fil' : 'Écrire le premier' }}</button>
				</section>
			</template>
		</div>
		<AppToast :message="notice" :tone="noticeTone" @close="notice = ''" />
	</aside>
</template>
