<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { htmlToText } from '@shared/text'
import { decideUrgence } from '@/lib/api'
import { urgenceNote } from '@/lib/display'
import type { Perform, TicketDetail } from '@/types'

/** La saisie reste dans la carte ; les décisions passent dans la barre d'actions de l'en-tête (`actionsBar`). */
const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform; actionsBar: HTMLElement | null }>()

const LEVELS = ['U1', 'U2', 'U3']
const level = ref('')
const comment = ref('')
const chosen = computed(() => level.value || props.ticket.niveau_urgence_demande || 'U1')
const refusable = computed(() => Boolean(comment.value.trim()))
const readOnly = computed(() => !props.ticket.can_write)
watch(
	() => props.ticket.name,
	() => {
		level.value = ''
		comment.value = ''
	},
)

function decide(decision: 'validate' | 'refuse') {
	props.perform(() => decideUrgence(props.ticket, decision, decision === 'validate' ? chosen.value : null, comment.value))
}
</script>

<template>
	<Teleport v-if="actionsBar" :to="actionsBar">
		<button type="button" class="btn-secondary" :disabled="busy || readOnly || !refusable" :title="refusable ? undefined : 'Écrivez un commentaire pour refuser'" @click="decide('refuse')">Refuser l'urgence</button>
		<button type="button" class="btn-primary" :disabled="busy || readOnly" @click="decide('validate')">Valider {{ chosen }}</button>
	</Teleport>
	<div class="card flex flex-col gap-2 bg-tone-amber-bg p-3.5">
		<h3 class="text-base font-semibold">Demande d'urgence {{ ticket.niveau_urgence_demande }} à décider</h3>
		<p class="whitespace-pre-line text-ink-gray-8">{{ htmlToText(ticket.descr_urgence) || 'Aucun motif indiqué.' }}</p>
		<div class="flex flex-col gap-1.5">
			<span class="text-sm text-ink-gray-7">Niveau accordé</span>
			<div class="grid grid-cols-3 gap-2">
				<button
					v-for="item in LEVELS"
					:key="item"
					type="button"
					class="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-control border-2 bg-surface-white px-1 py-1.5 transition"
					:class="chosen === item ? 'border-primary' : 'border-outline-gray-2 hover:border-outline-gray-3'"
					:aria-pressed="chosen === item"
					:disabled="busy || readOnly"
					@click="level = item"
				>
					<span class="urgence" :class="`urgence-${item}`">{{ item }}</span>
					<span class="text-xs text-ink-gray-7">{{ urgenceNote(item, ticket.niveau_urgence_demande) }}</span>
				</button>
			</div>
		</div>
		<label class="block">
			<span class="field-label">Commentaire (obligatoire pour refuser)</span>
			<textarea v-model="comment" class="field-input" rows="2" :disabled="busy || readOnly"></textarea>
		</label>
	</div>
</template>
