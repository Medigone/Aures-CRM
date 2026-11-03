<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import ClientPicker from '@/components/ClientPicker.vue'
import NotesField from '@/components/NotesField.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition } from '@/lib/geo'
import { toServerDateTime } from '@/lib/format'
import { localKey, refTo } from '@/lib/mutations'
import { gpsText, todayIso } from '@/lib/text'

const store = useCommercialStore()
const route = useRoute()
const router = useRouter()

const client = ref<string | null>((route.query.client as string) || null)
const date = ref<string>((route.query.date as string) || todayIso())
const type = ref<string>('')
const notes = ref('')
const error = ref<string | null>(null)
const busy = ref(false)
const types = computed(() => store.references?.types_visite ?? [])
const isToday = computed(() => date.value === todayIso())

function create() {
	if (!client.value) error.value = 'Choisissez le client.'
	else if (!type.value) error.value = 'Choisissez le type de visite.'
	else error.value = null
	if (error.value) return null
	const id = store.enqueue('visite_create', {
		...refTo('client', client.value),
		type_visite: type.value,
		date: date.value,
		notes: notes.value ? `<p>${notes.value.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>` : null,
	})
	return localKey(id)
}

function plan() {
	const key = create()
	if (key) router.replace({ name: 'Visit', params: { id: key } })
}

async function startNow() {
	const key = create()
	if (!key) return
	busy.value = true
	const position = await currentPosition(10000)
	store.enqueue('visite_start', { ...refTo('visite', key), debut: toServerDateTime(), gps: gpsText(position) }, key)
	busy.value = false
	router.replace({ name: 'Visit', params: { id: key } })
}
</script>

<template>
	<div>
		<PageHeader title="Nouvelle visite" :back="{ name: 'Today' }" />
		<div class="space-y-4">
			<div>
				<span class="field-label">Client</span>
				<ClientPicker v-model="client" />
			</div>
			<div>
				<span class="field-label">Type de visite</span>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de visite">
					<button v-for="t in types" :key="t" type="button" role="radio" :aria-checked="type === t" :class="type === t ? 'chip-on' : 'chip-off'" @click="type = t">{{ t }}</button>
				</div>
			</div>
			<label class="block">
				<span class="field-label">Date</span>
				<input v-model="date" type="date" class="field-input" />
			</label>
			<NotesField v-model="notes" label="Objectif de la visite" />
			<p v-if="error" class="text-sm text-ink-red-3">{{ error }}</p>
			<div class="flex gap-2">
				<button type="button" class="btn-secondary flex-1" @click="plan">Planifier</button>
				<button v-if="isToday" type="button" class="btn-primary flex-1" :disabled="busy" @click="startNow">{{ busy ? 'Localisation…' : 'Démarrer maintenant' }}</button>
			</div>
		</div>
	</div>
</template>
