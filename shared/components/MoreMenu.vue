<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LucideEllipsis from '~icons/lucide/ellipsis'

/** Menu `⋯` : les actions rares ou difficiles à défaire. */
const open = ref(false)
const root = ref<HTMLElement | null>(null)
function close() {
	open.value = false
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
	<div ref="root" class="relative flex-none">
		<button type="button" class="icon-btn" aria-label="Autres actions" title="Autres actions" aria-haspopup="menu" :aria-expanded="open" @click="open = !open">
			<LucideEllipsis class="h-4 w-4" aria-hidden="true" />
		</button>
		<div v-if="open" class="app-menu app-menu-right" role="menu" @click="close">
			<slot />
		</div>
	</div>
</template>
