<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import FieldInput from './FieldInput.vue'
import type { BulkField } from '@/types'

/** « Modifier » du Desk : un champ, une valeur, appliqués à toutes les lignes cochées. */
const props = defineProps<{ doctype: string; fields: BulkField[]; countLabel: string }>()
const emit = defineEmits<{ close: []; submit: [field: BulkField, value: string] }>()

const fieldname = ref('')
const value = ref('')
const sorted = computed(() => [...props.fields].sort((left, right) => left.label.localeCompare(right.label, 'fr')))
const field = computed(() => props.fields.find((item) => item.fieldname === fieldname.value))
const empty = computed(() => !value.value.trim())
const canSubmit = computed(() => Boolean(field.value) && !(empty.value && (field.value?.required || field.value?.fieldtype === 'Check')))
watch(fieldname, () => {
	value.value = ''
})
function submit() {
	if (canSubmit.value && field.value) emit('submit', field.value, value.value)
}
</script>

<template>
	<FormDialog title="Modifier la sélection" :dirty="Boolean(fieldname)" hint="Ctrl + Entrée pour appliquer" @close="emit('close')" @submit="submit">
		<!-- Hauteur réservée : le corps de la fenêtre défile, et couperait la liste des valeurs d'un lien. -->
		<div class="flex flex-col gap-3.5" :class="field?.fieldtype === 'Link' && 'min-h-[21rem]'">
			<div class="form-field">
				<label class="field-label" for="bulk-field">Champ</label>
				<select id="bulk-field" v-model="fieldname" class="field-input">
					<option value="">Choisir…</option>
					<option v-for="item in sorted" :key="item.fieldname" :value="item.fieldname">{{ item.label }}</option>
				</select>
			</div>
			<div v-if="field" :key="field.fieldname" class="form-field">
				<label class="field-label" for="bulk-value">Valeur <span v-if="field.required" class="req">obligatoire</span></label>
				<FieldInput v-model="value" :doctype="doctype" :field="field" input-id="bulk-value" />
			</div>
			<p v-if="field && empty && !field.required && field.fieldtype !== 'Check'" class="text-sm text-tone-red" role="status">Ce champ sera vidé sur {{ countLabel }}.</p>
		</div>
		<template #actions>
			<button type="button" class="btn-primary" :disabled="!canSubmit" @click="submit">Modifier {{ countLabel }}</button>
		</template>
	</FormDialog>
</template>
