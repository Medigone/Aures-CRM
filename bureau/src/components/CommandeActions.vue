<script setup lang="ts">
import { ref } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { formatDay } from '@/lib/display'
import type { CommandeDetail } from '@/lib/commandes'

/** Fenêtres des décisions d'une commande : valider, annuler, supprimer le brouillon. Les écritures viennent de `useCommande`. */
const props = defineProps<{
	commande: CommandeDetail
	busy: boolean
	validate: () => Promise<boolean>
	cancel: (motif: string) => Promise<boolean>
	remove: () => Promise<unknown>
}>()

type Dialog = 'valider' | 'annuler' | 'supprimer'
const open = ref<Dialog | null>(null)
const motif = ref('')

function run(action: Dialog) {
	motif.value = ''
	open.value = action
}
async function confirm() {
	const action = open.value
	if (!action) return
	if (action === 'annuler' && !motif.value.trim()) return
	open.value = null
	if (action === 'valider') await props.validate()
	else if (action === 'annuler') await props.cancel(motif.value.trim())
	else await props.remove()
}
defineExpose({ run })
</script>

<template>
	<FormDialog v-if="open === 'valider'" :title="`Valider ${commande.name} ?`" :dirty="false" hint="" @close="open = null" @submit="confirm">
		<p class="m-0">La commande ne se modifiera plus. Cela va aussi :</p>
		<ul class="m-0 flex list-disc flex-col gap-1 pl-5 text-ink-gray-7">
			<li>créer le dossier de fabrication de {{ commande.lignes.length > 1 ? `ses ${commande.lignes.length} articles` : 'son article' }} ;</li>
			<li v-if="commande.devis">mettre à jour le devis {{ commande.devis }} ;</li>
			<li>prévenir {{ commande.commercial || 'le commercial' }} sur son téléphone.</li>
		</ul>
		<dl class="side-kv mt-2">
			<div><dt>Bon de commande</dt><dd class="tabular-nums">N° {{ commande.bon_commande }} du {{ formatDay(commande.date_bon) }}</dd></div>
			<div><dt>Scan</dt><dd>{{ commande.scan ? commande.scan.name : 'Non joint' }}</dd></div>
		</dl>
		<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="confirm">Valider la commande</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'annuler'" :title="`Annuler ${commande.name} ?`" :dirty="Boolean(motif)" hint="" @close="open = null" @submit="confirm">
		<label class="form-field">
			<span class="field-label">Motif</span>
			<textarea v-model="motif" class="field-input" rows="3" required placeholder="Le client a retiré sa commande, erreur de saisie…"></textarea>
			<small class="text-xs text-ink-gray-6">Obligatoire. Il est écrit dans le fil de la commande.</small>
		</label>
		<p class="m-0 text-ink-gray-7">L'annulation est définitive. Le devis {{ commande.devis || '' }} pourra recevoir une nouvelle commande.</p>
		<template #actions><button type="button" class="btn-danger" :disabled="busy || !motif.trim()" @click="confirm">Annuler la commande</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'supprimer'" :title="`Supprimer le brouillon ${commande.name} ?`" :dirty="false" hint="" @close="open = null" @submit="confirm">
		<p class="m-0">Le brouillon disparaît. Le devis {{ commande.devis || '' }} pourra recevoir une nouvelle commande.</p>
		<template #actions><button type="button" class="btn-danger" :disabled="busy" @click="confirm">Supprimer le brouillon</button></template>
	</FormDialog>
</template>
