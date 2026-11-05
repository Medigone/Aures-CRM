<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import ClientPicker from '@/components/ClientPicker.vue'
import NotesField from '@/components/NotesField.vue'
import AttachmentsPicker from '@/components/AttachmentsPicker.vue'
import { useCommercialStore } from '@/stores/commercial'
import { normalizeCotations, normalizeSearch } from '@/lib/format'
import { localKey, refTo } from '@/lib/mutations'
import type { Attachment } from '@/types'

/**
 * Nouvel article client (`/articles/nouveau?client=`) : le code (CLIENT-NNN) est attribué par le serveur à l'envoi.
 * La première photo devient le visuel de l'article, les remarques dictées une note sur la fiche dans le Desk.
 */
const store = useCommercialStore()
const route = useRoute()
const router = useRouter()

const client = ref<string | null>((route.query.client as string) || null)
const form = reactive({
	designation: '',
	procede: '',
	code_client: '',
	cotations: '',
	dimensions: '',
	consommation_annuelle: null as number | null,
	notes: '',
})
const attachments = ref<Attachment[]>([])
const error = ref<string | null>(null)

const procedes = computed(() => (store.references?.procedes_article?.length ? store.references.procedes_article : ['Offset', 'Flexo', 'Salle Blanche Pharma', 'Numérique']))
const offset = computed(() => form.procede === 'Offset')
// Procédé le plus courant chez ce client, proposé par défaut.
watch(
	client,
	(name) => {
		if (form.procede || !name) return
		const counts = new Map<string, number>()
		for (const a of store.articlesByClient.get(name) ?? []) if (a.procede) counts.set(a.procede, (counts.get(a.procede) || 0) + 1)
		const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
		if (top) form.procede = top[0]
	},
	{ immediate: true },
)

/** Même désignation déjà présente chez ce client (le serveur refuserait le doublon). */
const duplicate = computed(() => {
	const name = normalizeSearch(form.designation.trim())
	if (!name || !client.value) return null
	return (store.articlesByClient.get(client.value) ?? []).find((a) => normalizeSearch(a.designation) === name) ?? null
})

function save() {
	if (!client.value) error.value = 'Choisissez le client.'
	else if (!form.designation.trim()) error.value = 'La désignation est obligatoire.'
	else if (!form.procede) error.value = 'Choisissez le procédé.'
	else if (duplicate.value) error.value = `Ce client a déjà l'article « ${duplicate.value.designation} ».`
	else if (offset.value && form.cotations.trim() && !normalizeCotations(form.cotations)) error.value = 'Cotations : 1, 2 ou 3 cotes, par exemple 80x35x118.'
	else error.value = null
	if (error.value) return
	const id = store.enqueue('article_create', {
		...refTo('client', client.value),
		designation: form.designation.trim(),
		procede: form.procede,
		code_client: form.code_client.trim() || null,
		...(offset.value ? { cotations: normalizeCotations(form.cotations) } : { dimensions: form.dimensions.trim() || null }),
		consommation_annuelle: form.consommation_annuelle,
		notes: form.notes.trim() || null,
		attachments: attachments.value,
	})
	router.replace({ name: 'Article', params: { id: localKey(id) } })
}
</script>

<template>
	<div class="pb-28">
		<PageHeader title="Nouvel article" subtitle="Code attribué automatiquement à l'envoi" :back="client ? { name: 'Client', params: { id: client } } : { name: 'Clients' }" />
		<div class="space-y-5">
			<div>
				<h2 class="mb-2 text-[15px] font-semibold">Client</h2>
				<ClientPicker v-model="client" />
			</div>

			<label class="block">
				<span class="mb-2 block text-[15px] font-semibold">Désignation</span>
				<input v-model="form.designation" type="text" class="field-input uppercase" placeholder="Ex. étiquette tomate 400 g" autocapitalize="characters" />
				<span v-if="duplicate" class="mt-1 block text-xs text-ink-amber-3">Déjà dans les articles de ce client.</span>
			</label>

			<section>
				<h2 class="mb-2 text-[15px] font-semibold">Procédé</h2>
				<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Procédé">
					<button v-for="p in procedes" :key="p" type="button" role="radio" :aria-checked="form.procede === p" :class="form.procede === p ? 'chip-on' : 'chip-off'" @click="form.procede = p">{{ p }}</button>
				</div>
			</section>

			<section v-if="form.procede">
				<h2 class="mb-2 text-[15px] font-semibold">{{ offset ? 'Cotations (mm)' : 'Dimensions' }}</h2>
				<label v-if="offset" class="block">
					<span class="field-label">Cotations Article</span>
					<input v-model="form.cotations" type="text" class="field-input" placeholder="Ex. 80x35x118" autocomplete="off" />
					<span class="mt-1 block text-xs text-ink-gray-6">1, 2 ou 3 cotes séparées par x.</span>
				</label>
				<label v-else class="block">
					<span class="field-label">Dimensions H x L</span>
					<input v-model="form.dimensions" type="text" class="field-input" placeholder="Ex. 120 x 80" />
				</label>
			</section>

			<div class="card divide-y divide-outline-gray-1">
				<label class="list-row">
					<span class="font-medium">Réf. article client</span>
					<input v-model="form.code_client" type="text" class="min-w-0 flex-1 border-0 bg-transparent p-0 text-right text-base text-ink-gray-7 focus:ring-0" placeholder="Facultatif" />
				</label>
				<label class="list-row">
					<span class="font-medium">Consommation annuelle</span>
					<input v-model.number="form.consommation_annuelle" type="number" inputmode="numeric" min="0" class="w-32 border-0 bg-transparent p-0 text-right text-base text-ink-gray-7 focus:ring-0" placeholder="Unités" />
				</label>
			</div>

			<NotesField v-model="form.notes" label="Remarques" subtitle="Nouvel article" placeholder="Support, finitions, impression, conditionnement…" />

			<div>
				<AttachmentsPicker v-model="attachments" />
				<p class="mt-2 text-xs text-ink-gray-6">La première photo devient le visuel de l'article ; joignez aussi la fiche technique ou le tracé si le client les a fournis.</p>
			</div>
		</div>

		<div class="action-bar flex-col">
			<p v-if="error" class="text-sm text-ink-red-3" role="alert">{{ error }}</p>
			<button type="button" class="btn-primary w-full" @click="save">Créer l'article</button>
		</div>
	</div>
</template>
