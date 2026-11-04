<script setup lang="ts">
import { computed } from 'vue'
import LucideX from '~icons/lucide/x'
import { FIELDS, kindOf, needsValue, newCondition, operatorsOf, withField, type Condition, type FilterField } from '@/lib/filters'
import { statusLabel } from '@/lib/display'
import type { Option, References } from '@/types'

/** Par défaut, les filtres des tickets. Une autre liste fournit ses champs et les valeurs de chacun. */
const props = defineProps<{ modelValue: Condition[]; references?: References | null; fields?: FilterField[]; firstField?: string; choicesOf?: (field: string) => Option[] }>()
const fieldList = computed(() => props.fields ?? FIELDS)
const emit = defineEmits<{ 'update:modelValue': [value: Condition[]] }>()

const assigneeOptions = computed<Option[]>(() => [
	{ value: props.references?.nobody ?? '', label: 'Non attribué' },
	...(props.references?.assignees ?? []),
])

function choices(field: string): Option[] {
	if (props.choicesOf) return props.choicesOf(field)
	const refs = props.references
	if (!refs) return []
	if (field === 'assigne') return assigneeOptions.value
	const values = { type: refs.types, status: refs.statuses, urgence: refs.urgences, creance: refs.creances }[field] ?? []
	return values.map((value) => ({ value, label: field === 'status' ? statusLabel(value) : value }))
}

function update(id: number, change: (condition: Condition) => Condition) {
	emit('update:modelValue', props.modelValue.map((condition) => (condition.id === id ? change(condition) : condition)))
}
function setField(condition: Condition, event: Event) {
	update(condition.id, (current) => withField(current, (event.target as HTMLSelectElement).value, fieldList.value))
}
function setOp(condition: Condition, event: Event) {
	update(condition.id, (current) => ({ ...current, op: (event.target as HTMLSelectElement).value }))
}
function setValue(condition: Condition, event: Event) {
	update(condition.id, (current) => ({ ...current, value: (event.target as HTMLInputElement).value }))
}
function remove(id: number) {
	emit('update:modelValue', props.modelValue.filter((condition) => condition.id !== id))
}
function add() {
	const id = props.modelValue.reduce((max, condition) => Math.max(max, condition.id), 0) + 1
	emit('update:modelValue', [...props.modelValue, newCondition(id, props.firstField, fieldList.value)])
}
</script>

<template>
	<div class="card flex max-h-[40vh] flex-none flex-col gap-1.5 overflow-y-auto p-2">
		<p v-if="!modelValue.length" class="text-ink-gray-6">Aucun filtre. Chaque filtre ajouté s'ajoute aux précédents.</p>
		<div v-for="condition in modelValue" :key="condition.id" class="flex flex-col gap-1.5 rounded-control border border-outline-gray-2 p-2">
			<div class="flex items-center gap-1.5">
				<select class="field-input min-w-0 flex-1" aria-label="Champ du filtre" :value="condition.field" @change="setField(condition, $event)">
					<option v-for="field in fieldList" :key="field.value" :value="field.value">{{ field.label }}</option>
				</select>
				<button type="button" class="icon-btn" aria-label="Retirer ce filtre" @click="remove(condition.id)">
					<LucideX class="h-4 w-4" aria-hidden="true" />
				</button>
			</div>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] gap-1.5">
				<select class="field-input" aria-label="Condition" :value="condition.op" @change="setOp(condition, $event)">
					<option v-for="op in operatorsOf(condition.field, fieldList)" :key="op.value" :value="op.value">{{ op.label }}</option>
				</select>
				<template v-if="needsValue(condition)">
					<input v-if="kindOf(condition.field, fieldList) === 'text'" class="field-input" type="text" aria-label="Valeur" placeholder="Valeur" :value="condition.value" @input="setValue(condition, $event)" />
					<input v-else-if="kindOf(condition.field, fieldList) === 'date'" class="field-input" type="date" aria-label="Valeur" :value="condition.value" @input="setValue(condition, $event)" />
					<select v-else class="field-input" aria-label="Valeur" :value="condition.value" @change="setValue(condition, $event)">
						<option value="">Choisir…</option>
						<option v-for="option in choices(condition.field)" :key="option.value" :value="option.value">{{ option.label }}</option>
					</select>
				</template>
			</div>
		</div>
		<button type="button" class="btn-secondary" @click="add">Ajouter un filtre</button>
	</div>
</template>
