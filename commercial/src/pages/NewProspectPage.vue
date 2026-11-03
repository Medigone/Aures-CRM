<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import LucideMapPin from '~icons/lucide/map-pin'
import PageHeader from '@/components/PageHeader.vue'
import { useCommercialStore } from '@/stores/commercial'
import { currentPosition } from '@/lib/geo'
import { normalizeSearch } from '@/lib/format'
import { localKey } from '@/lib/mutations'
import { gpsText } from '@/lib/text'

const store = useCommercialStore()
const router = useRouter()
const form = reactive({ customer_name: '', contact: '', telephone: '', email: '', wilaya: '', commune: '', gps: '' as string })
const error = ref<string | null>(null)
const locating = ref(false)

const wilayas = computed(() => store.references?.wilayas ?? [])
const communes = computed(() => (store.references?.communes ?? []).filter((c) => !form.wilaya || c.wilaya === form.wilaya))
watch(
	() => form.wilaya,
	() => {
		if (form.commune && !communes.value.some((c) => c.name === form.commune)) form.commune = ''
	},
)
/** Doublon probable (même raison sociale, sans accents ni casse) dans le portefeuille. */
const duplicate = computed(() => {
	const name = normalizeSearch(form.customer_name.trim())
	return name ? store.clients.find((c) => normalizeSearch(c.customer_name) === name) ?? null : null
})

async function locate() {
	locating.value = true
	form.gps = gpsText(await currentPosition()) || ''
	if (!form.gps) error.value = 'Position indisponible : autorisez la localisation.'
	locating.value = false
}

function save() {
	if (!form.customer_name.trim()) {
		error.value = 'La raison sociale est obligatoire.'
		return
	}
	if (duplicate.value) {
		error.value = `« ${duplicate.value.customer_name} » est déjà dans votre portefeuille.`
		return
	}
	const id = store.enqueue('prospect_create', { ...form, customer_name: form.customer_name.trim(), gps: form.gps || null })
	router.replace({ name: 'Client', params: { id: localKey(id) } })
}
</script>

<template>
	<div>
		<PageHeader title="Nouveau prospect" :back="{ name: 'Clients' }" />
		<div class="space-y-4">
			<label class="block">
				<span class="field-label">Raison sociale *</span>
				<input v-model="form.customer_name" type="text" class="field-input" autocomplete="organization" />
			</label>
			<label class="block">
				<span class="field-label">Contact principal</span>
				<input v-model="form.contact" type="text" class="field-input" />
			</label>
			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="field-label">Téléphone</span>
					<input v-model="form.telephone" type="tel" class="field-input" />
				</label>
				<label class="block">
					<span class="field-label">Email</span>
					<input v-model="form.email" type="email" class="field-input" />
				</label>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<label class="block">
					<span class="field-label">Wilaya</span>
					<select v-model="form.wilaya" class="field-input">
						<option value="">—</option>
						<option v-for="w in wilayas" :key="w.name" :value="w.name">{{ w.code ? `${w.code} · ` : '' }}{{ w.wilaya }}</option>
					</select>
				</label>
				<label class="block">
					<span class="field-label">Commune</span>
					<select v-model="form.commune" class="field-input">
						<option value="">—</option>
						<option v-for="c in communes" :key="c.name" :value="c.name">{{ c.commune }}</option>
					</select>
				</label>
			</div>
			<div>
				<button type="button" class="btn-secondary w-full" :disabled="locating" @click="locate">
					<LucideMapPin class="h-4 w-4" aria-hidden="true" />{{ locating ? 'Localisation…' : form.gps ? 'Position enregistrée · actualiser' : 'Enregistrer ma position ici' }}
				</button>
				<p v-if="form.gps" class="mt-1 text-xs text-ink-gray-6">{{ form.gps }}</p>
			</div>
			<p v-if="error" class="text-sm text-ink-red-3">{{ error }}</p>
			<button type="button" class="btn-primary w-full" @click="save">Créer le prospect</button>
		</div>
	</div>
</template>
