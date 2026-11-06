<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { setChecklist } from '@/lib/api'
import type { Perform, TicketDetail } from '@/types'

const props = defineProps<{ ticket: TicketDetail; busy: boolean; perform: Perform }>()
const editable = computed(() => props.ticket.can_write && props.ticket.status === 'En Cours')

function toggle(fieldname: string, event: Event) {
	const box = event.target as HTMLInputElement
	const checked = box.checked
	// La case reflète le serveur : elle ne change qu'une fois l'enregistrement accepté.
	box.checked = !checked
	props.perform(() => setChecklist(props.ticket, fieldname, checked))
}
</script>

<template>
	<div class="card flex flex-col gap-1 p-3.5">
		<h3 class="mb-1 text-base font-semibold">Liste de contrôle</h3>
		<label v-for="item in ticket.checklist" :key="item.fieldname" class="flex min-h-[var(--ctl)] items-center gap-2.5" :class="editable ? 'cursor-pointer' : 'cursor-not-allowed'">
			<input type="checkbox" class="h-4 w-4" :checked="item.checked" :disabled="busy || !editable || Boolean(item.detected?.length)" @change="toggle(item.fieldname, $event)" />
			{{ item.label }}
			<span v-if="item.detected?.length" class="text-sm text-ink-gray-6">
				Détectée :
				<template v-for="(name, index) in item.detected" :key="name"><template v-if="index">, </template><RouterLink class="text-link" :to="{ name: 'Demande', params: { id: name } }">{{ name }}</RouterLink></template>
			</span>
		</label>
	</div>
</template>
