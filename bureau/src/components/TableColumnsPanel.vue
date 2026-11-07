<script setup lang="ts" generic="Row">
import { computed, onMounted, ref } from 'vue'
import LucideChevronDown from '~icons/lucide/chevron-down'
import LucideChevronUp from '~icons/lucide/chevron-up'
import LucidePin from '~icons/lucide/pin'
import type { Column } from '@/lib/list'
import { DENSITIES, MAX_PINNED, type TableDisplay } from '@/lib/tableDisplay'
import '@/tableDisplay.css'

/** Panneau Colonnes : densité, puis ordre, épinglage et visibilité de chaque colonne. Tout s'applique aussitôt. */
const props = defineProps<{
	display: TableDisplay
	shown: Column<Row>[]
	/** Colonnes de la liste, affichées ou non. */
	columns: Column<Row>[]
	locked: string
}>()
const emit = defineEmits<{ close: []; show: [key: string]; hide: [key: string]; move: [key: string, target: string]; more: []; reset: [] }>()

const panel = ref<HTMLElement | null>(null)
const hidden = computed(() => props.columns.filter(({ key }) => !props.shown.some((column) => column.key === key)))
const position = (key: string) => props.shown.findIndex((column) => column.key === key)
/** Une colonne ne quitte pas son groupe en montant ou descendant : épingler ou non reste un choix explicite. */
function neighbour(key: string, step: -1 | 1) {
	const next = props.shown[position(key) + step]
	if (!next || next.key === props.locked || key === props.locked) return null
	return props.display.isPinned(next.key) === props.display.isPinned(key) ? next.key : null
}
function moveUp(key: string) {
	const target = neighbour(key, -1)
	if (target) emit('move', key, target)
}
function moveDown(key: string) {
	const target = neighbour(key, 1)
	if (target) emit('move', target, key)
}
function pinTitle(key: string) {
	if (key === props.locked) return 'Toujours épinglée'
	if (props.display.isPinned(key)) return 'Détacher'
	return props.display.canPinMore.value ? 'Épingler à gauche' : `${MAX_PINNED} colonnes épinglées au maximum`
}
onMounted(() => panel.value?.focus())
</script>

<template>
	<div ref="panel" class="app-menu app-menu-right table-panel-panel" role="dialog" aria-label="Colonnes et densité" tabindex="-1" @keydown.esc.stop="emit('close')">
		<fieldset class="table-panel-density">
			<legend class="app-menu-title">Densité</legend>
			<label v-for="item in DENSITIES" :key="item.key" :class="display.density.value === item.key && 'is-on'">
				<input type="radio" name="table-panel-density" class="sr-only" :value="item.key" :checked="display.density.value === item.key" @change="display.setDensity(item.key)" />
				{{ item.label }}
			</label>
		</fieldset>

		<p class="app-menu-title">Colonnes affichées</p>
		<ul class="table-panel-columns">
			<li v-for="column in shown" :key="column.key">
				<span class="table-panel-label" :title="column.label">{{ column.label }}</span>
				<button type="button" class="export-mini" :aria-label="`Monter ${column.label}`" :disabled="!neighbour(column.key, -1)" @click="moveUp(column.key)"><LucideChevronUp class="h-3 w-3" aria-hidden="true" /></button>
				<button type="button" class="export-mini" :aria-label="`Descendre ${column.label}`" :disabled="!neighbour(column.key, 1)" @click="moveDown(column.key)"><LucideChevronDown class="h-3 w-3" aria-hidden="true" /></button>
				<button
					type="button"
					class="table-panel-pin"
					:aria-pressed="display.isPinned(column.key)"
					:aria-label="`Épingler ${column.label}`"
					:title="pinTitle(column.key)"
					:disabled="column.key === locked || (!display.isPinned(column.key) && !display.canPinMore.value)"
					@click="display.togglePin(column.key)"
				>
					<LucidePin class="h-3.5 w-3.5" aria-hidden="true" />
				</button>
				<input type="checkbox" role="switch" class="table-panel-switch" checked :aria-label="`Afficher ${column.label}`" :disabled="column.key === locked" :title="column.key === locked ? 'Colonne toujours affichée' : undefined" @change="emit('hide', column.key)" />
			</li>
		</ul>

		<template v-if="hidden.length">
			<p class="app-menu-title">Colonnes masquées</p>
			<ul class="table-panel-columns">
				<li v-for="column in hidden" :key="column.key">
					<span class="table-panel-label is-hidden" :title="column.label">{{ column.label }}</span>
					<input type="checkbox" role="switch" class="table-panel-switch" :aria-label="`Afficher ${column.label}`" @change="emit('show', column.key)" />
				</li>
			</ul>
		</template>

		<div class="app-menu-sep"></div>
		<button type="button" class="app-menu-item" @click="emit('more')">Autres champs…</button>
		<button type="button" class="app-menu-item" @click="emit('reset')">Réinitialiser l'affichage</button>
		<p class="table-panel-note">Réglages gardés sur cet appareil, pour votre compte : ils ne suivent pas sur un autre appareil.</p>
	</div>
</template>
