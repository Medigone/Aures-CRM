<script setup lang="ts">
import { computed } from 'vue'
import LucideArrowRight from '~icons/lucide/arrow-right'
import LucideCircleAlert from '~icons/lucide/circle-alert'
import LucideFilePlus from '~icons/lucide/file-plus'
import LucideLoader from '~icons/lucide/loader'
import LucidePlay from '~icons/lucide/play'
import LucideScale from '~icons/lucide/scale'
import AttributionButton from './AttributionButton.vue'
import TicketStatus from './TicketStatus.vue'
import { GROUP_TITLES, waitLabel, type AccueilRow, type AccueilScope, type QueueGroup } from '@/lib/accueil'
import { initials } from '@/lib/display'
import type { Option } from '@/types'

/** La file de l'accueil : chaque requête avec ce qui la fait avancer. Le serveur dit quelle action est permise. */
const props = defineProps<{ groups: QueueGroup[]; assignees: Option[]; busy: string; maxRows: number; scope: AccueilScope }>()
const emit = defineEmits<{ run: [row: AccueilRow]; assign: [row: AccueilRow, user: string]; demande: [row: AccueilRow]; open: [row: AccueilRow]; 'update:scope': [scope: AccueilScope] }>()

const shown = computed(() => props.groups.filter((group) => group.total))
const total = computed(() => props.groups.reduce((sum, group) => sum + group.total, 0))
const titleOf = (group: QueueGroup) => GROUP_TITLES[group.key]
const assigneeOf = (row: AccueilRow) => (row.assigne_a_nom ? `attribué à ${row.assigne_a_nom}` : 'non attribué')
</script>

<template>
	<section class="card accueil-queue">
		<div class="accueil-card-head">
			<h2 class="accueil-title">À transformer en action</h2>
			<span class="accueil-count tabular-nums">{{ total }}</span>
			<div class="accueil-scope" role="group" aria-label="Périmètre de la file">
				<button type="button" :class="scope === 'team' && 'is-on'" :aria-pressed="scope === 'team'" @click="emit('update:scope', 'team')">Toute l'équipe</button>
				<button type="button" :class="scope === 'mine' && 'is-on'" :aria-pressed="scope === 'mine'" @click="emit('update:scope', 'mine')">À moi</button>
			</div>
			<RouterLink class="accueil-pill" :to="{ name: 'Tickets' }">Tout voir</RouterLink>
		</div>
		<p v-if="!shown.length" class="accueil-empty">Aucune requête n'attend d'action ici.</p>
		<div v-for="group in shown" :key="group.key">
			<div class="accueil-group">
				<h3>{{ titleOf(group).title }}</h3>
				<b class="accueil-group-count tabular-nums">{{ group.total }}</b>
				<span>{{ titleOf(group).hint }}</span>
			</div>
			<div v-for="row in group.rows" :key="row.name" class="accueil-row">
				<span v-if="row.urgence && row.urgence !== 'U0'" class="urgence accueil-urgence" :class="`urgence-${row.urgence}`">{{ row.urgence }}</span>
				<span v-else class="accueil-urgence-quiet">U0</span>
				<div class="accueil-row-main">
					<div class="accueil-row-line">
						<RouterLink class="ref-link font-semibold tabular-nums" :to="{ name: 'Ticket', params: { id: row.name } }">{{ row.name }}</RouterLink>
						<span :title="row.client">{{ row.client }}</span>
					</div>
					<p class="accueil-row-sub" :title="`${row.request_type} · ${row.commercial ?? ''}, ${assigneeOf(row)}`">
						{{ row.request_type }}<template v-if="row.commercial"> · {{ row.commercial }}</template><span class="accueil-row-who-inline">, {{ assigneeOf(row) }}</span>
					</p>
				</div>
				<div class="accueil-row-who" :class="!row.assigne_a_nom && 'is-none'" :title="row.assigne_a_nom ?? 'Non attribué'">
					<span class="accueil-initials" aria-hidden="true">{{ row.assigne_a_nom ? initials(row.assigne_a_nom) : '' }}</span>
					<span class="truncate">{{ row.assigne_a_nom ?? 'Non attribué' }}</span>
				</div>
				<div class="accueil-row-state">
					<TicketStatus :status="row.status" />
					<span class="accueil-row-sub" :class="row.is_late && 'is-late'">{{ waitLabel(row) }}</span>
				</div>
				<div class="accueil-row-action">
					<AttributionButton
						v-if="row.action.kind === 'assign'"
						:ticket="row"
						:options="assignees"
						can-assign
						:busy="busy === row.name"
						:action-label="row.action.label"
						@assign="(user) => emit('assign', row, user)"
					/>
					<button v-else-if="row.action.kind === 'run'" type="button" class="btn-secondary accueil-action" :disabled="busy === row.name" @click="emit('run', row)">
						<LucideLoader v-if="busy === row.name" class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
						<LucidePlay v-else class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
						{{ row.action.label }}
					</button>
					<button v-else-if="row.action.kind === 'demande'" type="button" class="btn-secondary accueil-action" @click="emit('demande', row)">
						<LucideFilePlus class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
						{{ row.action.label }}
					</button>
					<button v-else-if="row.action.kind === 'decide'" type="button" class="btn-secondary accueil-action" @click="emit('open', row)">
						<LucideScale class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
						{{ row.action.label }}
					</button>
					<template v-else>
						<!-- Pas d'action directe : le bouton reste discret et dit pourquoi, au survol comme au clavier. -->
						<button type="button" class="btn accueil-action accueil-action-quiet" :aria-describedby="row.action.reason ? `accueil-raison-${row.name}` : undefined" @click="emit('open', row)">
							<LucideCircleAlert v-if="row.action.reason" class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
							<LucideArrowRight v-else class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
							{{ row.action.label }}
						</button>
						<span v-if="row.action.reason" :id="`accueil-raison-${row.name}`" class="accueil-tip" role="tooltip">{{ row.action.reason }}</span>
					</template>
				</div>
			</div>
			<RouterLink v-if="group.total > group.rows.length" class="accueil-more" :to="{ name: 'Tickets' }">{{ group.total - group.rows.length }} autres dans la liste des tickets</RouterLink>
		</div>
	</section>
</template>
