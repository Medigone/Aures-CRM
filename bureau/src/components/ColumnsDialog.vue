<script setup lang="ts" generic="Row">
import { computed, ref } from 'vue'
import FormDialog from '@shared/components/FormDialog.vue'
import ExportColumns from './ExportColumns.vue'
import { columnFromOption, exportColumnOptions, listColumnKeys, type ExportColumnOption } from '@/lib/exports'
import type { FilterField } from '@/lib/filters'
import type { Column } from '@/lib/list'
import type { ColumnSetting } from '@/lib/listViews'

/** Choix des colonnes de la liste, dans la même disposition que la fenêtre d'export. Tout s'applique aussitôt ; Annuler revient à l'état d'ouverture. */
const props = defineProps<{ columns: Column<Row>[]; fields: FilterField[]; settings: ColumnSetting[]; defaultColumns: string[]; locked: string }>()
const emit = defineEmits<{ change: [keys: string[]]; restore: [settings: ColumnSetting[]]; close: [] }>()

const opening = props.settings
// Les tags ont leur colonne dans chaque liste : leur champ brut n'apporterait rien de plus.
const options = computed<ExportColumnOption[]>(() => exportColumnOptions(props.columns, props.fields.filter((field) => field.field !== '_user_tags')))
const toOption = (key: string) => (key.includes('.') ? key : `liste:${key}`)
const selected = computed(() => props.settings.map(({ key }) => toOption(key)))
const defaults = computed(() => listColumnKeys(props.columns.filter((column) => props.defaultColumns.includes(column.key))))
const dirty = ref(false)

function update(keys: string[]) {
	dirty.value = true
	emit('change', keys.map(columnFromOption))
}
function cancel() {
	if (dirty.value) emit('restore', opening)
	emit('close')
}
</script>

<template>
	<FormDialog class="export-dialog" title="Colonnes de la liste" :dirty="false" @close="cancel" @submit="emit('close')">
		<ExportColumns :model-value="selected" :options="options" :list-columns="defaults" file-title="Colonnes affichées" :locked-key="toOption(locked)" draggable @update:model-value="update" />
		<template #hint>
			<span class="flex-auto text-sm text-ink-gray-6">Glissez une colonne pour la déplacer. Le changement s'applique aussitôt à la liste.</span>
		</template>
		<template #actions>
			<button type="button" class="btn-primary" @click="emit('close')">Fermer</button>
		</template>
	</FormDialog>
</template>
