<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucideX from '~icons/lucide/x'
import { exportRubrics, searchLabels, LIST_RUBRIC, type ExportColumnOption } from '@/lib/exports'

/** Choix des colonnes du fichier : les rubriques à gauche, leurs champs au centre, et à droite le fichier tel qu'il sortira. */
const props = withDefaults(defineProps<{ modelValue: string[]; options: ExportColumnOption[]; listColumns: string[]; fileTitle?: string; lockedKey?: string; draggable?: boolean }>(), { fileTitle: 'Colonnes du fichier', lockedKey: undefined, draggable: false })
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const query = ref('')
const rubric = ref(LIST_RUBRIC)
const list = ref<HTMLElement | null>(null)
const searching = computed(() => Boolean(query.value.trim()))
const rubrics = computed(() => exportRubrics(props.options))
const own = computed(() => rubrics.value.filter((item) => item.own))
const others = computed(() => rubrics.value.filter((item) => !item.own))
const selected = computed(() => new Set(props.modelValue))
const shown = computed(() => searchLabels(searching.value ? props.options : (rubrics.value.find((item) => item.name === rubric.value)?.options ?? []), query.value))
const heading = computed(() => (searching.value ? `${shown.value.length} résultat${shown.value.length > 1 ? 's' : ''}` : rubric.value))
const allChecked = computed(() => shown.value.length > 0 && shown.value.every((option) => selected.value.has(option.key)))
const file = computed(() => props.modelValue.flatMap((key) => props.options.find((option) => option.key === key) ?? []))

const chosenIn = (options: ExportColumnOption[]) => options.filter((option) => selected.value.has(option.key)).length

function toggle(key: string) {
	emit('update:modelValue', selected.value.has(key) ? props.modelValue.filter((item) => item !== key) : [...props.modelValue, key])
}
function toggleAll() {
	const keys = shown.value.map((option) => option.key)
	emit('update:modelValue', allChecked.value ? props.modelValue.filter((key) => !keys.includes(key)) : [...props.modelValue, ...keys.filter((key) => !selected.value.has(key))])
}
function move(key: string, offset: number) {
	const next = [...file.value.map((option) => option.key)]
	const index = next.indexOf(key)
	;[next[index], next[index + offset]] = [next[index + offset], next[index]]
	emit('update:modelValue', next)
}
// Glisser une colonne retenue : les flèches restent là pour le clavier.
const dragged = ref<string | null>(null)
const over = ref<string | null>(null)
const firstMovable = computed(() => (props.lockedKey ? 1 : 0))
function dropOn(target: string) {
	const key = dragged.value
	dragged.value = over.value = null
	if (!key || key === target || target === props.lockedKey) return
	const next = file.value.map((option) => option.key).filter((item) => item !== key)
	next.splice(next.indexOf(target), 0, key)
	emit('update:modelValue', next)
}
function openRubric(name: string) {
	rubric.value = name
	query.value = ''
}
watch([rubric, query], () => list.value?.scrollTo?.({ top: 0 }))
/** Échap vide d'abord la recherche ; une recherche déjà vide laisse la fenêtre se fermer. */
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && query.value) {
		event.stopPropagation()
		query.value = ''
	}
}
</script>

<template>
	<div class="flex flex-col gap-2">
		<input v-model="query" class="field-input" type="search" aria-label="Chercher une colonne" placeholder="Chercher une colonne dans toutes les rubriques" autocomplete="off" @keydown="onKeydown" />
		<div class="export-panes">
			<section class="export-pane" aria-label="Rubriques">
				<div class="export-pane-head">Rubriques</div>
				<div class="export-pane-body">
					<button v-for="item in own" :key="item.name" type="button" class="export-rubric" :aria-current="!searching && item.name === rubric ? 'true' : undefined" @click="openRubric(item.name)">
						<span class="truncate" :title="item.name">{{ item.name }}</span>
						<small><b v-if="chosenIn(item.options)">{{ chosenIn(item.options) }}</b><template v-if="chosenIn(item.options)"> / </template>{{ item.options.length }}</small>
					</button>
					<template v-if="others.length">
						<p class="export-rubric-sep">Autres rubriques</p>
						<button v-for="item in others" :key="item.name" type="button" class="export-rubric" :aria-current="!searching && item.name === rubric ? 'true' : undefined" @click="openRubric(item.name)">
							<span class="truncate" :title="item.name">{{ item.name }}</span>
							<small><b v-if="chosenIn(item.options)">{{ chosenIn(item.options) }}</b><template v-if="chosenIn(item.options)"> / </template>{{ item.options.length }}</small>
						</button>
					</template>
				</div>
			</section>

			<section class="export-pane" :aria-label="heading">
				<div class="export-pane-head">
					<span class="truncate">{{ heading }}</span>
					<button v-if="shown.length" type="button" class="text-link" @click="toggleAll">{{ allChecked ? 'Tout décocher' : 'Tout cocher' }}</button>
				</div>
				<div ref="list" class="export-pane-body">
					<p v-if="!shown.length" class="filter-field-empty">Aucune colonne ne porte ce nom.</p>
					<div v-else class="export-fields">
						<label v-for="option in shown" :key="option.key" class="export-field" :class="selected.has(option.key) && 'export-field-on'" :title="option.label">
							<input type="checkbox" :checked="selected.has(option.key)" :disabled="option.key === lockedKey" @change="toggle(option.key)" />
							<span class="min-w-0">
								{{ option.label }}
								<small v-if="searching">{{ option.group }}</small>
							</span>
						</label>
					</div>
				</div>
			</section>

			<section class="export-pane" :aria-label="fileTitle">
				<div class="export-pane-head">
					<span>{{ fileTitle }} ({{ file.length }})</span>
					<button type="button" class="text-link" @click="emit('update:modelValue', [...listColumns])">Réinitialiser</button>
				</div>
				<div class="export-pane-body">
					<p v-if="!file.length" class="filter-field-empty">Cochez au moins une colonne.</p>
					<div
						v-for="(option, index) in file"
						:key="option.key"
						class="export-file-column"
						:class="{ 'export-file-column-drag': draggable && option.key !== lockedKey, 'export-file-column-drop': over === option.key && dragged !== option.key }"
						:draggable="draggable && option.key !== lockedKey"
						@dragstart="dragged = option.key"
						@dragover="dragged && option.key !== lockedKey && ($event.preventDefault(), (over = option.key))"
						@drop.prevent="dropOn(option.key)"
						@dragend="dragged = over = null"
					>
						<span class="truncate" :title="option.label">{{ option.label }}</span>
						<button type="button" class="export-mini" :aria-label="`Monter ${option.label}`" :disabled="index <= firstMovable" @click="move(option.key, -1)"><LucideChevronUp class="h-3 w-3" aria-hidden="true" /></button>
						<button type="button" class="export-mini" :aria-label="`Descendre ${option.label}`" :disabled="index === file.length - 1 || index < firstMovable" @click="move(option.key, 1)"><LucideChevronDown class="h-3 w-3" aria-hidden="true" /></button>
						<button type="button" class="export-mini" :aria-label="`Retirer ${option.label}`" :disabled="option.key === lockedKey" @click="toggle(option.key)"><LucideX class="h-3 w-3" aria-hidden="true" /></button>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>
