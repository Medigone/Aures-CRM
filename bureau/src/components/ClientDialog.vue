<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import LucideInfo from '~icons/lucide/info'
import LucideSearch from '~icons/lucide/search'
import LucideX from '~icons/lucide/x'
import FormDialog from '@shared/components/FormDialog.vue'
import { createProspect, getClientOptions, searchClients, searchCommunes, updateClient } from '@/lib/api'
import { changedValues, clientFormValues, normalizeName, validateClient, type ClientDetail, type ClientField, type ClientOptions, type ClientValues, type CommuneChoice } from '@/lib/clients'
import type { ClientChoice } from '@/types'

/** Nouveau prospect, ou modification d'un client (`client`) : la même fenêtre, avec plus de champs pour un client existant. */
const props = defineProps<{ client?: ClientDetail }>()
const emit = defineEmits<{ close: []; created: [name: string]; saved: [client: ClientDetail] }>()

const editing = computed(() => Boolean(props.client))
const EMPTY: Required<ClientValues> = { customer_name: '', status: '', forme_juridique: '', categorie: '', commune: '', commercial: '', contact: '', telephone: '', email: '', groupe: '', sensibilite_prix: '', sensibilite_delais: '', sensibilite_qualite: '', sensibilite_process: '', rc: '', nif: '', nis: '', ai: '' }
const initial: Required<ClientValues> = props.client ? clientFormValues(props.client) : EMPTY
const values = reactive<Required<ClientValues>>({ ...initial })
const options = ref<ClientOptions | null>(null)
const loadError = ref('')
const serverError = ref('')
const errors = ref<Partial<Record<ClientField, string>>>({})
const busy = ref(false)
const changes = computed(() => changedValues(initial, values))
const dirty = computed(() => Object.keys(changes.value).length > 0)
const SENSIBILITES: { field: ClientField; label: string }[] = [
	{ field: 'sensibilite_prix', label: 'Sensibilité prix' },
	{ field: 'sensibilite_delais', label: 'Sensibilité délais' },
	{ field: 'sensibilite_qualite', label: 'Sensibilité qualité' },
	{ field: 'sensibilite_process', label: 'Sensibilité process' },
]
const PIECES: { field: ClientField; label: string }[] = [
	{ field: 'rc', label: 'Nº RC' },
	{ field: 'nif', label: 'Nº NIF' },
	{ field: 'nis', label: 'Nº NIS' },
	{ field: 'ai', label: 'Nº AI' },
]
// Le commercial actuel peut ne plus figurer parmi les commerciaux actifs : il reste proposé.
const commercialOptions = computed(() => {
	const list = [...(options.value?.commercials ?? [])]
	const current = props.client
	if (current?.commercial_user && !list.some((item) => item.value === current.commercial_user)) list.unshift({ value: current.commercial_user, label: current.commercial || current.commercial_user })
	return list
})

onMounted(async () => {
	try {
		options.value = await getClientOptions()
		if (!editing.value && !values.categorie && options.value.categories.includes('Commercial')) {
			// Préremplie : ce n'est pas une saisie, la fermeture ne demande pas de confirmation.
			initial.categorie = 'Commercial'
			values.categorie = 'Commercial'
		}
	} catch (e) {
		loadError.value = (e as Error).message
	}
})

// Raison sociale : le serveur l'enregistre en majuscules et refuse un nom déjà pris. La fenêtre le dit dès la saisie.
const similar = ref<ClientChoice[]>([])
let lastName = 0
let nameTimer: ReturnType<typeof setTimeout> | null = null
watch(
	() => values.customer_name,
	(name) => {
		if (errors.value.customer_name) delete errors.value.customer_name
		if (nameTimer) clearTimeout(nameTimer)
		const query = normalizeName(name)
		if (query.length < 3) {
			similar.value = []
			return
		}
		nameTimer = setTimeout(async () => {
			const request = ++lastName
			try {
				const found = await searchClients(name)
				if (request === lastName) similar.value = found.filter((item) => item.name !== props.client?.name && normalizeName(item.label).includes(query)).slice(0, 3)
			} catch {
				// Le serveur refusera de toute façon un nom déjà pris.
			}
		}, 250)
	},
)
const savedName = computed(() => values.customer_name.trim().toUpperCase())

