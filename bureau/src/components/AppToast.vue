<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import LucideCircleCheck from '~icons/lucide/circle-check'
import LucideInfo from '~icons/lucide/info'
import LucideTriangleAlert from '~icons/lucide/triangle-alert'
import LucideX from '~icons/lucide/x'

/** Message passager, en bas à droite. Une erreur à corriger reste dans la page, près de ce qu'elle concerne. */
const props = withDefaults(defineProps<{ message: string; tone?: 'success' | 'info' | 'warning'; duration?: number }>(), { tone: 'success', duration: 4000 })
const emit = defineEmits<{ close: [] }>()

let timer: ReturnType<typeof setTimeout> | undefined
function arm() {
	clearTimeout(timer)
	if (props.message && props.duration) timer = setTimeout(() => emit('close'), props.duration)
}
watch(() => [props.message, props.duration], arm, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
	<div v-if="message" class="app-toast" role="status" :data-tone="tone">
		<LucideCircleCheck v-if="tone === 'success'" class="app-toast-icon" aria-hidden="true" />
		<LucideTriangleAlert v-else-if="tone === 'warning'" class="app-toast-icon" aria-hidden="true" />
		<LucideInfo v-else class="app-toast-icon" aria-hidden="true" />
		<span class="min-w-0 flex-auto">{{ message }}</span>
		<slot />
		<button type="button" class="comment-tool" aria-label="Fermer ce message" @click="emit('close')"><LucideX class="h-3.5 w-3.5" aria-hidden="true" /></button>
	</div>
</template>
