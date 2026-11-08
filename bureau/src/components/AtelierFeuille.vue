<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isMotif, mm, motifShort, poseTransform, posesOf, silhouetteKey, type Scenario, type SilhouetteVue } from '@/lib/atelier'

/** La feuille à l'échelle. Ctrl ou Cmd avec la molette (ou le pincement) pour zoomer, la molette seule fait défiler la page, glisser pour se déplacer, double clic pour revenir. Le moteur compte depuis la pince, en bas. */
const props = defineProps<{ scenario: Scenario; silhouette: Record<string, SilhouetteVue>; lisiere: number; pince: number; marge: number }>()

const paths = computed(() => props.silhouette[silhouetteKey(props.scenario.rotation)] ?? props.silhouette['0'])
// Placées par le moteur ; une pose retournée (tête-bêche) reprend la même silhouette, tournée de 180°.
const poses = computed(() => posesOf(props.scenario).map((pose, index) => ({ key: index, transform: poseTransform(pose, props.lisiere, props.pince, paths.value.l, paths.value.d) })))
const view = ref({ x: 0, y: 0, width: 0, height: 0 })
function fit() {
	view.value = { x: 0, y: 0, width: props.scenario.laize, height: props.scenario.depl }
}
watch(() => [props.scenario.laize, props.scenario.depl], fit, { immediate: true })
const viewBox = computed(() => `${view.value.x} ${view.value.y} ${view.value.width} ${view.value.height}`)
function zoom(factor: number) {
	const { x, y, width, height } = view.value
	const nextWidth = width * factor
	const nextHeight = height * factor
	view.value = { x: x + (width - nextWidth) / 2, y: y + (height - nextHeight) / 2, width: nextWidth, height: nextHeight }
}
function onWheel(event: WheelEvent) {
	// La feuille occupe presque tout l'écran : la molette seule doit faire défiler la page.
	if (!event.ctrlKey && !event.metaKey) return
	event.preventDefault()
	zoom(event.deltaY > 0 ? 1.1 : 0.9)
}
let last: { x: number; y: number } | null = null
function onDown(event: PointerEvent) {
	last = { x: event.clientX, y: event.clientY }
	;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
}
function onMove(event: PointerEvent) {
	if (!last) return
	const element = event.currentTarget as Element
	const scale = view.value.width / (element.clientWidth || 1)
	view.value = { ...view.value, x: view.value.x - (event.clientX - last.x) * scale, y: view.value.y - (event.clientY - last.y) * scale }
	last = { x: event.clientX, y: event.clientY }
}
function onUp() {
	last = null
}
const label = computed(() => `Feuille ${mm(props.scenario.laize)} par ${mm(props.scenario.depl)} millimètres, ${props.scenario.nb_poses} poses, ${props.scenario.n_col} colonnes et ${props.scenario.n_rang} rangs${isMotif(props.scenario) ? `, ${motifShort(props.scenario)}` : ''}`)
</script>

<template>
	<div class="atelier-sheet">
		<svg :viewBox="viewBox" :style="{ aspectRatio: `${scenario.laize} / ${scenario.depl}` }" role="img" :aria-label="label" @wheel="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @dblclick="fit">
			<g :transform="`translate(0 ${scenario.depl}) scale(1 -1)`">
				<rect class="atelier-sheet-paper" :width="scenario.laize" :height="scenario.depl" />
				<rect class="atelier-sheet-useful" :x="lisiere" :y="pince" :width="scenario.laize - 2 * lisiere" :height="scenario.depl - pince - marge" />
				<g v-for="pose in poses" :key="pose.key" :transform="pose.transform">
					<path class="atelier-sheet-cut" :d="paths.path_coupe" />
					<path v-if="paths.path_rainage" class="atelier-sheet-crease" :d="paths.path_rainage" />
				</g>
			</g>
		</svg>
		<div class="atelier-sheet-tools">
			<span class="atelier-legend"><span><i data-line="cut"></i>Coupe</span><span><i data-line="crease"></i>Rainage</span><span><i data-line="useful"></i>Zone utile</span><span>Pince en bas</span></span>
			<span class="flex-1"></span>
			<span class="atelier-zoom" title="Ctrl ou ⌘ + molette pour zoomer, glisser pour se déplacer, double clic pour revenir">
				<button type="button" class="btn-secondary" aria-label="Agrandir" @click="zoom(0.7)">+</button>
				<button type="button" class="btn-secondary" aria-label="Réduire" @click="zoom(1.4)">−</button>
				<button type="button" class="btn-secondary" @click="fit">Ajuster</button>
			</span>
		</div>
	</div>
</template>
