<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LucideSearch from '~icons/lucide/search'
import { shortcutLabel } from '@/lib/palette'

/** Barre du haut : elle ouvre la palette de commandes, au clic comme au raccourci. */
const emit = defineEmits<{ toggle: [] }>()
const trigger = ref<HTMLButtonElement | null>(null)

function onShortcut(event: KeyboardEvent) {
	if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return
	event.preventDefault()
	// Une saisie en cours dans un autre dialogue passe avant.
	if (!document.querySelector('.dialog-scrim:not(.command-palette-scrim)')) emit('toggle')
}
onMounted(() => window.addEventListener('keydown', onShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', onShortcut))

defineExpose({ focus: () => trigger.value?.focus() })
</script>

<template>
	<div class="global-search">
		<button ref="trigger" type="button" class="field-input global-search-trigger" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" aria-label="Rechercher ou créer" @click="emit('toggle')">
			<LucideSearch class="h-3.5 w-3.5 flex-none text-ink-gray-5" aria-hidden="true" />
			<span class="min-w-0 flex-auto truncate">Rechercher ou créer</span>
			<kbd class="palette-kbd">{{ shortcutLabel() }}</kbd>
		</button>
	</div>
</template>
