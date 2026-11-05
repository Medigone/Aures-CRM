<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import LucideX from '~icons/lucide/x'
import FormDialog from '@shared/components/FormDialog.vue'
import { getBulkTags } from '@/lib/api'

/** Tags à ajouter aux lignes cochées. Les tags déjà posés restent : comme sur le Desk, on n'en retire pas ici. */
const props = defineProps<{ countLabel: string }>()
const emit = defineEmits<{ close: []; submit: [tags: string[]] }>()

const tags = ref<string[]>([])
const text = ref('')
const suggestions = ref<string[]>([])
let timer: ReturnType<typeof setTimeout> | null = null

// Une virgule sépare les tags dans la colonne `_user_tags` : elle ne peut pas en faire partie.
const pending = computed(() => text.value.split(',').map((tag) => tag.trim()).filter(Boolean))
const all = computed(() => [...new Set([...tags.value, ...pending.value])])

function add() {
	tags.value = all.value
	text.value = ''
}
function remove(tag: string) {
	tags.value = tags.value.filter((item) => item !== tag)
}
function submit() {
	if (all.value.length) emit('submit', all.value)
}
watch(
	text,
	() => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(async () => {
			try {
				suggestions.value = (await getBulkTags(text.value)) ?? []
			} catch {
				suggestions.value = []
			}
		}, 200)
	},
	{ immediate: true },
)
onBeforeUnmount(() => {
	if (timer) clearTimeout(timer)
})
</script>

<template>
	<FormDialog title="Ajouter des tags" :dirty="all.length > 0" hint="Ctrl + Entrée pour appliquer" @close="emit('close')" @submit="submit">
		<div class="form-field">
			<label class="field-label" for="bulk-tags">Tags</label>
			<input id="bulk-tags" v-model="text" class="field-input" type="text" list="bulk-tags-list" autocomplete="off" placeholder="Entrée pour ajouter" @keydown.enter.exact.prevent="add" />
			<datalist id="bulk-tags-list">
				<option v-for="tag in suggestions" :key="tag" :value="tag"></option>
			</datalist>
		</div>
		<div v-if="tags.length" class="mt-2.5 flex flex-wrap gap-1.5">
			<button v-for="tag in tags" :key="tag" type="button" class="filter-chip" :aria-label="`Retirer le tag ${tag}`" @click="remove(tag)">
				{{ tag }}
				<LucideX class="h-3 w-3" aria-hidden="true" />
			</button>
		</div>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="!all.length" @click="submit">Ajouter à {{ countLabel }}</button>
		</template>
	</FormDialog>
</template>
