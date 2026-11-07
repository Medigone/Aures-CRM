<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { mm, type Scenario, type SilhouetteVue } from '@/lib/atelier'

/** La feuille à l'échelle. Molette pour zoomer, glisser pour se déplacer, double clic pour revenir. Le moteur compte depuis la pince, en bas. */
const props = defineProps<{ scenario: Scenario; silhouette: Record<string, SilhouetteVue>; lisiere: number; pince: number; marge: number }>()

const paths = computed(() => props.silhouette[String(props.scenario.rotation || 0)] ?? props.silhouette['0'])
const poses = computed(() => {
	const { n_col, n_rang, pas_laize, pas_depl } = props.scenario
	const list: string[] = []
	for (let col = 0; col < n_col; col++) for (let rang = 0; rang < n_rang; rang++) list.push(`translate(${props.lisiere + col * pas_laize} ${props.pince + rang * pas_depl})`)
	return list
})
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
const label = computed(() => `Feuille ${mm(props.scenario.laize)} par ${mm(props.scenario.depl)} millimètres, ${props.scenario.nb_poses} poses, ${props.scenario.n_col} colonnes et ${props.scenario.n_rang} rangs`)
</script>

<template>
	<div class="atelier-sheet">
		<svg :viewBox="viewBox" :style="{ aspectRatio: `${scenario.laize} / ${scenario.depl}` }" role="img" :aria-label="label" @wheel.prevent="onWheel" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @dblclick="fit">
			<g :transform="`translate(0 ${scenario.depl}) scale(1 -1)`">
				<rect class="atelier-sheet-paper" :width="scenario.laize" :height="scenario.depl" />
				<rect class="atelier-sheet-useful" :x="lisiere" :y="pince" :width="scenario.laize - 2 * lisiere" :height="scenario.depl - pince - marge" />
				<g v-for="pose in poses" :key="pose" :transform="pose">
					<path class="atelier-sheet-cut" :d="paths.path_coupe" />
					<path v-if="paths.path_rainage" class="atelier-sheet-crease" :d="paths.path_rainage" />
				</g>
			</g>
		</svg>
		<div class="atelier-sheet-tools">
			<button type="button" class="btn-secondary" aria-label="Agrandir" @click="zoom(0.7)">+</button>
			<button type="button" class="btn-secondary" aria-label="Réduire" @click="zoom(1.4)">−</button>
			<button type="button" class="btn-secondary" @click="fit">Ajuster</button>
			<span>Noir : coupe. Rouge : rainage. Pointillé : zone utile. Pince en bas.</span>
		</div>
	</div>
</template>
