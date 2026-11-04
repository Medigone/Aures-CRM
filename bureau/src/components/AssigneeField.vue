<script setup lang="ts">
import type { Option, TicketDetail } from '@/types'

defineProps<{ inputId: string; ticket: TicketDetail; options: Option[]; canAssign: boolean; busy: boolean }>()
const emit = defineEmits<{ assign: [user: string] }>()
</script>

<template>
	<select v-if="canAssign" :id="inputId" class="field-input w-full" :value="ticket.assigne_a || ''" :disabled="busy" @change="emit('assign', ($event.target as HTMLSelectElement).value)">
		<option v-if="!ticket.assigne_a" value="">Non attribué</option>
		<option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option>
	</select>
	<span v-else class="truncate">{{ ticket.assigne_a_nom || 'Non attribué' }}</span>
</template>
