<script setup lang="ts">
import { computed } from 'vue'

/** Tags d'une ligne de liste, en lecture seule : les premiers, puis le nombre restant. Tous se lisent au survol. */
const props = defineProps<{ tags?: string[]; max: number }>()
const all = computed(() => props.tags ?? [])
const rest = computed(() => all.value.length - props.max)
</script>

<template>
	<span class="tag-cell" :title="all.join(', ') || undefined">
		<span v-for="tag in all.slice(0, max)" :key="tag" class="tag-pill"><span>{{ tag }}</span></span>
		<span v-if="rest > 0" class="tag-more">+{{ rest }}</span>
	</span>
</template>
