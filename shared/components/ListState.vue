<script setup lang="ts">
/** État vide d'une liste ou d'un onglet. `dieline` : le tracé d'une boîte à plat, trait plein pour la coupe, pointillé pour le pli. */
defineProps<{ title: string; text: string; dieline?: boolean }>()
</script>

<template>
	<div class="list-state">
		<svg v-if="dieline" class="dieline" viewBox="0 0 120 84" aria-hidden="true">
			<path class="cut" d="M8 24 L8 60 L20 60 L24 76 L52 76 L56 60 L92 60 L96 76 L108 76 L112 60 L112 24 L108 8 L96 8 L92 24 L56 24 L52 8 L24 8 L20 24 Z" />
			<path class="fold" d="M20 24 L20 60 M56 24 L56 60 M92 24 L92 60 M20 24 L56 24 M92 24 L112 24 M20 60 L56 60 M92 60 L112 60" />
		</svg>
		<h3>{{ title }}</h3>
		<p>{{ text }}</p>
		<slot />
	</div>
</template>
