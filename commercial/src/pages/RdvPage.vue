<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import ClientPicker from '@/components/ClientPicker.vue'
import StatusPill from '@shared/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { localKey, refTo } from '@/lib/mutations'
import { fromInputDateTime, inputDateTimeIn, stripHtml, toInputDateTime } from '@/lib/text'

/** Rendez-vous client : création (`/rdv/nouveau`) ou suivi (statut, report, démarrage de la visite). */
const props = defineProps<{ id?: string }>()
const store = useCommercialStore()
const route = useRoute()
const router = useRouter()

const key = computed(() => (props.id ? store.resolveKey(props.id) : null))
watch(key, (next) => {
	if (props.id && next && next !== props.id) router.replace({ name: 'Rdv', params: { id: next } })
})
const rdv = computed(() => (key.value ? store.rdvByName.get(key.value) ?? null : null))
const isNew = computed(() => !props.id)

const client = ref<string | null>((route.query.client as string) || null)
const dateHeure = ref(inputDateTimeIn(60))
const details = ref('')
const error = ref<string | null>(null)
watch(
	rdv,
	(r) => {
		if (!r) return
		client.value = r.client
		dateHeure.value = toInputDateTime(r.date_heure)
		details.value = stripHtml(r.details)
	},
	{ immediate: true },
)
const statuts = computed(() => store.references?.statuts_rdv?.length ? store.references.statuts_rdv : ['En Attente', 'Confirmé', 'Reporté', 'Terminé', 'Non Honoré'])
const clientRow = computed(() => (client.value ? store.clientsByName.get(client.value) ?? null : null))

function create() {
	if (!client.value || !dateHeure.value) {
		error.value = 'Choisissez le client et la date.'
		return
	}
	const id = store.enqueue('rdv_create', { ...refTo('client', client.value), date_heure: fromInputDateTime(dateHeure.value), details: details.value || null })
	router.replace({ name: 'Rdv', params: { id: localKey(id) } })
}

function update(changes: Record<string, unknown>) {
	if (!rdv.value) return
	store.enqueue('rdv_update', { ...refTo('rdv', rdv.value.name), ...changes }, rdv.value.name)
}

function reschedule() {
	update({ date_heure: fromInputDateTime(dateHeure.value), details: details.value || null, status: 'Reporté' })
}

/** Le rendez-vous a lieu : une visite est créée (liée au RDV), et le RDV est marqué terminé. */
function startVisit() {
	if (!rdv.value?.client) return
	const id = store.enqueue('visite_create', { ...refTo('client', rdv.value.client), type_visite: 'Suivi Client', date_rdv: rdv.value.date_heure })
	update({ status: 'Terminé' })
	router.push({ name: 'Visit', params: { id: localKey(id) } })
}
</script>

<template>
	<div>
		<PageHeader :title="isNew ? 'Nouveau rendez-vous' : rdv?.raison_sociale || clientRow?.customer_name || 'Rendez-vous'" :back="{ name: 'Week' }">
			<template v-if="rdv" #actions>
				<span v-if="rdv._pending" class="pending-dot" title="En attente d'envoi" />
				<StatusPill :status="rdv.status" />
			</template>
		</PageHeader>

		<p v-if="!isNew && !rdv" class="py-10 text-center text-ink-gray-6">Ce rendez-vous n'est pas sur cet appareil.</p>
		<div v-else class="space-y-4">
			<div v-if="isNew">
				<span class="field-label">Client</span>
				<ClientPicker v-model="client" />
			</div>
			<RouterLink v-else-if="clientRow" :to="{ name: 'Client', params: { id: clientRow.name } }" class="block text-sm text-accent">Voir la fiche client</RouterLink>
			<label class="block">
				<span class="field-label">Date et heure</span>
				<input v-model="dateHeure" type="datetime-local" class="field-input" />
			</label>
			<label class="block">
				<span class="field-label">Objet</span>
				<textarea v-model="details" rows="3" class="field-input" placeholder="Présentation, négociation, échantillons…" />
			</label>
			<p v-if="error" class="text-sm text-ink-red-3">{{ error }}</p>

			<button v-if="isNew" type="button" class="btn-primary w-full" @click="create">Enregistrer le rendez-vous</button>
			<template v-else-if="rdv">
				<button v-if="rdv.status !== 'Terminé'" type="button" class="btn-primary w-full" @click="startVisit">Démarrer la visite</button>
				<button type="button" class="btn-secondary w-full" @click="reschedule">Reporter à cette date</button>
				<div>
					<span class="field-label">Statut</span>
					<div class="flex flex-wrap gap-2">
						<button v-for="s in statuts" :key="s" type="button" :class="rdv.status === s ? 'chip-on' : 'chip-off'" @click="update({ status: s })">{{ s }}</button>
					</div>
				</div>
			</template>
		</div>
	</div>
</template>
