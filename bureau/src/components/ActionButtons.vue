<script setup lang="ts">
import { computed } from 'vue'
import { runAction } from '@/lib/api'
import { ticketActions, type TicketAction } from '@/lib/display'
import type { Perform, TicketDetail } from '@/types'

/** `except` : actions déjà proposées ailleurs. `secondary` : aucune action principale, elle reste à l'encart d'étape. `inMenu` : lignes du menu `⋯`. */
const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform; only?: string[]; except?: string[]; secondary?: boolean; inMenu?: boolean }>()

const actions = computed(() => ticketActions(props.ticket).filter((item) => (!props.only || props.only.includes(item.action)) && !props.except?.includes(item.action)))
function styleOf(item: TicketAction) {
	if (props.inMenu) return item.style === 'btn-danger' ? 'app-menu-item text-tone-red' : 'app-menu-item'
	return props.secondary && item.style === 'btn-primary' ? 'btn-secondary' : item.style
}

function start(item: TicketAction) {
	if (item.confirm && !window.confirm(item.confirm)) return
	props.perform(() => runAction(props.ticket, item.action))
}
</script>

<template>
	<button v-for="item in actions" :key="item.action" type="button" :class="styleOf(item)" :disabled="busy || item.disabled" @click="start(item)">{{ item.label }}</button>
</template>
