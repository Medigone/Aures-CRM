<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ExportColumnOption } from '@/lib/exports'
import { checkedFirst, searchLabels } from '@/lib/exports'

/** Choix des colonnes du fichier : on tape pour réduire la liste, qui montre dix lignes par ordre alphabétique. */
const props = defineProps<{ modelValue: string[]; options: ExportColumnOption[]; listColumns: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const query = ref('')
const selected = computed(() => new Set(props.modelValue))
// Les colonnes cochées passent en tête, mais pas sous le pointeur : la liste se réordonne quand on la quitte ou qu'on cherche.
const placed = ref(new Set(props.modelValue))
const list = ref<HTMLElement | null>(null)
function reorder() {
	const next = new Set(props.modelValue)
	const changed = next.size !== placed.value.size || [...next].some((key) => !placed.value.has(key))
	placed.value = next
	// Les colonnes cochées restent en vue, même si la liste était défilée.
	if (changed) list.value?.scrollTo?.({ top: 0 })
}
watch(query, reorder)
const found = computed(() => checkedFirst(searchLabels(props.options, query.value), placed.value))

function toggle(key: string) {
	emit('update:modelValue', selected.value.has(key) ? props.modelValue.filter((item) => item !== key) : [...props.modelValue, key])
}
function setAll(keys: string[]) {
	placed.value = new Set(keys)
	emit('update:modelValue', keys)
}
/** Échap vide d'abord la recherche ; une recherche déjà vide laisse la fenêtre se fermer. */
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && query.value) {
		event.stopPropagation()
		query.value = ''
	}
}
</script>

<template>
	<div class="flex flex-col gap-1">
		<div class="flex flex-wrap items-baseline justify-between gap-x-3">
			<span class="field-label mb-0">Colonnes à exporter ({{ modelValue.length }})</span>
			<span class="flex gap-3 text-sm">
				<button type="button" class="text-link" @click="setAll([...listColumns])">Colonnes de la liste</button>
				<button type="button" class="text-link" @click="setAll([])">Aucune</button>
			</span>
		</div>
		<input v-model="query" class="field-input" type="search" aria-label="Chercher une colonne" placeholder="Chercher une colonne" autocomplete="off" @keydown="onKeydown" />
		<div ref="list" class="filter-field-list mt-0" role="group" aria-label="Colonnes" @pointerleave="reorder" @focusout="reorder">
			<p v-if="!found.length" class="filter-field-empty">Aucune colonne ne porte ce nom.</p>
			<label v-for="option in found" :key="option.key" class="filter-field-option export-column" :class="selected.has(option.key) && 'export-column-on'">
				<input type="checkbox" :checked="selected.has(option.key)" @change="toggle(option.key)" />
				<span class="min-w-0 flex-1 truncate" :title="option.label">{{ option.label }}</span>
				<span v-if="option.hint" class="filter-field-hint truncate">{{ option.hint }}</span>
			</label>
		</div>
	</div>
</template>