// Commune : la wilaya en découle sur le serveur. Une seule réponse compte, celle de la dernière frappe.
const communeLabel = ref(props.client?.commune_label ?? '')
const communeWilaya = ref(props.client?.wilaya ?? '')
const communeQuery = ref('')
const communes = ref<CommuneChoice[]>([])
const communesOpen = ref(false)
const communesSearched = ref(false)
const communeCursor = ref(0)
const communeInput = ref<HTMLInputElement | null>(null)
let lastCommune = 0
let communeTimer: ReturnType<typeof setTimeout> | null = null
async function runCommuneSearch() {
	const request = ++lastCommune
	try {
		const found = await searchCommunes(communeQuery.value)
		if (request !== lastCommune) return
		communes.value = found
		communesSearched.value = true
		communeCursor.value = 0
	} catch (e) {
		if (request === lastCommune) serverError.value = (e as Error).message
	}
}
watch(communeQuery, () => {
	if (values.commune) return
	communesOpen.value = true
	if (communeTimer) clearTimeout(communeTimer)
	communeTimer = setTimeout(runCommuneSearch, 200)
})
function openCommunes() {
	communesOpen.value = true
	if (!communesSearched.value) runCommuneSearch()
}
function pickCommune(choice?: CommuneChoice) {
	if (!choice) return
	values.commune = choice.name
	communeLabel.value = choice.commune || choice.name
	communeWilaya.value = choice.wilaya || ''
	communesOpen.value = false
	delete errors.value.commune
}
async function changeCommune() {
	values.commune = ''
	communeLabel.value = ''
	communeWilaya.value = ''
	communeQuery.value = ''
	await nextTick()
	communeInput.value?.focus()
}
function onCommuneKey(event: KeyboardEvent) {
	if (event.key === 'Escape' && communesOpen.value) {
		event.stopPropagation()
		communesOpen.value = false
		return
	}
	const size = communes.value.length
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		communesOpen.value = true
		if (size) communeCursor.value = (communeCursor.value + (event.key === 'ArrowDown' ? 1 : size - 1)) % size
	} else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && communesOpen.value) {
		event.preventDefault()
		pickCommune(communes.value[communeCursor.value])
	}
}
function onCommuneBlur(event: FocusEvent) {
	if (!(event.relatedTarget as HTMLElement | null)?.closest?.('.picker-menu')) communesOpen.value = false
}

async function submit() {
	if (busy.value) return
	errors.value = validateClient(values)
	serverError.value = ''
	if (Object.keys(errors.value).length) {
		await nextTick()
		document.querySelector<HTMLElement>('.dialog [aria-invalid="true"]')?.focus()
		return
	}
	if (props.client && !Object.keys(changes.value).length) {
		emit('close')
		return
	}
	busy.value = true
	try {
		if (props.client) {
			emit('saved', await updateClient(props.client, changes.value))
		} else {
			const { name } = await createProspect(values)
			emit('created', name)
		}
		emit('close')
	} catch (e) {
		// La saisie reste en place : rien n'est perdu si le serveur refuse.
		serverError.value = (e as Error).message
	} finally {
		busy.value = false
	}
}
onBeforeUnmount(() => {
	if (nameTimer) clearTimeout(nameTimer)
	if (communeTimer) clearTimeout(communeTimer)
})
</script>

