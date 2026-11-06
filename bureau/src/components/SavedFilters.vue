<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import LucideX from '~icons/lucide/x'
import { deleteSavedFilter, getSavedFilters, saveFilter, type SavedFilter } from '@/lib/api'
import { conditionsForServer, type Condition } from '@/lib/filters'

/** Filtres enregistrés de la liste : les mêmes que dans le Desk. La liste passe au-dessus des conditions, l'enregistrement en dessous. */
const props = defineProps<{ doctype: string; conditions: Condition[]; canSave: boolean }>()
const emit = defineEmits<{ apply: [conditions: Condition[]] }>()

const saved = ref<SavedFilter[]>([])
const canShare = ref(false)
const loaded = ref(false)
const error = ref('')
const notice = ref('')
const name = ref('')
const shared = ref(false)
const busy = ref(false)
const removing = ref<string | null>(null)

const signature = (conditions: Pick<Condition, 'doctype' | 'field' | 'op' | 'value'>[]) => JSON.stringify(conditionsForServer(conditions.map((condition, id) => ({ id, ...condition }))))
const currentSignature = computed(() => signature(props.conditions))
const complete = computed(() => conditionsForServer(props.conditions).length > 0)

async function load() {
	try {
		const response = await getSavedFilters(props.doctype)
		saved.value = response.filters
		canShare.value = response.can_share
		error.value = ''
	} catch (e) {
		error.value = `Les filtres enregistrés n'ont pas pu être chargés : ${(e as Error).message}`
	} finally {
		loaded.value = true
	}
}
onMounted(load)
watch(() => props.doctype, load)

function apply(filter: SavedFilter) {
	notice.value = filter.dropped ? `${filter.dropped === 1 ? 'Une condition de ce filtre porte' : `${filter.dropped} conditions de ce filtre portent`} sur un champ indisponible ici : elle${filter.dropped === 1 ? ' est ignorée' : 's sont ignorées'}.` : ''
	emit('apply', filter.conditions.map((condition, index) => ({ ...condition, id: index + 1 })))
}
async function save() {
	const label = name.value.trim()
	if (!label || busy.value) return
	busy.value = true
	error.value = ''
	try {
		await saveFilter(props.doctype, label, props.conditions, shared.value)
		name.value = ''
		shared.value = false
		await load()
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
async function remove(filter: SavedFilter) {
	busy.value = true
	error.value = ''
	try {
		await deleteSavedFilter(filter.name)
		removing.value = null
		await load()
	} catch (e) {
		error.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
</script>

<template>
	<div v-if="canSave || saved.length" class="flex flex-col gap-1">
		<span class="field-label mb-0">Filtres enregistrés</span>
		<div class="card flex flex-col gap-0.5 p-2">
			<p v-if="!saved.length" class="text-ink-gray-6">{{ loaded ? 'Aucun filtre enregistré.' : 'Chargement…' }}</p>
			<div v-for="filter in saved" :key="filter.name" class="saved-filter" :aria-current="signature(filter.conditions) === currentSignature ? 'true' : undefined">
				<template v-if="removing === filter.name">
					<span class="min-w-0 flex-1 truncate">Supprimer « {{ filter.label }} » ?</span>
					<button type="button" class="text-sm font-medium text-tone-red" :disabled="busy" @click="remove(filter)">Supprimer</button>
					<button type="button" class="text-sm font-medium" :disabled="busy" @click="removing = null">Annuler</button>
				</template>
				<template v-else>
					<button type="button" class="saved-filter-apply" :title="filter.label" @click="apply(filter)">{{ filter.label }}</button>
					<span class="saved-filter-scope">{{ filter.is_global ? 'Tout le monde' : 'Pour moi' }}</span>
					<button v-if="filter.can_delete" type="button" class="saved-filter-remove" :aria-label="`Supprimer ${filter.label}`" @click="removing = filter.name"><LucideX class="h-3 w-3" aria-hidden="true" /></button>
				</template>
			</div>
		</div>
		<p v-if="notice" role="status" class="rounded-control tone-amber px-2.5 py-1.5 text-sm">{{ notice }}</p>
	</div>

	<slot></slot>

	<p v-if="error" role="alert" class="rounded-control tone-red px-2.5 py-1.5 text-sm">{{ error }}</p>
	<form v-if="canSave && complete" class="flex flex-col gap-1" @submit.prevent="save">
		<span class="field-label mb-0">Enregistrer ces conditions</span>
		<div class="flex gap-1.5">
			<input v-model="name" class="field-input min-w-0 flex-1" type="text" aria-label="Nom du filtre" placeholder="Nom du filtre" />
			<button type="submit" class="btn-secondary" :disabled="busy || !name.trim()">Enregistrer</button>
		</div>
		<label v-if="canShare" class="export-choice"><input v-model="shared" type="checkbox" /> Pour tout le monde</label>
	</form>
</template>
