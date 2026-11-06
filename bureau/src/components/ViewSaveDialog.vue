<script setup lang="ts">
import { ref } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'

/** Enregistrer la disposition affichée sous une nouvelle vue. */
const props = defineProps<{ summary: string; canShare: boolean; save: (name: string, isGlobal: boolean, makeDefault: boolean) => Promise<void> }>()
const emit = defineEmits<{ close: []; saved: [name: string] }>()

const name = ref('')
const makeDefault = ref(true)
const shared = ref(false)
const busy = ref(false)
const error = ref('')

async function submit() {
	const label = name.value.trim()
	if (!label || busy.value) return
	busy.value = true
	error.value = ''
	try {
		await props.save(label, shared.value, makeDefault.value)
		emit('saved', label)
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<FormDialog class="view-save-dialog" title="Enregistrer sous une nouvelle vue" :dirty="Boolean(name.trim())" :busy="busy" hint="Ctrl + Entrée pour enregistrer" @close="emit('close')" @submit="submit">
		<form class="flex flex-col gap-3" @submit.prevent="submit">
			<label class="flex flex-col gap-1">
				<span class="field-label mb-0">Nom de la vue</span>
				<input v-model="name" class="field-input" type="text" placeholder="Créances à relancer" />
			</label>
			<p class="rounded-control bg-surface-gray-2 px-2.5 py-2 text-sm text-ink-gray-7">Cette vue retiendra : {{ summary }}.</p>
			<label class="export-choice"><input v-model="makeDefault" type="checkbox" /> En faire ma vue par défaut sur cette liste</label>
			<label v-if="canShare" class="export-choice"><input v-model="shared" type="checkbox" /> Pour tout le monde</label>
			<p v-if="error" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ error }}</p>
		</form>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy || !name.trim()" @click="submit">Enregistrer la vue</button>
		</template>
	</FormDialog>
</template>
