<script setup lang="ts">
import { ref } from 'vue'
import LucideX from '~icons/lucide/x'
import FilterFieldPicker from './FilterFieldPicker.vue'
import FilterValueInput from './FilterValueInput.vue'
import SavedFilters from './SavedFilters.vue'
import { conditionKey, fieldOf, newCondition, operatorOptions, type Condition, type FilterField } from '@/lib/filters'

/** Panneau de filtres, commun à toutes les listes : filtres enregistrés, puis conditions au format du Desk. */
const props = withDefaults(defineProps<{ modelValue: Condition[]; fields: FilterField[]; doctype: string; canSave?: boolean }>(), { canSave: true })
const emit = defineEmits<{ 'update:modelValue': [value: Condition[]] }>()

function update(id: number, change: Partial<Condition>) {
	emit('update:modelValue', props.modelValue.map((condition) => (condition.id === id ? { ...condition, ...change } : condition)))
}
/** Changer de champ repart de sa première condition, sans valeur : l'ancienne n'aurait plus de sens. */
function setField(condition: Condition, key: string) {
	const field = props.fields.find((item) => item.value === key)
	if (field) update(condition.id, newCondition(condition.id, field))
}
function setOp(condition: Condition, event: Event) {
	update(condition.id, { op: (event.target as HTMLSelectElement).value, value: '' })
}
function remove(id: number) {
	emit('update:modelValue', props.modelValue.filter((condition) => condition.id !== id))
}
// Un filtre qu'on ajoute s'ouvre sur son champ, prêt à la saisie.
const added = ref<number | null>(null)
function add() {
	const first = props.fields[0]
	if (!first) return
	const id = props.modelValue.reduce((max, condition) => Math.max(max, condition.id), 0) + 1
	added.value = id
	emit('update:modelValue', [...props.modelValue, newCondition(id, first)])
}
</script>

<template>
	<div class="flex max-h-[68vh] flex-none flex-col gap-2 overflow-y-auto">
		<SavedFilters :doctype="doctype" :conditions="modelValue" :can-save="canSave" @apply="emit('update:modelValue', $event)">
			<div class="flex flex-col gap-1">
				<span class="field-label mb-0">Conditions</span>
				<div class="card flex flex-col gap-1.5 p-2">
					<p v-if="!modelValue.length" class="text-ink-gray-6">Aucun filtre. Chaque filtre ajouté s'ajoute aux précédents.</p>
					<div v-for="condition in modelValue" :key="condition.id" class="flex flex-col gap-1.5 rounded-control border border-outline-gray-2 p-2">
						<div class="flex items-start gap-1.5">
							<FilterFieldPicker :model-value="conditionKey(condition)" :fields="fields" :autofocus="condition.id === added" @update:model-value="setField(condition, $event)" />
							<button type="button" class="icon-btn" aria-label="Retirer ce filtre" @click="remove(condition.id)">
								<LucideX class="h-4 w-4" aria-hidden="true" />
							</button>
						</div>
						<div class="grid grid-cols-[repeat(auto-fit,minmax(110px,1fr))] items-start gap-1.5">
							<select class="field-input" :class="condition.op === 'Between' && 'col-span-full'" aria-label="Condition" :value="condition.op" @change="setOp(condition, $event)">
								<option v-for="op in operatorOptions(fieldOf(condition, fields))" :key="op.value" :value="op.value">{{ op.label }}</option>
							</select>
							<FilterValueInput :model-value="condition.value" :op="condition.op" :field="fieldOf(condition, fields)" :list-doctype="doctype" @update:model-value="update(condition.id, { value: $event })" />
						</div>
					</div>
					<button type="button" class="btn-secondary" :disabled="!fields.length" @click="add">Ajouter un filtre</button>
				</div>
			</div>
		</SavedFilters>
	</div>
</template>
