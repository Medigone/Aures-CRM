<script setup lang="ts">
import { RouterLink } from 'vue-router'
import StatusPill from '@shared/components/StatusPill.vue'
import { shortDay, statusLabel } from '@/lib/display'
import type { ClientTicket } from '@/lib/clients'

/** Tickets d'un client : le numéro mène à la fiche du ticket. `compact` : sans l'échéance, pour le tiroir. */
defineProps<{ tickets: ClientTicket[]; empty: string; compact?: boolean }>()
</script>

<template>
	<p v-if="!tickets.length" class="text-ink-gray-6">{{ empty }}</p>
	<div v-else class="ref-scroll">
		<table class="ref-table">
			<thead>
				<tr><th>Ticket</th><th>Type</th><th>Statut</th><th>Urgence</th><th v-if="!compact">Échéance</th></tr>
			</thead>
			<tbody>
				<tr v-for="ticket in tickets" :key="ticket.name">
					<td><RouterLink class="ref-link" :to="{ name: 'Ticket', params: { id: ticket.name } }">{{ ticket.name }}</RouterLink></td>
					<td>{{ ticket.request_type }}</td>
					<td><StatusPill :status="statusLabel(ticket.status)" /></td>
					<td><span class="urgence" :class="`urgence-${ticket.niveau_urgence}`">{{ ticket.niveau_urgence }}</span></td>
					<td v-if="!compact" class="tabular-nums" :class="ticket.is_late && 'font-semibold text-tone-red'">{{ shortDay(ticket.echeance) || '—' }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>
