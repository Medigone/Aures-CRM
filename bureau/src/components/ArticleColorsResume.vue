<script setup lang="ts">
import { teinteDetail, teinteHex, type ArticleTeinte } from '@/lib/articles'

/** Les couleurs dans le tiroir : un carré, le code, puis la nature de la couleur, sur deux colonnes. */
defineProps<{ teintes: ArticleTeinte[] }>()
</script>

<template>
	<ul class="color-resume">
		<li v-for="(teinte, index) in teintes" :key="index" class="color-resume-line">
			<span class="color-swatch" :class="!teinteHex(teinte) && 'color-swatch-none'" :style="teinteHex(teinte) ? { background: teinteHex(teinte)! } : undefined" aria-hidden="true"></span>
			<span class="min-w-0" :title="teinte.approximative ? 'Teinte approximative' : undefined">
				<span class="color-resume-code">{{ teinte.code }}<span v-if="teinte.approximative" class="sr-only">, teinte approximative</span></span>
				<span class="color-resume-detail">{{ teinteDetail(teinte) }}</span>
			</span>
		</li>
	</ul>
	<p class="color-note">Aperçu indicatif, le nuancier fait foi.</p>
</template>
