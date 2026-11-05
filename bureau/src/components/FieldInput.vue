<script setup lang="ts">
import LinkInput from './LinkInput.vue'
import type { BulkField } from '@/types'

/** Saisie d'une valeur selon le type du champ dans la métadonnée. */
defineProps<{ doctype: string; field: BulkField; modelValue: string; inputId: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const onInput = (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value)
</script>

<template>
	<LinkInput v-if="field.fieldtype === 'Link'" :doctype="doctype" :fieldname="field.fieldname" :model-value="modelValue" :input-id="inputId" @update:model-value="emit('update:modelValue', $event)" />
	<select v-else-if="field.fieldtype === 'Check'" :id="inputId" class="field-input" :value="modelValue" @change="onInput">
		<option value="">Choisir…</option>
		<option value="1">Oui</option>
		<option value="0">Non</option>
	</select>
	<select v-else-if="field.fieldtype === 'Select'" :id="inputId" class="field-input" :value="modelValue" @change="onInput">
		<option value="">{{ field.required ? 'Choisir…' : 'Vide' }}</option>
		<option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
	</select>
	<input v-else-if="field.fieldtype === 'Date'" :id="inputId" class="field-input" type="date" :value="modelValue" @input="onInput" />
	<input v-else-if="field.fieldtype === 'Datetime'" :id="inputId" class="field-input" type="datetime-local" :value="modelValue" @input="onInput" />
	<input v-else-if="field.fieldtype === 'Int'" :id="inputId" class="field-input" type="number" step="1" :value="modelValue" @input="onInput" />
	<input v-else-if="['Float', 'Currency', 'Percent'].includes(field.fieldtype)" :id="inputId" class="field-input" type="number" step="any" :value="modelValue" @input="onInput" />
	<textarea v-else-if="['Small Text', 'Text', 'Long Text'].includes(field.fieldtype)" :id="inputId" class="field-input h-auto" rows="3" :value="modelValue" @input="onInput"></textarea>
	<input v-else :id="inputId" class="field-input" type="text" :value="modelValue" @input="onInput" />
</template>
