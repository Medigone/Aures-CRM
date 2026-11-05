<script setup lang="ts">
import { computed } from 'vue'
import { teinteHex, type ArticleTeinte } from '@/lib/articles'

/** Lecture des couleurs d'un article : le code, et un petit carré indicatif à côté. */
const props = defineProps<{ teintes: ArticleTeinte[] }>()
const hasPreview = computed(() => props.teintes.some((teinte) => teinteHex(teinte)))
</script>

<template>
	<ul class="color-lines">
		<li v-for="(teinte, index) in teintes" :key="index" class="color-line">
			<span class="color-swatch" :class="!teinteHex(teinte) && 'color-swatch-none'" :style="teinteHex(teinte) ? { background: teinteHex(teinte)! } : undefined" aria-hidden="true"></span>
			<span class="color-code" :title="teinte.approximative ? 'Teinte approximative' : undefined">{{ teinte.label || teinte.code }}<span v-if="teinte.approximative" class="sr-only">, teinte approximative</span></span>
			<span v-if="teinte.nom" class="color-name">{{ teinte.nom }}</span>
			<span v-if="teinte.needs_suffix" class="color-name">Précisez C ou U</span>
		</li>
	</ul>
	<p v-if="hasPreview" class="color-note">Aperçu indicatif, le nuancier fait foi.</p>
</template>
