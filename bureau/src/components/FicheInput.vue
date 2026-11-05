<script setup lang="ts">
import { computed } from 'vue'
import type { FicheField } from '@shared/fiche'

/** Saisie d'un champ de la fiche technique, selon son type sur le Desk. La valeur reste du texte, « 1 » ou « 0 » pour une case. */
const props = defineProps<{ field: FicheField }>()
const value = defineModel<string>({ required: true })

const id = computed(() => `fiche-${props.field.fieldname}`)
const isChoice = computed(() => props.field.fieldtype === 'Select' || props.field.fieldtype === 'Link')
// La valeur en place reste proposée, même si elle a quitté la liste.
const choices = computed(() => {
	const options = props.field.options ?? []
	return value.value && !options.includes(value.value) ? [value.value, ...options] : options
})
const isNumber = computed(() => ['Int', 'Float', 'Percent'].includes(props.field.fieldtype))
</script>

<template>
	<label v-if="field.fieldtype === 'Check'" class="flex min-h-[var(--ctl)] cursor-pointer items-center gap-2 self-end">
		<input type="checkbox" class="h-4 w-4" :checked="value === '1'" @change="value = ($event.target as HTMLInputElement).checked ? '1' : '0'" />
		{{ field.label }}
	</label>
	<div v-else class="form-field">
		<label class="field-label" :for="id">{{ field.label }}</label>
		<select v-if="isChoice" :id="id" v-model="value" class="field-input">
			<option value="">Non renseigné</option>
			<option v-for="item in choices" :key="item" :value="item">{{ item }}</option>
		</select>
		<input v-else :id="id" v-model="value" class="field-input" :class="isNumber && 'tabular-nums'" :type="isNumber ? 'number' : 'text'" :step="field.fieldtype === 'Int' ? '1' : 'any'" autocomplete="off" />
	</div>
</template>
