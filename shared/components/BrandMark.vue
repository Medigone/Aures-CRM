<script setup lang="ts">
/** `lg` : écrans où la marque est seule en tête (connexion). `markOnly` : le logo sans le nom, dans la barre du haut. */
withDefaults(defineProps<{ size?: 'md' | 'lg'; markOnly?: boolean }>(), { size: 'md' })
</script>

<!-- Logo « Pli » et nom de la société ; suit la couleur du texte (clair/sombre). -->
<template>
	<div class="flex items-center" :class="size === 'lg' ? 'gap-3' : 'gap-2'">
		<svg viewBox="0 0 100 100" class="shrink-0 text-ink-gray-9" :class="size === 'lg' ? 'h-12 w-12' : 'h-7 w-7'" aria-hidden="true">
			<polygon points="50,20 20,80 50,70" fill="currentColor" />
			<polygon points="50,20 50,70 80,80" fill="currentColor" fill-opacity="0.55" />
		</svg>
		<p v-if="!markOnly" class="min-w-0 truncate font-bold tracking-tight" :class="size === 'lg' ? 'text-xl' : 'text-sm'">Aures <span class="font-medium text-ink-gray-6">Emballages</span></p>
	</div>
</template>
