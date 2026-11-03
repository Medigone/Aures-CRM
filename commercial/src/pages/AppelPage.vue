<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import ClientPicker from '@/components/ClientPicker.vue'
import NotesField from '@/components/NotesField.vue'
import StatusPill from '@/components/StatusPill.vue'
import { useCommercialStore } from '@/stores/commercial'
import { toServerDateTime } from '@/lib/format'
import { refTo } from '@/lib/mutations'
import { fromInputDateTime, inputDateTimeIn, stripHtml, toInputDateTime } from '@/lib/text'

/** Appel téléphonique : noter un appel (`/appels/nouveau`) ou traiter un rappel. */
const props = defineProps<{ id?: string }>()
const store = useCommercialStore()
const route = useRoute()
const router = useRouter()

const key = computed(() => (props.id ? store.resolveKey(props.id) : null))
watch(key, (next) => {
	if (props.id && next && next !== props.id) router.replace({ name: 'Appel', params: { id: next } })
})
const appel = computed(() => (key.value ? store.appelsByName.get(key.value) ?? null : null))
const isNew = computed(() => !props.id)

const client = ref<string | null>((route.query.client as string) || null)
const type = ref('')
const status = ref('Répondu')
const notes = ref('')
const rappel = ref('')
const error = ref<string | null>(null)
watch(
	appel,
	(a) => {
		if (!a) return
		client.value = a.client
		type.value = a.type || ''
		status.value = a.status
		notes.value = stripHtml(a.notes)
		rappel.value = toInputDateTime(a.date_rappel)
	},
	{ immediate: true },
)
watch(status, (s) => {
	if (s === 'À Rappeler' && !rappel.value) rappel.value = inputDateTimeIn(24 * 60)
})
const types = computed(() => store.references?.types_appel ?? [])
const statuts = computed(() => store.references?.statuts_appel?.length ? store.references.statuts_appel : ['Répondu', 'À Rappeler', 'Non Répondu'])
const clientRow = computed(() => (client.value ? store.clientsByName.get(client.value) ?? null : null))
const telephone = computed(() => clientRow.value?.telephone_principal || clientRow.value?.telephone || null)

function payload() {
	return {
		type: type.value || null,
		status: status.value,
		notes: notes.value ? `<p>${notes.value.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` : null,
		date_rappel: status.value === 'À Rappeler' ? fromInputDateTime(rappel.value) : null,
	}
}

function save() {
	if (isNew.value) {
		if (!type.value) {
			error.value = "Choisissez le type d'appel."
			return
		}
		store.enqueue('appel_create', { ...refTo('client', client.value), ...payload(), heure: toServerDateTime() })
	} else if (appel.value) {
		store.enqueue('appel_update', { ...refTo('appel', appel.value.name), ...payload() }, appel.value.name)
	}
	if (window.history.state?.back) router.back()
	else router.replace(client.value ? { name: 'Client', params: { id: client.value } } : { name: 'Today' })
}
</script>

<template>
	<div>
		<PageHeader :title="isNew ? 'Noter un appel' : clientRow?.customer_name || 'Appel'" :back="{ name: 'Today' }">
			<template v-if="appel" #actions>
				<span v-if="appel._pending" class="pending-dot" title="En attente d'envoi" />
				<StatusPill :status="appel.status" />
			</template>
		</PageHeader>
		<p v-if="!isNew && !appel" class="py-10 text-center text-ink-gray-6">Cet appel n'est pas sur cet appareil.</p>
		<div v-else class="space-y-4">
			<div v-if="isNew">
				<span class="field-label">Client</span>
				<ClientPicker v-model="client" />
			</div>
			<RouterLink v-else-if="clientRow" :to="{ name: 'Client', params: { id: clientRow.name } }" class="block text-sm text-accent">Voir la fiche client</RouterLink>
			<a v-if="telephone" :href="`tel:${telephone}`" class="btn-secondary w-full">Appeler {{ telephone }}</a>
			<label class="block">
				<span class="field-label">Type</span>
				<select v-model="type" class="field-input">
					<option value="" disabled>Choisir…</option>
					<option v-for="t in types" :key="t" :value="t">{{ t }}</option>
				</select>
			</label>
			<div>
				<span class="field-label">Résultat</span>
				<div class="flex flex-wrap gap-2">
					<button v-for="s in statuts" :key="s" type="button" :class="status === s ? 'chip-on' : 'chip-off'" @click="status = s">{{ s }}</button>
				</div>
			</div>
			<label v-if="status === 'À Rappeler'" class="block">
				<span class="field-label">Rappeler le</span>
				<input v-model="rappel" type="datetime-local" class="field-input" />
			</label>
			<NotesField v-model="notes" />
			<p v-if="error" class="text-sm text-ink-red-3">{{ error }}</p>
			<button type="button" class="btn-primary w-full" @click="save">Enregistrer</button>
		</div>
	</div>
</template>
