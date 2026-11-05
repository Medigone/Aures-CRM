<script setup lang="ts" generic="Row extends { name: string; modified: string }">
import { computed, ref, watch } from 'vue'
import LucideX from '~icons/lucide/x'
import BulkDeleteDialog from './BulkDeleteDialog.vue'
import BulkEditDialog from './BulkEditDialog.vue'
import BulkTagsDialog from './BulkTagsDialog.vue'
import { bulkAddTags, bulkDelete, bulkUpdate, getBulkOptions } from '@/lib/api'
import type { BulkState } from '@/lib/useBulk'
import type { BulkField, BulkOptions } from '@/types'

/** Barre des actions groupées, commune à toutes les listes : l'équivalent du menu Actions du Desk. */
const props = defineProps<{ doctype: string; noun: string; picked: Row[]; bulk: BulkState }>()
const emit = defineEmits<{ clear: []; export: []; deleted: [names: string[]] }>()

const countLabel = computed(() => `${props.picked.length} ${props.noun}${props.picked.length > 1 ? 's' : ''}`)
const pickedLabel = computed(() => `${countLabel.value} sélectionné${props.picked.length > 1 ? 's' : ''}`)

// Ce qui est proposé dépend des droits : demandé à la première ligne cochée, puis gardé.
const options = ref<BulkOptions | null>(null)
const optionsError = ref('')
let requested = false
async function loadOptions() {
	requested = true
	try {
		options.value = await getBulkOptions(props.doctype)
		optionsError.value = ''
	} catch (e) {
		requested = false
		optionsError.value = (e as Error).message
	}
}
watch(
	() => props.picked.length > 0,
	(any) => {
		if (any && !requested) loadOptions()
	},
	{ immediate: true },
)

const dialog = ref<'edit' | 'tags' | 'delete' | null>(null)
function close() {
	dialog.value = null
}
function applyEdit(field: BulkField, value: string) {
	close()
	props.bulk.run(props.picked, (batch) => bulkUpdate(props.doctype, batch, field.fieldname, value), `${props.noun} modifié`, `${props.noun}s modifiés`)
}
function applyTags(tags: string[]) {
	close()
	props.bulk.run(props.picked, (batch) => bulkAddTags(props.doctype, batch, tags), `${props.noun} étiqueté`, `${props.noun}s étiquetés`)
}
async function applyDelete() {
	close()
	const outcome = await props.bulk.run(props.picked, (batch) => bulkDelete(props.doctype, batch), `${props.noun} supprimé`, `${props.noun}s supprimés`)
	if (outcome?.done.length) emit('deleted', outcome.done)
}
</script>

<template>
	<div v-if="picked.length" class="bureau-bulk" role="group" :aria-label="`Actions sur les ${noun}s sélectionnés`">
		<strong class="whitespace-nowrap font-semibold">{{ pickedLabel }}</strong>
		<span class="bureau-bulk-sep" aria-hidden="true"></span>
		<template v-if="$slots.default">
			<slot></slot>
			<span class="bureau-bulk-sep" aria-hidden="true"></span>
		</template>
		<button type="button" class="btn-secondary" :disabled="bulk.busy.value || !options?.fields.length" @click="dialog = 'edit'">Modifier</button>
		<button type="button" class="btn-secondary" :disabled="bulk.busy.value" @click="dialog = 'tags'">Tags</button>
		<button type="button" class="btn-secondary" :disabled="bulk.busy.value" @click="emit('export')">Exporter</button>
		<button v-if="options?.can_delete" type="button" class="btn-danger" :disabled="bulk.busy.value" @click="dialog = 'delete'">Supprimer</button>
		<span v-if="bulk.progress.value" class="whitespace-nowrap text-sm tabular-nums text-ink-gray-7" role="status">Traitement : {{ bulk.progress.value.sent }} sur {{ bulk.progress.value.total }}</span>
		<button type="button" class="icon-btn" aria-label="Désélectionner tout" :disabled="bulk.busy.value" @click="emit('clear')"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
		<p v-if="bulk.error.value || optionsError" role="alert" class="w-full text-sm text-tone-red">{{ bulk.error.value || optionsError }}</p>
	</div>
	<div v-else-if="bulk.message.value" class="bureau-bulk" role="status">
		<div class="min-w-0 flex-1">
			<p class="font-semibold">{{ bulk.message.value }}</p>
			<p v-if="bulk.interrupted.value" class="m-0 mt-1 text-sm text-tone-red">Envoi interrompu : {{ bulk.interrupted.value }}</p>
			<ul v-if="bulk.skipped.value.length" class="m-0 mt-1 max-h-32 list-none overflow-y-auto p-0 text-sm text-ink-gray-7">
				<li v-for="item in bulk.skipped.value" :key="item.name">{{ item.name }} : {{ item.reason }}</li>
			</ul>
		</div>
		<button type="button" class="icon-btn" aria-label="Fermer ce message" @click="bulk.dismiss"><LucideX class="h-4 w-4" aria-hidden="true" /></button>
	</div>

	<BulkEditDialog v-if="dialog === 'edit' && options" :doctype="doctype" :fields="options.fields" :count-label="countLabel" @close="close" @submit="applyEdit" />
	<BulkTagsDialog v-if="dialog === 'tags'" :count-label="countLabel" @close="close" @submit="applyTags" />
	<BulkDeleteDialog v-if="dialog === 'delete'" :count-label="countLabel" :names="picked.map((row) => row.name)" @close="close" @confirm="applyDelete" />
</template>
