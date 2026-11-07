<script setup lang="ts">
import { onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { getEtudeMachines, setEtudeMachine } from '@/lib/api'
import { machineStatusLabel, machineStatusTone, quantityLabel, type MachineRow, type PiecesResult } from '@/lib/etudePieces'
import type { EtudeDetail } from '@/lib/etudes'

/** Les presses du procédé, les mieux adaptées d'abord. Une alerte informe sans empêcher de choisir, comme sur le Desk. */
const props = defineProps<{ etude: EtudeDetail; current: string | null; hasImposition: boolean }>()
const emit = defineEmits<{ close: []; saved: [result: PiecesResult, message: string]; failed: [] }>()

const rows = ref<MachineRow[] | null>(null)
const busy = ref(false)
const error = ref('')
onMounted(async () => {
	try {
		rows.value = await getEtudeMachines(props.etude.name)
	} catch (e) {
		rows.value = []
		error.value = (e as Error).message
	}
})
async function choose(machine: string) {
	if (busy.value) return
	busy.value = true
	error.value = ''
	try {
		emit('saved', await setEtudeMachine(props.etude, machine), machine ? `Presse ${machine} choisie.` : 'Presse retirée.')
		emit('close')
	} catch (e) {
		error.value = (e as Error).message
		emit('failed')
	} finally {
		busy.value = false
	}
}
function passagesText(row: MachineRow) {
	if (!row.passages) return row.passages_raison || 'Passages non calculés'
	return `${row.passages} passage${row.passages > 1 ? 's' : ''}`
}
</script>

<template>
	<FormDialog title="Choisir la presse" :dirty="false" hint="" :busy="busy" @close="emit('close')">
		<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		<p v-if="rows === null" class="m-0 text-ink-gray-6">Chargement des presses…</p>
		<p v-else-if="!rows.length && !error" class="m-0 text-ink-gray-6">Aucune presse active pour ce procédé.</p>
		<ul v-else class="etude-picks">
			<li v-for="row in rows" :key="row.name" class="etude-pick" :data-current="row.name === current">
				<div class="min-w-0">
					<p class="etude-pick-name">
						<span>{{ row.nom }}</span>
						<StatusPill :status="machineStatusLabel(row.status)" :tone="machineStatusTone(row.status)" />
						<span v-if="row.name === current" class="badge tone-blue">Actuelle</span>
					</p>
					<p class="etude-pick-sub tabular-nums">
						{{ [row.modele, row.format && `format max ${row.format}`, row.couleurs && `${row.couleurs} couleurs${row.vernis ? ' + vernis' : ''}`, passagesText(row), hasImposition && row.passages ? `charge ${quantityLabel(row.charge)} feuilles` : ''].filter(Boolean).join(' · ') }}
					</p>
					<p v-for="alert in row.alertes" :key="alert.text" class="etude-pick-alert" :data-tone="alert.tone">{{ alert.text }}</p>
				</div>
				<button type="button" class="btn-secondary" :disabled="busy || row.name === current" @click="choose(row.name)">Choisir</button>
			</li>
		</ul>
		<template #actions><button v-if="current" type="button" class="btn-secondary" :disabled="busy" @click="choose('')">Aucune presse</button></template>
	</FormDialog>
</template>
