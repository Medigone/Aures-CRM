<script setup lang="ts">
import { computed } from 'vue'
import FilterLinkInput from './FilterLinkInput.vue'
import { valueChoices, valueInput, type FilterField } from '@/lib/filters'

/** La valeur d'une condition : sa saisie dépend du champ et de la condition choisie. */
const props = defineProps<{ modelValue: string; op: string; field?: FilterField; listDoctype: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const kind = computed(() => valueInput(props.field, props.op))
const choices = computed(() => valueChoices(props.field, props.op))
const bounds = computed(() => {
	const [start = '', end = ''] = props.modelValue.split(',')
	return { start, end }
})
const read = (event: Event) => (event.target as HTMLInputElement).value
function setBound(which: 'start' | 'end', event: Event) {
	const next = { ...bounds.value, [which]: read(event) }
	emit('update:modelValue', next.start || next.end ? `${next.start},${next.end}` : '')
}
</script>

<template>
	<template v-if="kind === 'between'">
		<input class="field-input" type="date" aria-label="Date de début" :value="bounds.start" @input="setBound('start', $event)" />
		<input class="field-input" type="date" aria-label="Date de fin" :value="bounds.end" @input="setBound('end', $event)" />
	</template>
	<select v-else-if="kind === 'select'" class="field-input" aria-label="Valeur" :value="modelValue" @change="emit('update:modelValue', read($event))">
		<option value="">Choisir…</option>
		<option v-for="option in choices" :key="option.value" :value="option.value">{{ option.label }}</option>
	</select>
	<FilterLinkInput v-else-if="kind === 'link' && field" :model-value="modelValue" :list-doctype="listDoctype" :doctype="field.doctype" :field="field.field" @update:model-value="emit('update:modelValue', $event)" />
	<input v-else-if="kind === 'date'" class="field-input" type="date" aria-label="Valeur" :value="modelValue" @input="emit('update:modelValue', read($event))" />
	<input v-else-if="kind === 'number'" class="field-input" type="number" aria-label="Valeur" placeholder="Valeur" :value="modelValue" @input="emit('update:modelValue', read($event))" />
	<input v-else class="field-input" type="text" aria-label="Valeur" :placeholder="kind === 'list' ? 'Séparées par des virgules' : 'Valeur'" :value="modelValue" @input="emit('update:modelValue', read($event))" />
</template>
