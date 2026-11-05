<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import LucideInfo from '~icons/lucide/info'
import LucideSearch from '~icons/lucide/search'
import LucideX from '~icons/lucide/x'
import FileUploader from '@shared/components/FileUploader.vue'
import FormDialog from '@shared/components/FormDialog.vue'
import { createTicket, getTicketFormOptions, searchClients } from '@/lib/api'
import { typeGuide, validateNewTicket, type NewTicketErrors } from '@/lib/newTicket'
import type { ClientChoice, TicketFormOptions } from '@/types'

/** `initialClient` : la fenêtre s'ouvre depuis la fiche d'un client, déjà renseignée. */
const props = defineProps<{ initialClient?: ClientChoice }>()
const emit = defineEmits<{ close: []; created: [result: { name: string; failedFiles: number }] }>()

const options = ref<TicketFormOptions | null>(null)
const loadError = ref('')
const client = ref<ClientChoice | null>(props.initialClient ?? null)
const type = ref('')
const site = ref('')
const commercial = ref(props.initialClient?.commercial ?? '')
const channel = ref('')
const echeance = ref('')
const description = ref('')
const uploader = ref<InstanceType<typeof FileUploader> | null>(null)
const errors = ref<NewTicketErrors>({})
const serverError = ref('')
const busy = ref(false)
const clientInput = ref<HTMLInputElement | null>(null)
const descriptionInput = ref<HTMLTextAreaElement | null>(null)
const siteInput = ref<HTMLSelectElement | null>(null)

const urgence = computed(() => options.value?.types.find((item) => item.value === type.value)?.urgence)
const guide = computed(() => typeGuide(type.value))
const dirty = computed(() => Boolean((client.value && client.value.name !== props.initialClient?.name) || query.value || type.value || site.value || channel.value || echeance.value || description.value.trim() || uploader.value?.items.length))
// Le commercial du client peut ne pas figurer parmi les commerciaux actifs : il reste proposé.
const commercialOptions = computed(() => {
	const list = [...(options.value?.commercials ?? [])]
	const current = client.value
	if (current?.commercial && !list.some((item) => item.value === current.commercial)) list.unshift({ value: current.commercial, label: current.commercial_name || current.commercial })
	return list
})

onMounted(async () => {
	try {
		options.value = await getTicketFormOptions()
		if (options.value.sites.length === 1) site.value = options.value.sites[0].value
	} catch (e) {
		loadError.value = (e as Error).message
	}
})

// Recherche du client : une seule réponse compte, celle de la dernière frappe.
const query = ref('')
const results = ref<ClientChoice[]>([])
const resultsOpen = ref(false)
const searched = ref(false)
const cursor = ref(0)
let lastSearch = 0
let timer: ReturnType<typeof setTimeout> | null = null
async function runSearch() {
	const request = ++lastSearch
	try {
		const response = await searchClients(query.value)
		if (request !== lastSearch) return
		results.value = response
		searched.value = true
		cursor.value = 0
	} catch (e) {
		if (request === lastSearch) serverError.value = (e as Error).message
	}
}
watch(query, () => {
	if (client.value) return
	resultsOpen.value = true
	if (timer) clearTimeout(timer)
	timer = setTimeout(runSearch, 200)
})
function openResults() {
	resultsOpen.value = true
	if (!searched.value) runSearch()
}
function pick(choice?: ClientChoice) {
	if (!choice) return
	client.value = choice
	resultsOpen.value = false
	commercial.value = choice.commercial || ''
	delete errors.value.client
}
async function changeClient() {
	client.value = null
	query.value = ''
	commercial.value = ''
	await nextTick()
	clientInput.value?.focus()
}
function onClientKey(event: KeyboardEvent) {
	if (event.key === 'Escape' && resultsOpen.value) {
		event.stopPropagation()
		resultsOpen.value = false
		return
	}
	const size = results.value.length
	if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
		event.preventDefault()
		resultsOpen.value = true
		if (size) cursor.value = (cursor.value + (event.key === 'ArrowDown' ? 1 : size - 1)) % size
	} else if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && resultsOpen.value) {
		event.preventDefault()
		pick(results.value[cursor.value])
	}
}
function onClientBlur(event: FocusEvent) {
	if (!(event.relatedTarget as HTMLElement | null)?.closest?.('.picker-menu')) resultsOpen.value = false
}

