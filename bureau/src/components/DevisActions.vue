<script setup lang="ts">
import { computed, ref } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { moneyText, type DevisDetail } from '@/lib/devis'

/** Fenêtres des décisions d'un devis : valider, créer la commande, perdu, annuler. Les écritures viennent de `useDevis`. */
const props = defineProps<{
	devis: DevisDetail
	busy: boolean
	validate: () => Promise<boolean>
	order: () => Promise<string>
	lose: (values: { raison: string; concurrent: string; precisions: string }) => Promise<boolean>
	cancel: () => Promise<boolean>
}>()
const emit = defineEmits<{ ordered: [commande: string] }>()

type Dialog = 'valider' | 'commande' | 'perdu' | 'annuler'
const open = ref<Dialog | null>(null)
const raison = ref('')
const concurrent = ref('')
const precisions = ref('')
const reste = computed(() => props.devis.lignes.length)

function run(action: Dialog) {
	raison.value = ''
	concurrent.value = ''
	precisions.value = ''
	open.value = action
}
async function confirm() {
	const action = open.value
	if (!action) return
	if (action === 'perdu' && !raison.value) return
	open.value = null
	if (action === 'valider') await props.validate()
	else if (action === 'annuler') await props.cancel()
	else if (action === 'perdu') await props.lose({ raison: raison.value, concurrent: concurrent.value.trim(), precisions: precisions.value.trim() })
	else {
		const commande = await props.order()
		if (commande) emit('ordered', commande)
	}
}
defineExpose({ run })
</script>

<template>
	<FormDialog v-if="open === 'valider'" :title="`Valider ${devis.name} ?`" :dirty="false" hint="" @close="open = null" @submit="confirm">
		<p class="m-0">Le devis ne se modifiera plus. Le commercial est prévenu sur son téléphone pour le remettre au client.</p>
		<dl class="side-kv mt-2">
			<div><dt>Total TTC</dt><dd class="tabular-nums">{{ moneyText(devis.total_ttc) }} DA</dd></div>
			<div><dt>Lignes</dt><dd class="tabular-nums">{{ reste }}</dd></div>
		</dl>
		<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="confirm">Valider le devis</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'commande'" :title="`Créer la commande de ${devis.name} ?`" :dirty="false" hint="" @close="open = null" @submit="confirm">
		<p class="m-0">{{ devis.status === 'Partially Ordered' ? 'La commande reprend les articles qui restent à commander.' : 'La commande reprend tout le devis.' }} Elle est créée en brouillon et s'ouvre sur le Desk pour être complétée.</p>
		<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="confirm">Créer la commande</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'perdu'" :title="`Marquer ${devis.name} perdu ?`" :dirty="Boolean(raison || concurrent || precisions)" hint="" @close="open = null" @submit="confirm">
		<label class="form-field">
			<span class="field-label">Raison de la perte</span>
			<select v-model="raison" class="field-input" required :aria-invalid="!raison ? undefined : 'false'">
				<option value="">Choisir une raison…</option>
				<option v-for="item in devis.raisons_perte" :key="item" :value="item">{{ item }}</option>
			</select>
			<small class="text-xs text-ink-gray-6">Obligatoire. Les raisons se gèrent sur le Desk, dans « Raison de perte de devis ».</small>
		</label>
		<label class="form-field"><span class="field-label">Concurrent retenu</span><input v-model="concurrent" class="field-input" placeholder="Facultatif" /></label>
		<label class="form-field"><span class="field-label">Précisions</span><textarea v-model="precisions" class="field-input" rows="3" placeholder="Facultatif : prix du concurrent, ce que le client a dit…"></textarea></label>
		<template #actions><button type="button" class="btn-danger" :disabled="busy || !raison" @click="confirm">Marquer perdu</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'annuler'" :title="`Annuler ${devis.name} ?`" :dirty="false" hint="" @close="open = null" @submit="confirm">
		<p class="m-0">L'annulation est définitive. Pour corriger un devis validé, annulez-le puis modifiez sa copie sur le Desk.</p>
		<template #actions><button type="button" class="btn-danger" :disabled="busy" @click="confirm">Annuler le devis</button></template>
	</FormDialog>
</template>
