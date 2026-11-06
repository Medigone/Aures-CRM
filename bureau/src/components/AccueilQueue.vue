<script setup lang="ts">
import { computed } from 'vue'
import AttributionButton from './AttributionButton.vue'
import TicketStatus from './TicketStatus.vue'
import { GROUP_TITLES, waitLabel, type AccueilRow, type QueueGroup } from '@/lib/accueil'
import type { Option } from '@/types'

/** La file de l'accueil : chaque requête avec ce qui la fait avancer. Le serveur dit quelle action est permise. */
const props = defineProps<{ groups: QueueGroup[]; assignees: Option[]; busy: string; maxRows: number }>()
const emit = defineEmits<{ run: [row: AccueilRow]; assign: [row: AccueilRow, user: string]; demande: [row: AccueilRow]; open: [row: AccueilRow] }>()

const shown = computed(() => props.groups.filter((group) => group.total))
const total = computed(() => props.groups.reduce((sum, group) => sum + group.total, 0))
const titleOf = (group: QueueGroup) => GROUP_TITLES[group.key]
</script>

<template>
	<section class="card accueil-queue">
		<div class="accueil-card-head">
			<h2 class="accueil-title">À transformer en action</h2>
			<span class="accueil-count tabular-nums">{{ total }}</span>
			<RouterLink class="accueil-pill" :to="{ name: 'Tickets' }">Tout voir</RouterLink>
		</div>
		<p v-if="!shown.length" class="accueil-empty">Aucune requête n'attend d'action ici.</p>
		<div v-for="group in shown" :key="group.key">
			<div class="accueil-group">
				<h3>{{ titleOf(group).title }}</h3>
				<span>{{ titleOf(group).hint }}</span>
			</div>
			<div v-for="row in group.rows" :key="row.name" class="accueil-row">
				<span class="urgence accueil-urgence" :class="`urgence-${row.urgence || 'U0'}`">{{ row.urgence || 'U0' }}</span>
				<div class="accueil-row-main">
					<div class="accueil-row-line">
						<RouterLink class="ref-link font-semibold tabular-nums" :to="{ name: 'Ticket', params: { id: row.name } }">{{ row.name }}</RouterLink>
						<span class="text-ink-gray-7">{{ row.request_type }}</span>
					</div>
					<p class="accueil-row-sub" :title="`${row.client} · ${row.commercial ?? ''}, ${row.assigne_a_nom ? `attribué à ${row.assigne_a_nom}` : 'non attribué'}`">
						{{ row.client }}<template v-if="row.commercial"> · {{ row.commercial }}</template>,
						{{ row.assigne_a_nom ? `attribué à ${row.assigne_a_nom}` : 'non attribué' }}
					</p>
				</div>
				<div class="accueil-row-state">
					<TicketStatus :status="row.status" />
					<span class="accueil-row-sub">{{ waitLabel(row) }}</span>
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
					<button v-else-if="row.action.kind === 'run'" type="button" class="btn-secondary" :disabled="busy === row.name" @click="emit('run', row)">{{ row.action.label }}</button>
					<button v-else-if="row.action.kind === 'demande'" type="button" class="btn-secondary" @click="emit('demande', row)">{{ row.action.label }}</button>
					<button v-else type="button" class="btn-secondary" :title="row.action.reason" @click="emit('open', row)">{{ row.action.label }}</button>
				</div>
			</div>
			<RouterLink v-if="group.total > group.rows.length" class="accueil-more" :to="{ name: 'Tickets' }">{{ group.total - group.rows.length }} autres dans la liste des tickets</RouterLink>
		</div>
	</section>
</template>