async function focusFirstError() {
	await nextTick()
	if (errors.value.client) clientInput.value?.focus()
	else if (errors.value.site) siteInput.value?.focus()
	else if (errors.value.description) descriptionInput.value?.focus()
}

async function submit(again = false) {
	if (busy.value) return
	errors.value = validateNewTicket({ client: client.value?.name ?? null, type: type.value, site: site.value, description: description.value })
	serverError.value = ''
	if (Object.keys(errors.value).length) {
		focusFirstError()
		return
	}
	busy.value = true
	let name: string
	try {
		name = (
			await createTicket({
				customer: client.value!.name,
				request_type: type.value,
				site: site.value,
				description: description.value.trim(),
				commercial: commercial.value || undefined,
				channel: channel.value || undefined,
				echeance: echeance.value || undefined,
			})
		).name
	} catch (e) {
		// La saisie reste en place : rien n'est perdu si le serveur refuse.
		serverError.value = (e as Error).message
		busy.value = false
		return
	}
	// Le ticket existe : un fichier refusé ne doit pas le faire oublier.
	const failedFiles = uploader.value?.items.length ? await uploader.value.start({ doctype: 'Ticket Commercial', docname: name }) : 0
	busy.value = false
	emit('created', { name, failedFiles })
	if (!again) {
		emit('close')
		return
	}
	// La suivante garde le client, le site, le commercial et le canal : un même appel donne souvent plusieurs demandes.
	type.value = ''
	echeance.value = ''
	description.value = ''
	uploader.value?.clear()
	await nextTick()
	descriptionInput.value?.focus()
}
onBeforeUnmount(() => {
	if (timer) clearTimeout(timer)
})
</script>

