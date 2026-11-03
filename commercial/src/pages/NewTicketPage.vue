<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import ClientPicker from '@/components/ClientPicker.vue'
import NotesField from '@/components/NotesField.vue'
import AttachmentsPicker from '@/components/AttachmentsPicker.vue'
import { useCommercialStore } from '@/stores/commercial'
import { localKey, refTo } from '@/lib/mutations'
import { htmlToText } from '@/lib/text'
import type { Attachment } from '@/types'

/**
 * Nouveau ticket commercial (`/tickets/nouveau?client=&article=&type=&visite=`).
 * Sert aussi aux réclamations (type « Réclamation », depuis une visite) et aux retirages (depuis un article).
 * `dictee=1` ouvre la dictée de la description, `photo=1` l'appareil photo (menu de création).
 */
const store = useCommercialStore()
const route = useRoute()
const router = useRouter()

const article = computed(() => (route.query.article ? store.articlesByName.get(String(route.query.article)) ?? null : null))
const visite = computed(() => (route.query.visite ? String(route.query.visite) : null))
const client = ref<string | null>((route.query.client as string) || article.value?.client || null)
const type = ref<string>((route.query.type as string) || '')
const priority = ref('Moyenne')
const channel = ref('')
const site = ref('')
const echeance = ref('')
const description = ref('')
const attachments = ref<Attachment[]>([])
const error = ref<string | null>(null)

const types = computed(() => store.references?.types_ticket ?? [])
const priorites = computed(() => store.references?.priorites_ticket?.length ? store.references.priorites_ticket : ['Basse', 'Moyenne', 'Haute'])
const canaux = computed(() => store.references?.canaux_ticket ?? [])
const sites = computed(() => store.references?.sites ?? [])

// Site proposé : celui du procédé de l'article (Offset, Flexo…), s'il n'y en a qu'un.
watch(
	[article, sites],
	() => {
		if (site.value || !article.value?.procede) return
		const matches = sites.value.filter((s) => s.procede && article.value?.procede?.startsWith(s.procede))
		if (matches.length === 1) site.value = matches[0].name
	},
	{ immediate: true },
)
if (sites.value.length === 1) site.value = sites.value[0].name

// Texte de départ : l'article concerné (retirage, devis, réclamation sur un article).
if (article.value) {
	const a = article.value
	const ref_ = [a.name, a.code_client ? `réf. client ${a.code_client}` : null].filter(Boolean).join(', ')
	description.value = `Article : ${a.designation} (${ref_})\n`
}

// Depuis une visite : la description part du compte rendu (modifiable).
const visiteRow = computed(() => (visite.value ? store.visitesByName.get(store.resolveKey(visite.value)) ?? null : null))
if (!description.value && visiteRow.value?.notes) description.value = htmlToText(visiteRow.value.notes).trim()

const autoDictate = route.query.dictee === '1'
const picker = ref<InstanceType<typeof AttachmentsPicker> | null>(null)
onMounted(() => {
	if (route.query.photo === '1') picker.value?.openCamera()
})

const title = computed(() => (type.value === 'Réclamation' ? 'Nouvelle réclamation' : 'Nouveau ticket'))

function toHtml(text: string) {
	return text
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${paragraph.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`)
		.join('')
}

function save() {
	if (!client.value) error.value = 'Choisissez le client.'
	else if (!type.value) error.value = 'Choisissez le type de demande.'
	else if (!site.value) error.value = 'Choisissez le site de production.'
	else if (!description.value.trim()) error.value = 'Décrivez la demande.'
	else error.value = null
	if (error.value) return
	const id = store.enqueue('ticket_create', {
		...refTo('client', client.value),
		...(visite.value ? refTo('visite', store.resolveKey(visite.value)) : {}),
		request_type: type.value,
		priority: priority.value,
		channel: channel.value || null,
		site: site.value,
		echeance: echeance.value || null,
		description: toHtml(description.value.trim()),
		attachments: attachments.value,
	})
	router.replace({ name: 'Ticket', params: { id: localKey(id) } })
}
</script>

<template>
	<div class="pb-28">
		<PageHeader :title="title" :subtitle="visite ? `Depuis la visite ${visiteRow?.nom_client ? `· ${visiteRow.nom_client}` : visite.startsWith('local:') ? 'en cours' : visite}` : null" :back="{ name: 'Suivi' }" />
		<div class="space-y-5">
			<div>
				<h2 class="mb-2 text-[15px] font-semibold">Client</h2>
				<ClientPicker v-model="client" />
			</div>

			<section>
				<h2 class="mb-2 text-[15px] font-semibold">Type de demande</h2>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Type de demande">
					<button v-for="t in types" :key="t" type="button" role="radio" :aria-checked="type === t" :class="type === t ? 'chip-on' : 'chip-off'" @click="type = t">{{ t }}</button>
				</div>
			</section>

			<NotesField
				v-model="description"
				label="Description"
				:hint="visiteRow?.notes ? 'Reprise de la visite' : null"
				:subtitle="title"
				:auto-dictate="autoDictate"
				:placeholder="type === 'Réclamation' ? 'Défaut constaté, lot, quantités concernées…' : 'Besoin du client, quantités, délais…'"
			/>

			<div>
				<AttachmentsPicker ref="picker" v-model="attachments" />
				<p v-if="type === 'Réclamation'" class="mt-2 text-xs text-ink-gray-6">Joignez une photo du défaut : l'Administration des ventes en a besoin pour traiter la réclamation.</p>
			</div>

			<section>
				<h2 id="priorite" class="mb-2 text-[15px] font-semibold">Priorité</h2>
				<div class="segmented" role="radiogroup" aria-labelledby="priorite">
					<button v-for="p in priorites" :key="p" type="button" role="radio" :aria-checked="priority === p" @click="priority = p">{{ p }}</button>
				</div>
			</section>

			<div class="card divide-y divide-outline-gray-1">
				<label class="list-row">
					<span class="font-medium">Site de production</span>
					<select v-model="site" class="min-w-0 border-0 bg-transparent py-0 pr-7 text-right text-base text-ink-gray-7 focus:ring-0">
						<option value="" disabled>Choisir…</option>
						<option v-for="s in sites" :key="s.name" :value="s.name">{{ s.title || s.name }}</option>
					</select>
				</label>
				<label class="list-row">
					<span class="font-medium">Échéance</span>
					<input v-model="echeance" type="date" class="border-0 bg-transparent p-0 text-right text-base text-ink-gray-7 focus:ring-0" />
				</label>
				<label class="list-row">
					<span class="font-medium">Canal</span>
					<select v-model="channel" class="min-w-0 border-0 bg-transparent py-0 pr-7 text-right text-base text-ink-gray-7 focus:ring-0">
						<option value="">—</option>
						<option v-for="c in canaux" :key="c" :value="c">{{ c }}</option>
					</select>
				</label>
			</div>
		</div>

		<div class="action-bar flex-col">
			<p v-if="error" class="text-sm text-ink-red-3" role="alert">{{ error }}</p>
			<button type="button" class="btn-primary w-full" @click="save">{{ type === 'Réclamation' ? 'Créer la réclamation' : 'Créer le ticket' }}</button>
		</div>
	</div>
</template>
