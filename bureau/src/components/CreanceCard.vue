<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { setCreance } from '@/lib/api'
import type { Perform, TicketDetail } from '@/types'

const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform }>()

const OPTIONS = ['Non vérifiée', 'OK', 'Bloquée', 'Déblocage autorisé']
const BLOCKED = 'Bloquée'

const blocking = ref(false)
const motif = ref('')
const isBlocked = computed(() => props.ticket.status === 'Blocage Créance')
const editable = computed(() => props.ticket.can_write && (props.ticket.status === 'En Cours' || isBlocked.value))
const current = computed(() => (blocking.value ? BLOCKED : props.ticket.statut_creance || 'Non vérifiée'))

watch(
	() => props.ticket.name,
	() => {
		blocking.value = false
		motif.value = ''
	},
)

function isDisabled(option: string) {
	// Un ticket bloqué ne peut revenir qu'à un statut qui autorise le déblocage.
	return !editable.value || props.busy || (isBlocked.value && option === 'Non vérifiée')
}

function pick(option: string) {
	if (option === BLOCKED && !isBlocked.value) {
		blocking.value = true
		return
	}
	blocking.value = false
	if (option !== props.ticket.statut_creance) props.perform(() => setCreance(props.ticket, option))
}

async function confirmBlock() {
	if (await props.perform(() => setCreance(props.ticket, BLOCKED, motif.value))) {
		blocking.value = false
		motif.value = ''
	}
}
</script>

<template>
	<div class="card flex flex-col gap-2 p-3.5">
		<div class="flex items-baseline justify-between gap-2">
			<h3 class="text-base font-semibold">Créance du client</h3>
			<span v-if="ticket.creance_verifiee_par" class="text-xs text-ink-gray-6">Vérifiée par {{ ticket.creance_verifiee_par }}</span>
		</div>
		<div class="flex flex-wrap gap-2">
			<button
				v-for="option in OPTIONS"
				:key="option"
				type="button"
				:class="current === option ? 'chip-on' : 'chip-off'"
				class="disabled:cursor-not-allowed disabled:opacity-50"
				:aria-pressed="current === option"
				:disabled="isDisabled(option)"
				@click="pick(option)"
			>
				{{ option }}
			</button>
		</div>
		<p v-if="ticket.motif_blocage_creance && !blocking" class="whitespace-pre-line text-ink-gray-7">{{ ticket.motif_blocage_creance }}</p>
		<div v-if="blocking" class="flex flex-col gap-2">
			<label class="block">
				<span class="field-label">Motif du blocage (obligatoire)</span>
				<input v-model="motif" class="field-input" type="text" placeholder="Ex. : facture impayée, relance en cours" :disabled="busy" />
			</label>
			<div class="flex flex-wrap gap-2">
				<button type="button" class="btn-danger" :disabled="busy || !motif.trim()" @click="confirmBlock">Bloquer le ticket</button>
				<button type="button" class="btn-secondary" :disabled="busy" @click="blocking = false">Annuler</button>
			</div>
		</div>
	</div>
</template>
