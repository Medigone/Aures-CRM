<script setup lang="ts">
import { computed } from 'vue'
import { poseTransform, posesOf } from '@/lib/atelier'
import { dimensionsLabel, type SheetDrawing } from '@/lib/etudePieces'

/** La feuille telle que le moteur l'a calculée : la silhouette réelle de découpe, posée selon la grille ou le motif. */
const props = defineProps<{ dessin: SheetDrawing }>()
// Une pose retournée (tête-bêche) reprend la même silhouette, tournée de 180°.
const poses = computed(() => {
	const { lisiere, pince, pose_l = 0, pose_d = 0 } = props.dessin
	return posesOf({ ...props.dessin, rotation: 0 }).map((pose, index) => ({ key: index, transform: poseTransform(pose, lisiere, pince, pose_l, pose_d) }))
})
const size = computed(() => `${props.dessin.laize} × ${props.dessin.developpement}`.replace(/\./g, ','))
const label = computed(() => `Feuille ${size.value} millimètres, ${poses.value.length} poses, ${props.dessin.n_col} colonnes et ${props.dessin.n_rang} rangs`)
</script>

<template>
	<figure class="etude-sheet">
		<svg :viewBox="`0 0 ${dessin.laize} ${dessin.developpement}`" role="img" :aria-label="label">
			<!-- Le moteur compte depuis la pince, en bas de la feuille : comme sur l'atelier, l'axe vertical est retourné. -->
			<g :transform="`translate(0 ${dessin.developpement}) scale(1 -1)`">
				<g v-for="pose in poses" :key="pose.key" :transform="pose.transform">
					<path class="etude-sheet-cut" :d="dessin.coupe" />
					<path v-if="dessin.rainage" class="etude-sheet-crease" :d="dessin.rainage" />
				</g>
			</g>
		</svg>
		<figcaption class="tabular-nums">Feuille {{ size }} mm · {{ dessin.n_col }} × {{ dessin.n_rang }}<template v-if="dessin.motif"> · {{ dessin.motif }}</template><template v-else> · pas {{ dimensionsLabel(`${dessin.pas_laize}x${dessin.pas_depl}`) }} mm</template></figcaption>
	</figure>
</template>