<template>
	<FormDialog :title="editing ? 'Modifier le client' : 'Nouveau prospect'" :dirty="dirty" :busy="busy" :hint="editing ? 'Ctrl + Entrée pour enregistrer' : 'Ctrl + Entrée pour créer'" @close="emit('close')" @submit="submit">
		<p v-if="loadError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ loadError }}</p>

		<div class="form-field">
			<label class="field-label" for="client-raison">Raison sociale <span class="req">obligatoire</span></label>
			<input id="client-raison" v-model="values.customer_name" class="field-input" placeholder="Nom de la société" autocomplete="off" :aria-invalid="Boolean(errors.customer_name)" />
			<p v-if="errors.customer_name" class="field-error" role="alert">{{ errors.customer_name }}</p>
			<p v-else-if="savedName" class="field-note"><LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" /><span>Enregistrée ainsi : {{ savedName }}</span></p>
			<p v-if="similar.length" class="field-note">
				<LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" />
				<span>
					Déjà enregistré :
					<template v-for="(item, index) in similar" :key="item.name">{{ index ? ', ' : '' }}<a class="ref-link" :href="`/bureau/clients/${encodeURIComponent(item.name)}`" target="_blank" rel="noopener noreferrer">{{ item.label }}</a><template v-if="item.wilaya"> ({{ item.wilaya }})</template></template>.
				</span>
			</p>
		</div>

		<div class="form-grid">
			<div class="form-field">
				<label class="field-label" for="client-forme">Forme juridique <span class="req">obligatoire</span></label>
				<select id="client-forme" v-model="values.forme_juridique" class="field-input" :aria-invalid="Boolean(errors.forme_juridique)" @change="delete errors.forme_juridique">
					<option value="">Choisir…</option>
					<option v-for="item in options?.formes" :key="item" :value="item">{{ item }}</option>
				</select>
				<p v-if="errors.forme_juridique" class="field-error" role="alert">{{ errors.forme_juridique }}</p>
			</div>
			<div class="form-field">
				<label class="field-label" for="client-categorie">Catégorie <span class="req">obligatoire</span></label>
				<select id="client-categorie" v-model="values.categorie" class="field-input" :aria-invalid="Boolean(errors.categorie)" @change="delete errors.categorie">
					<option value="">Choisir…</option>
					<option v-if="values.categorie && !options?.categories.includes(values.categorie)" :value="values.categorie">{{ values.categorie }}</option>
					<option v-for="item in options?.categories" :key="item" :value="item">{{ item }}</option>
				</select>
				<p v-if="errors.categorie" class="field-error" role="alert">{{ errors.categorie }}</p>
			</div>
			<div class="form-field">
				<label class="field-label" for="client-commune">Commune <span class="req">obligatoire</span></label>
				<div v-if="values.commune" class="picked">
					<div class="flex min-w-0 flex-auto flex-wrap items-baseline gap-x-2">
						<strong class="font-semibold text-ink-gray-9">{{ communeLabel }}</strong>
						<span v-if="communeWilaya" class="text-sm text-ink-gray-6">Wilaya : {{ communeWilaya }}</span>
					</div>
					<button id="client-commune" type="button" class="comment-tool" aria-label="Changer de commune" title="Changer de commune" @click="changeCommune"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
				</div>
				<div v-else class="relative">
					<LucideSearch class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-5" aria-hidden="true" />
					<input
						id="client-commune"
						ref="communeInput"
						v-model="communeQuery"
						class="field-input pl-8"
						type="search"
						placeholder="Commune ou wilaya"
						autocomplete="off"
						role="combobox"
						aria-autocomplete="list"
						:aria-expanded="communesOpen"
						:aria-invalid="Boolean(errors.commune)"
						@focus="openCommunes"
						@click="openCommunes"
						@keydown="onCommuneKey"
						@blur="onCommuneBlur"
					/>
					<div v-if="communesOpen" class="app-menu picker-menu" role="listbox" aria-label="Communes">
						<button v-for="(choice, index) in communes" :key="choice.name" type="button" class="app-menu-item" role="option" :aria-selected="index === communeCursor" @mousedown.prevent @click="pickCommune(choice)" @pointerenter="communeCursor = index">
							<span class="min-w-0 flex-auto truncate">{{ choice.commune || choice.name }}</span>
							<span class="text-xs text-ink-gray-6">{{ choice.wilaya }}</span>
						</button>
						<p v-if="communesSearched && !communes.length" class="app-menu-title">Aucune commune ne correspond.</p>
						<p v-else-if="!communesSearched" class="app-menu-title">Recherche…</p>
					</div>
				</div>
				<p v-if="errors.commune" class="field-error" role="alert">{{ errors.commune }}</p>
			</div>
			<div class="form-field">
				<label class="field-label" for="client-commercial">Commercial <span class="req">obligatoire</span></label>
				<select id="client-commercial" v-model="values.commercial" class="field-input" :aria-invalid="Boolean(errors.commercial)" @change="delete errors.commercial">
					<option value="">Choisir…</option>
					<option v-for="item in commercialOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
				</select>
				<p v-if="errors.commercial" class="field-error" role="alert">{{ errors.commercial }}</p>
			</div>
		</div>

		<h3 class="form-section">Contact principal</h3>
		<div class="form-field">
			<label class="field-label" for="client-contact">Nom du contact</label>
			<input id="client-contact" v-model="values.contact" class="field-input" autocomplete="off" />
		</div>
		<div class="form-grid">
			<div class="form-field">
				<label class="field-label" for="client-telephone">Téléphone</label>
				<input id="client-telephone" v-model="values.telephone" class="field-input tabular-nums" type="tel" autocomplete="off" />
			</div>
			<div class="form-field">
				<label class="field-label" for="client-email">Email</label>
				<input id="client-email" v-model="values.email" class="field-input" type="email" autocomplete="off" />
			</div>
		</div>

		<template v-if="editing">
			<h3 class="form-section">Classification</h3>
			<div class="form-grid">
				<div class="form-field">
					<label class="field-label" for="client-statut">Statut du client <span class="req">obligatoire</span></label>
					<select id="client-statut" v-model="values.status" class="field-input">
						<option v-for="item in options?.statuses ?? [values.status]" :key="item" :value="item">{{ item }}</option>
					</select>
				</div>
				<div class="form-field">
					<label class="field-label" for="client-groupe">Groupe de sociétés</label>
					<select id="client-groupe" v-model="values.groupe" class="field-input">
						<option value="">Aucun</option>
						<option v-if="values.groupe && !options?.groupes.includes(values.groupe)" :value="values.groupe">{{ values.groupe }}</option>
						<option v-for="item in options?.groupes" :key="item" :value="item">{{ item }}</option>
					</select>
				</div>
				<div v-for="item in SENSIBILITES" :key="item.field" class="form-field">
					<label class="field-label" :for="`client-${item.field}`">{{ item.label }}</label>
					<select :id="`client-${item.field}`" v-model="values[item.field]" class="field-input">
						<option value="">Non renseignée</option>
						<option v-for="choice in options?.sensibilites" :key="choice" :value="choice">{{ choice }}</option>
					</select>
				</div>
			</div>
			<h3 class="form-section">Pièces administratives</h3>
			<div class="form-grid">
				<div v-for="item in PIECES" :key="item.field" class="form-field">
					<label class="field-label" :for="`client-${item.field}`">{{ item.label }}</label>
					<input :id="`client-${item.field}`" v-model="values[item.field]" class="field-input tabular-nums" autocomplete="off" />
				</div>
			</div>
		</template>

		<p v-if="serverError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ serverError }}</p>

		<template #actions>
			<button type="button" class="btn-primary" :disabled="busy" @click="submit">{{ busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le prospect' }}</button>
		</template>
	</FormDialog>
</template>
