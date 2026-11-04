<script setup lang="ts">
import type { CommentPart } from '../activity'

/** Texte d'un commentaire. Le serveur n'envoie jamais de HTML : rien n'est interprété ici. */
defineProps<{ parts: CommentPart[] }>()
</script>

<template>
	<p class="comment-text"><template v-for="(part, index) in parts" :key="index"><span v-if="part.mention" class="mention">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></p>
</template>
