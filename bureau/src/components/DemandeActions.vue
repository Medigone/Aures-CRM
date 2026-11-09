<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import FormDialog from '@shared/components/FormDialog.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import DemandeDialog from './DemandeDialog.vue'
import { cancelDemande, closeDemande, confirmDemande, createDevis, createRetirage } from '@/lib/api'
import { formatDraftQuantity, type DemandeAction, type DemandeDetail } from '@/lib/demandes'
import { deskUrl } from '@/lib/display'

/** Fenêtres des actions d'une demande, communes à l'aperçu et à la fiche. Une erreur revient dans la page qui les ouvre. */
const props = defineProps<{ demande: DemandeDetail; busy: boolean; perform: (action: () => Promise<DemandeDetail>) => Promise<boolean> }>()
const emit = defineEmits<{ error: [message: string] }>()

const router = useRouter()
const open = ref<DemandeAction | null>(null)
const devisCree = ref('')
const retirageDate = ref('')
const retirageBusy = ref(false)
const devisLines = computed(() => props.demande.etudes.filter((etude) => etude.status === 'Réalisable'))

function inDays(days: number) {
	const date = new Date()
	date.setDate(date.getDate() + days)
	const pad = (value: number) => String(value).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function run(action: DemandeAction) {
	if (action === 'retirage') retirageDate.value = inDays(7)
	open.value = action
}
defineExpose({ run })

async function confirm() {
	open.value = null
	await props.perform(() => confirmDemande(props.demande))
}
async function cancel() {
	open.value = null
	await props.perform(() => cancelDemande(props.demande))
}
async function close() {
	open.value = null
	await props.perform(() => closeDemande(props.demande))
}
async function devis() {
	open.value = null
	await props.perform(async () => {
		const result = await createDevis(props.demande)
		devisCree.value = result.quotation
		return result.demande
	})
}
async function retirage() {
	if (retirageBusy.value || !retirageDate.value) return
	retirageBusy.value = true
	try {
		const { name } = await createRetirage(props.demande, retirageDate.value)
		open.value = null
		router.push({ name: 'Demande', params: { id: name } })
	} catch (e) {
		open.value = null
		emit('error', (e as Error).message)
	} finally {
		retirageBusy.value = false
	}
}
function onSaved(saved: DemandeDetail) {
	open.value = null
	props.perform(async () => saved)
}
</script>

<template>
	<FormDialog v-if="open === 'confirm'" :title="`Confirmer la demande ${demande.name} ?`" :dirty="false" hint="" @close="open = null" @submit="confirm">
		<p class="m-0">Une étude de faisabilité sera créée pour chacun de ces articles :</p>
		<dl class="side-kv mt-2">
			<div v-for="line in demande.lines" :key="line.name"><dt>{{ line.designation }}</dt><dd class="tabular-nums">{{ formatDraftQuantity(String(line.quantite)) }}</dd></div>
		</dl>
		<p class="m-0 mt-2 text-ink-gray-6">La demande ne pourra plus être modifiée ensuite.</p>
		<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="confirm">Confirmer et lancer les études</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'cancel'" :title="`Annuler la demande ${demande.name} ?`" :dirty="false" hint="" @close="open = null">
		<template v-if="demande.cancel_blocking.length">
			<p class="m-0 rounded-control tone-red px-3 py-2"><strong class="font-semibold">Annulation impossible :</strong> {{ demande.cancel_blocking.length > 1 ? 'des études ont' : 'une étude a' }} déjà abouti. La demande pourra être fermée quand toutes ses études seront terminées.</p>
			<dl class="side-kv mt-2">
				<div v-for="etude in demande.cancel_blocking" :key="etude.name">
					<dt><RouterLink class="ref-link tabular-nums" :to="{ name: 'Etude', params: { id: etude.name } }">{{ etude.name }}</RouterLink></dt>
					<dd><StatusPill :status="etude.status" /></dd>
				</div>
			</dl>
		</template>
		<p v-else class="m-0">L'annulation supprime les études non finalisées. Elle est irréversible.</p>
		<template v-if="!demande.cancel_blocking.length" #actions><button type="button" class="btn-danger" :disabled="busy" @click="cancel">Annuler la demande</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'close'" :title="`Fermer la demande ${demande.name} ?`" :dirty="false" hint="" @close="open = null" @submit="close">
		<p class="m-0">La demande passe en Fermée. Ses études et ses devis ne changent pas.</p>
		<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="close">Fermer la demande</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'devis'" :title="`Créer le devis de ${demande.name} ?`" :dirty="false" hint="" @close="open = null" @submit="devis">
		<p class="m-0">Le devis reprend les articles réalisables, sans prix : ils se saisissent ensuite sur sa fiche.</p>
		<dl class="side-kv mt-2">
			<div v-for="etude in devisLines" :key="etude.name"><dt>{{ etude.designation }}</dt><dd class="tabular-nums">{{ formatDraftQuantity(String(etude.quantite)) }}</dd></div>
		</dl>
		<template #actions><button type="button" class="btn-primary" :disabled="busy" @click="devis">Créer le devis</button></template>
	</FormDialog>

	<FormDialog v-else-if="open === 'retirage'" :title="`Créer un retirage de ${demande.name}`" :dirty="false" :busy="retirageBusy" hint="" @close="open = null" @submit="retirage">
		<p class="m-0">Une nouvelle demande en brouillon reprend le client et les articles de celle-ci.</p>
		<div class="form-field mt-2">
			<label class="field-label" for="retirage-date">Nouvelle date de livraison souhaitée</label>
			<input id="retirage-date" v-model="retirageDate" class="field-input" type="date" />
			<small class="text-xs text-ink-gray-6">Appliquée à tous les articles de la nouvelle demande.</small>
		</div>
		<template #actions><button type="button" class="btn-primary" :disabled="retirageBusy || !retirageDate" @click="retirage">Créer le retirage</button></template>
	</FormDialog>

	<DemandeDialog v-else-if="open === 'edit'" :demande="demande" @close="open = null" @saved="onSaved" />

	<AppToast :message="devisCree ? `Devis ${devisCree} créé.` : ''" :duration="0" @close="devisCree = ''">
		<RouterLink class="app-toast-action" :to="{ name: 'DevisFiche', params: { id: devisCree } }" @click="devisCree = ''">Ouvrir le devis</RouterLink>
	</AppToast>
</template>
