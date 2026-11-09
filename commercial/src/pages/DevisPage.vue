<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import EnvoiDevisSheet from '@/components/EnvoiDevisSheet.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import SaleLines from '@/components/SaleLines.vue'
import { useCommercialStore } from '@/stores/commercial'
import { formatDay } from '@/lib/format'
import { formatMoney, todayIso } from '@/lib/text'
import { devisPdfUrl, envoiState, type EnvoiInfo } from '@/lib/devisEnvoi'

const props = defineProps<{ id: string }>()
const store = useCommercialStore()
const devis = computed(() => store.devisByName.get(props.id) ?? null)
const commandes = computed(() => store.commandes.filter((c) => c.devis === props.id))
const expire = computed(() => Boolean(devis.value?.valid_till && devis.value.valid_till < todayIso()))

// L'envoi vient d'être fait : affiché tout de suite, la synchro suivante le confirme.
const sentNow = ref<NonNullable<EnvoiInfo['envoi']> | null>(null)
const envoye = computed(() => (sentNow.value ? { le: sentNow.value.le, canal: sentNow.value.canal } : devis.value?.envoye_le ? { le: devis.value.envoye_le, canal: devis.value.canal_envoi ?? null } : null))
const etat = computed(() => (devis.value ? envoiState({ ...devis.value, envoye_le: envoye.value?.le ?? null }) : null))
// Les champs d'envoi existent après la migration : avant, la synchro ne les envoie pas et rien ne se propose.
const envoiPossible = computed(() => Boolean(devis.value && 'envoye_le' in devis.value))
const sheet = ref(false)
function onSent(envoi: NonNullable<EnvoiInfo['envoi']>) {
	sentNow.value = envoi
	store.sync()
}
</script>

<template>
	<div v-if="!devis" class="py-10 text-center text-ink-gray-6">
		<PageHeader title="Devis introuvable" :back="{ name: 'Suivi' }" />
		Ce devis n'est pas sur cet appareil (devis des 12 derniers mois).
	</div>
	<div v-else :class="envoiPossible && devis.docstatus === 1 && 'pb-28'">
		<PageHeader :title="devis.name" :subtitle="devis.customer_name || devis.client" :back="{ name: 'Suivi' }">
			<template #actions>
				<StatusPill v-if="envoiPossible && etat === 'a_envoyer'" status="À envoyer" tone="amber" />
				<StatusPill v-else-if="envoiPossible && etat === 'envoye' && ['Open', 'Replied'].includes(devis.status)" status="Envoyé" tone="blue" />
				<StatusPill v-else :status="devis.docstatus === 0 ? 'Brouillon' : devis.status" />
			</template>
		</PageHeader>
		<p v-if="envoiPossible && envoye" class="mb-4 rounded-2xl tone-green px-4 py-3 text-sm">Envoyé au client{{ envoye.canal ? ` par ${envoye.canal}` : '' }} le {{ formatDay(envoye.le) }}.</p>
		<section class="card mb-4 divide-y divide-outline-gray-1 text-sm">
			<RouterLink :to="{ name: 'Client', params: { id: devis.client } }" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Client</span><span class="font-medium text-accent">{{ devis.customer_name || devis.client }}</span>
			</RouterLink>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Date</span><span class="font-medium">{{ formatDay(devis.date) }}</span></div>
			<div v-if="devis.valid_till" class="flex justify-between gap-4 px-3 py-2.5">
				<span class="text-ink-gray-6">Valable jusqu'au</span><span class="font-medium" :class="expire && 'text-ink-red-3'">{{ formatDay(devis.valid_till) }}</span>
			</div>
			<div class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Montant</span><span class="font-semibold">{{ formatMoney(devis.grand_total, devis.currency) }}</span></div>
			<div v-if="devis.statut_commande" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Commande</span><StatusPill :status="devis.statut_commande" /></div>
			<div v-if="devis.demande_faisabilite" class="flex justify-between gap-4 px-3 py-2.5"><span class="text-ink-gray-6">Demande de faisabilité</span><span class="font-medium">{{ devis.demande_faisabilite }}</span></div>
		</section>
		<h2 class="section-title mb-2">Articles</h2>
		<SaleLines :lignes="devis.lignes" :currency="devis.currency" class="mb-4" />
		<template v-if="commandes.length">
			<h2 class="section-title mb-2">Commandes</h2>
			<div class="space-y-2">
				<RouterLink v-for="c in commandes" :key="c.name" :to="{ name: 'Commande', params: { id: c.name } }" class="card-link flex justify-between gap-2 p-3 text-sm">
					<span class="font-medium">{{ c.name }}<template v-if="c.bon_commande_client"> · BC {{ c.bon_commande_client }}</template></span>
					<StatusPill :status="c.status" />
				</RouterLink>
			</div>
		</template>

		<div v-if="envoiPossible && devis.docstatus === 1" class="action-bar">
			<a class="btn-secondary flex-1" :href="devisPdfUrl(devis.name)" target="_blank" rel="noopener noreferrer">Voir le PDF</a>
			<button v-if="etat && ['Open', 'Replied', 'Partially Ordered'].includes(devis.status)" type="button" class="flex-1" :class="etat === 'a_envoyer' ? 'btn-primary' : 'btn-secondary'" :disabled="!store.online" @click="sheet = true">
				{{ etat === 'a_envoyer' ? 'Envoyer au client' : 'Renvoyer' }}
			</button>
		</div>
		<p v-if="envoiPossible && etat && !store.online" class="mt-2 text-center text-sm text-ink-gray-6">Hors ligne : l'envoi au client demande une connexion.</p>
		<EnvoiDevisSheet v-if="sheet" :name="devis.name" :client="devis.customer_name || devis.client" @close="sheet = false" @sent="onSent" />
	</div>
</template>
