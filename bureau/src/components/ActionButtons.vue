<script setup lang="ts">
import { computed } from 'vue'
import { runAction } from '@/lib/api'
import { ticketActions, type TicketAction } from '@/lib/display'
import type { Perform, TicketDetail } from '@/types'

const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform; only?: string[] }>()

const actions = computed(() => ticketActions(props.ticket).filter((item) => !props.only || props.only.includes(item.action)))

function start(item: TicketAction) {
	if (item.confirm && !window.confirm(item.confirm)) return
	props.perform(() => runAction(props.ticket, item.action))
}
</script>

<template>
	<button v-for="item in actions" :key="item.action" type="button" :class="item.style" :disabled="busy || item.disabled" @click="start(item)">{{ item.label }}</button>
</template>
