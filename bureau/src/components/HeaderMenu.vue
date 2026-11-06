<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LucideChevronDown from '~icons/lucide/chevron-down'

/** Bouton à menu de la barre d'actions : un libellé, la valeur actuelle, et les choix en dessous. Le menu reste dans l'écran. */
defineProps<{ label: string; value: string; ariaLabel?: string; disabled?: boolean; menuClass?: string }>()
const emit = defineEmits<{ opened: [] }>()

const MENU_WIDTH = 288
const open = ref(false)
const alignRight = ref(false)
const root = ref<HTMLElement | null>(null)

function close() {
	open.value = false
}
function toggle() {
	open.value = !open.value
	if (!open.value) return
	alignRight.value = (root.value?.getBoundingClientRect().left ?? 0) + MENU_WIDTH > window.innerWidth - 8
	emit('opened')
}
function onPointerDown(event: PointerEvent) {
	if (open.value && !root.value?.contains(event.target as Node)) close()
}
function onKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape') close()
}
onMounted(() => {
	document.addEventListener('pointerdown', onPointerDown)
	document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
	document.removeEventListener('pointerdown', onPointerDown)
	document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
	<div ref="root" class="relative min-w-0 flex-none">
		<button type="button" class="btn-secondary header-menu-btn" :disabled="disabled" aria-haspopup="menu" :aria-expanded="open" :aria-label="ariaLabel" @click="toggle">
			<slot name="icon"></slot>
			{{ label }}
			<span v-if="value" class="header-menu-value" :title="value">{{ value }}</span>
			<LucideChevronDown class="h-3.5 w-3.5 flex-none" aria-hidden="true" />
		</button>
		<div v-if="open" class="app-menu header-menu" :class="[menuClass, alignRight && 'app-menu-right']" role="menu">
			<slot :close="close"></slot>
		</div>
	</div>
</template>
