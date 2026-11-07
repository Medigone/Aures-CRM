<script setup lang="ts">
import { ref } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { runEtudeAction } from '@/lib/api'
import type { EtudeDetail } from '@/lib/etudes'

/** Décisions d'une étude, communes à l'aperçu et à la fiche. Démarrer part tout de suite ; une conclusion se confirme. */
const props = defineProps<{ etude: EtudeDetail; busy: boolean; perform: (action: () => Promise<EtudeDetail>) => Promise<boolean> }>()
const emit = defineEmits<{ done: [message: string] }>()

const DONE: Record<string, string> = { Démarrer: 'Étude démarrée.', Réalisable: 'Étude conclue : réalisable.', 'Non Réalisable': 'Étude conclue : non réalisable.', Annuler: 'Étude annulée.' }
const CONFIRM: Record<string, { title: string; text: string; button: string; danger?: boolean }> = {
	Réalisable: { title: 'Conclure cette étude réalisable ?', text: "L'étude est validée et ne se modifie plus. Sa demande pourra passer au devis.", button: 'Conclure réalisable' },
	'Non Réalisable': { title: 'Conclure cette étude non réalisable ?', text: "L'étude est validée et ne se modifie plus. Dites pourquoi dans les commentaires pour le back office.", button: 'Conclure non réalisable', danger: true },
	Annuler: { title: 'Annuler cette étude ?', text: "L'annulation est définitive.", button: "Annuler l'étude", danger: true },
}
const open = ref<string | null>(null)

async function apply(action: string) {
	open.value = null
	const done = await props.perform(() => runEtudeAction(props.etude, action))
	if (done) emit('done', DONE[action] ?? 'Étude mise à jour.')
}
function run(action: string) {
	if (CONFIRM[action]) open.value = action
	else apply(action)
}
defineExpose({ run })
</script>

<template>
	<FormDialog v-if="open" :title="`${etude.name} : ${CONFIRM[open].title}`" :dirty="false" hint="" @close="open = null">
		<p class="m-0">{{ CONFIRM[open].text }}</p>
		<template #actions><button type="button" :class="CONFIRM[open].danger ? 'btn-danger' : 'btn-primary'" :disabled="busy" @click="apply(open!)">{{ CONFIRM[open].button }}</button></template>
	</FormDialog>
</template>
