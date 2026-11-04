<script setup lang="ts">
import { computed } from 'vue'
import LucideArrowUpRight from '~icons/lucide/arrow-up-right'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucideMail from '~icons/lucide/mail'
import LucidePhone from '~icons/lucide/phone'
import LucideX from '~icons/lucide/x'
import { exactTime, relativeTime } from '@shared/activity'
import CommentText from '@shared/components/CommentText.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import ClientTicketsTable from './ClientTicketsTable.vue'
import { formatAmount } from '@/lib/clients'
import { formatDay } from '@/lib/display'
import { useClient } from '@/lib/useClient'

const props = defineProps<{ id: string; position: string; noPrev: boolean; noNext: boolean }>()
const emit = defineEmits<{ prev: []; next: []; close: []; open: [tab?: string] }>()

const { client, error, notFound, load, refresh } = useClient(() => props.id)
defineExpose({ refresh })

const openTickets = computed(() => (client.value?.tickets ?? []).filter((ticket) => ticket.is_open))
const contact = computed(() => client.value?.contacts[0])
</script>

<template>
	<aside class="bureau-drawer" aria-label="Aperçu du client">
		<div class="bureau-drawer-head">
			<button type="button" class="icon-btn" aria-label="Client précédent" :disabled="noPrev" @click="emit('prev')"><LucideChevronUp class="h-4 w-4" aria-hidden="true" /></button>
			<button type="button" class="icon-btn" aria-label="Client suivant" :disabled="noNext" @click="emit('next')"><LucideChevronDown class="h-4 w-4" aria-hidden="true" /></button>
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
			<p v-else-if="notFound" class="py-8 text-center text-ink-gray-6">Ce client n'existe pas ou n'existe plus.</p>
			<p v-else-if="!client" class="py-8 text-center text-ink-gray-6">Chargement du client…</p>

			<template v-else>
				<div>
					<div class="flex flex-wrap items-center gap-1.5">
						<h2 class="text-xl font-semibold">{{ client.client }}</h2>
						<StatusPill :status="client.status" />
						<span v-if="client.grand_compte" class="record-flag">Grand compte</span>
					</div>
					<p class="mt-0.5 text-sm text-ink-gray-7">{{ [client.forme_juridique, client.name, client.commune_label, client.wilaya].filter(Boolean).join(' · ') }}</p>
				</div>

				<dl class="bureau-drawer-facts">
					<div><dt>Commercial</dt><dd class="truncate" :title="client.commercial || undefined">{{ client.commercial || 'Non attribué' }}</dd></div>
					<div><dt>Wilaya</dt><dd class="truncate">{{ client.wilaya || '—' }}</dd></div>
					<div><dt>Créance</dt><dd class="tabular-nums">{{ client.creance?.solde_restant ? `${formatAmount(client.creance.solde_restant)} DA` : 'Aucune' }}</dd></div>
					<div><dt>Dernière visite</dt><dd class="tabular-nums">{{ formatDay(client.visite) || 'Jamais' }}</dd></div>
				</dl>

				<section class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Contact principal</h3>
					<template v-if="contact">
						<p><span class="font-semibold text-ink-gray-9">{{ contact.nom || 'Sans nom' }}</span><span v-if="contact.fonction" class="text-ink-gray-6"> · {{ contact.fonction }}</span></p>
						<p class="contact-links">
							<a v-if="contact.telephone" class="ref-link tabular-nums" :href="`tel:${contact.telephone}`"><LucidePhone class="h-3.5 w-3.5" aria-hidden="true" />{{ contact.telephone }}</a>
							<a v-if="contact.email" class="ref-link" :href="`mailto:${contact.email}`"><LucideMail class="h-3.5 w-3.5" aria-hidden="true" />{{ contact.email }}</a>
						</p>
					</template>
					<p v-else class="text-ink-gray-6">Aucun contact enregistré.</p>
				</section>

				<section class="card flex flex-col gap-1">
					<h3 class="text-base font-semibold">Tickets ouverts</h3>
					<ClientTicketsTable :tickets="openTickets.slice(0, 5)" compact empty="Aucun ticket ouvert." />
					<button v-if="openTickets.length > 5" type="button" class="self-start text-sm font-medium text-accent hover:underline" @click="emit('open', 'affaires')">Voir les {{ openTickets.length }} tickets</button>
				</section>

				<section v-if="client.can_view_activity" class="card flex flex-col items-start gap-1">
					<h3 class="text-base font-semibold">Dernier commentaire</h3>
					<template v-if="client.comments.last">
						<p class="text-sm">
							<strong class="font-semibold text-ink-gray-9">{{ client.comments.last.who }}</strong> ·
							<time class="text-ink-gray-6" :datetime="client.comments.last.at" :title="exactTime(client.comments.last.at)">{{ relativeTime(client.comments.last.at) }}</time>
						</p>
						<CommentText class="line-clamp-3" :parts="client.comments.last.parts" />
						<button type="button" class="text-sm font-medium text-accent hover:underline" @click="emit('open', 'activite')">{{ client.comments.count > 1 ? `Voir les ${client.comments.count} commentaires` : 'Voir le fil' }}</button>
					</template>
					<p v-else class="text-ink-gray-6">
						Aucun commentaire.
						<button type="button" class="font-medium text-accent hover:underline" @click="emit('open', 'activite')">Écrire le premier</button>
					</p>
				</section>
			</template>
		</div>
	</aside>
</template>
