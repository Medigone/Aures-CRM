<script setup lang="ts">
import { computed } from 'vue'
import { dimensionsLabel, type SheetDrawing } from '@/lib/etudePieces'

/** La feuille telle que le moteur l'a calculée : la silhouette réelle de découpe, posée selon la grille. */
const props = defineProps<{ dessin: SheetDrawing }>()
const poses = computed(() => {
	const { n_col, n_rang, lisiere, pince, pas_laize, pas_depl } = props.dessin
	const list: string[] = []
	for (let rang = 0; rang < n_rang; rang++) for (let col = 0; col < n_col; col++) list.push(`translate(${lisiere + col * pas_laize} ${pince + rang * pas_depl})`)
	return list
})
const size = computed(() => `${props.dessin.laize} × ${props.dessin.developpement}`.replace(/\./g, ','))
const label = computed(() => `Feuille ${size.value} millimètres, ${poses.value.length} poses, ${props.dessin.n_col} colonnes et ${props.dessin.n_rang} rangs`)
</script>

<template>
	<figure class="etude-sheet">
		<svg :viewBox="`0 0 ${dessin.laize} ${dessin.developpement}`" role="img" :aria-label="label">
			<g v-for="pose in poses" :key="pose" :transform="pose">
				<path class="etude-sheet-cut" :d="dessin.coupe" />
				<path v-if="dessin.rainage" class="etude-sheet-crease" :d="dessin.rainage" />
			</g>
		</svg>
		<figcaption class="tabular-nums">Feuille {{ size }} mm · {{ dessin.n_col }} × {{ dessin.n_rang }} · pas {{ dimensionsLabel(`${dessin.pas_laize}x${dessin.pas_depl}`) }} mm</figcaption>
	</figure>
</template>
