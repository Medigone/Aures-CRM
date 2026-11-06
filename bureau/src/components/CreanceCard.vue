<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LucideCheck from '~icons/lucide/check'
import HeaderMenu from './HeaderMenu.vue'
import { setCreance } from '@/lib/api'
import type { Perform, TicketDetail } from '@/types'

/** La saisie reste dans la carte ; les décisions passent dans la barre d'actions de l'en-tête (`actionsBar`). */
const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform; actionsBar: HTMLElement | null }>()

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
	<Teleport v-if="actionsBar && editable" :to="actionsBar">
		<template v-if="blocking">
			<button type="button" class="btn-danger" :disabled="busy || !motif.trim()" @click="confirmBlock">Bloquer le ticket</button>
			<button type="button" class="btn-secondary" :disabled="busy" @click="blocking = false">Annuler le blocage</button>
		</template>
		<HeaderMenu v-else label="Créance" :value="current" :aria-label="`Créance : ${current}`" :disabled="busy">
			<template #default="{ close }">
				<button v-for="option in OPTIONS" :key="option" type="button" class="app-menu-item disabled:cursor-not-allowed disabled:opacity-50" role="menuitemradio" :aria-checked="current === option" :disabled="isDisabled(option)" @click="close(); pick(option)">
					<LucideCheck class="h-3.5 w-3.5 flex-none" :class="current !== option && 'invisible'" aria-hidden="true" />
					{{ option }}
				</button>
			</template>
		</HeaderMenu>
	</Teleport>
	<div class="card flex flex-col gap-2 p-3.5">
		<div class="flex items-baseline justify-between gap-2">
			<h3 class="text-base font-semibold">Créance du client</h3>
			<span v-if="ticket.creance_verifiee_par" class="text-xs text-ink-gray-6">Vérifiée par {{ ticket.creance_verifiee_par }}</span>
		</div>
		<p class="text-sm">
			<span class="text-ink-gray-6">Statut : </span>
			<span class="font-medium">{{ ticket.statut_creance || 'Non vérifiée' }}</span>
		</p>
		<p v-if="ticket.motif_blocage_creance && !blocking" class="whitespace-pre-line text-ink-gray-7">{{ ticket.motif_blocage_creance }}</p>
		<label v-if="blocking" class="block">
			<span class="field-label">Motif du blocage (obligatoire)</span>
			<input v-model="motif" class="field-input" type="text" placeholder="Ex. : facture impayée, relance en cours" :disabled="busy" />
		</label>
	</div>
</template>