<template>
	<FormDialog title="Nouveau ticket" :dirty="dirty" :busy="busy" @close="emit('close')" @submit="submit()">
		<p v-if="loadError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ loadError }}</p>

		<div class="form-field">
			<label class="field-label" for="nouveau-client">Client <span class="req">obligatoire</span></label>
			<template v-if="client">
				<div class="picked">
					<div class="flex min-w-0 flex-auto flex-wrap items-baseline gap-x-2">
						<strong class="font-semibold text-ink-gray-9">{{ client.label }}</strong>
						<span class="text-sm text-ink-gray-6">{{ client.name }}<template v-if="client.wilaya"> · {{ client.wilaya }}</template></span>
					</div>
					<button id="nouveau-client" type="button" class="comment-tool" aria-label="Changer de client" title="Changer de client" @click="changeClient"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
				</div>
				<p v-if="client.open_tickets" class="field-note">
					<LucideInfo class="mt-px h-3.5 w-3.5 flex-none" aria-hidden="true" />
					<span>Ce client a déjà {{ client.open_tickets }} ticket{{ client.open_tickets > 1 ? 's' : '' }} ouvert{{ client.open_tickets > 1 ? 's' : '' }}. Vérifiez qu'il ne s'agit pas de la même demande.</span>
				</p>
			</template>
			<template v-else>
				<div class="relative">
					<LucideSearch class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-gray-5" aria-hidden="true" />
					<input
						id="nouveau-client"
						ref="clientInput"
						v-model="query"
						class="field-input pl-8"
						type="search"
						placeholder="Nom, code ou wilaya"
						autocomplete="off"
						role="combobox"
						aria-autocomplete="list"
						:aria-expanded="resultsOpen"
						:aria-invalid="Boolean(errors.client)"
						@focus="openResults"
						@click="openResults"
						@keydown="onClientKey"
						@blur="onClientBlur"
					/>
					<div v-if="resultsOpen" class="app-menu picker-menu" role="listbox" aria-label="Clients">
						<button
							v-for="(choice, index) in results"
							:key="choice.name"
							type="button"
							class="app-menu-item"
							role="option"
							:aria-selected="index === cursor"
							@mousedown.prevent
							@click="pick(choice)"
							@pointerenter="cursor = index"
						>
							<span class="min-w-0 flex-auto truncate">{{ choice.label }}</span>
							<span class="text-xs text-ink-gray-6">{{ choice.wilaya ? `${choice.wilaya} · ` : '' }}{{ choice.name }}</span>
						</button>
						<p v-if="searched && !results.length" class="app-menu-title">Aucun client ne correspond.</p>
						<p v-else-if="!searched" class="app-menu-title">Recherche…</p>
					</div>
				</div>
			</template>
			<p v-if="errors.client" class="field-error" role="alert">{{ errors.client }}</p>
		</div>

		<fieldset class="form-field">
			<legend class="field-label">Type de demande <span class="req">obligatoire</span></legend>
			<div class="type-grid" role="radiogroup" aria-label="Type de demande">
				<button v-for="item in options?.types" :key="item.value" type="button" class="type-tile" role="radio" :aria-checked="type === item.value" @click="type = item.value; delete errors.type">{{ item.value }}</button>
			</div>
			<p v-if="urgence" class="field-note">
				<span class="urgence" :class="`urgence-${urgence}`">{{ urgence }}</span>
				<span>{{ guide.hint ? `Urgence à la création, fixée par le type. ${guide.hint}` : 'Urgence à la création, fixée par le type.' }}</span>
			</p>
			<p v-if="errors.type" class="field-error" role="alert">{{ errors.type }}</p>
		</fieldset>

		<div class="form-grid">
			<div class="form-field">
				<label class="field-label" for="nouveau-site">Site de production <span class="req">obligatoire</span></label>
				<select id="nouveau-site" ref="siteInput" v-model="site" class="field-input" :aria-invalid="Boolean(errors.site)" @change="delete errors.site">
					<option value="">Choisir…</option>
					<option v-for="item in options?.sites" :key="item.value" :value="item.value">{{ item.label }}</option>
				</select>
				<p v-if="errors.site" class="field-error" role="alert">{{ errors.site }}</p>
			</div>
			<div class="form-field">
				<label class="field-label" for="nouveau-commercial">Commercial</label>
				<select id="nouveau-commercial" v-model="commercial" class="field-input">
					<option value="">{{ client ? 'Aucun' : 'Repris du client' }}</option>
					<option v-for="item in commercialOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
				</select>
			</div>
			<div class="form-field">
				<label class="field-label" for="nouveau-canal">Canal</label>
				<select id="nouveau-canal" v-model="channel" class="field-input">
					<option value="">Non précisé</option>
					<option v-for="item in options?.channels" :key="item" :value="item">{{ item }}</option>
				</select>
			</div>
			<div class="form-field">
				<label class="field-label" for="nouveau-echeance">Échéance</label>
				<input id="nouveau-echeance" v-model="echeance" class="field-input" type="date" />
			</div>
		</div>

		<div class="form-field">
			<label class="field-label" for="nouveau-description">Description <span class="req">obligatoire</span></label>
			<textarea id="nouveau-description" ref="descriptionInput" v-model="description" class="field-input comment-input" rows="4" :placeholder="guide.placeholder" :aria-invalid="Boolean(errors.description)" @input="delete errors.description"></textarea>
			<p v-if="errors.description" class="field-error" role="alert">{{ errors.description }}</p>
		</div>

		<div class="form-field">
			<span class="field-label">Pièces jointes</span>
			<FileUploader ref="uploader" deferred />
		</div>

		<p v-if="serverError" role="alert" class="rounded-control tone-red px-3 py-2 text-sm">{{ serverError }}</p>

		<template #actions>
			<button type="button" class="btn-secondary" :disabled="busy" @click="submit(true)">Créer et en saisir un autre</button>
			<button type="button" class="btn-primary" :disabled="busy" @click="submit()">{{ busy ? 'Création…' : 'Créer le ticket' }}</button>
		</template>
	</FormDialog>
</template>
