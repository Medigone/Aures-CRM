<script setup lang="ts">
import { computed } from 'vue'
import { poseTransform, posesOf, silhouetteKey, type Scenario, type SilhouetteVue } from '@/lib/atelier'

/** La feuille en petit, pour une vignette : le papier et le contour de coupe des poses, sans zoom ni rainage. */
const props = defineProps<{ scenario: Scenario; silhouette: Record<string, SilhouetteVue>; lisiere: number; pince: number }>()

const paths = computed(() => props.silhouette[silhouetteKey(props.scenario.rotation)] ?? props.silhouette['0'])
const poses = computed(() => (paths.value ? posesOf(props.scenario).map((pose) => poseTransform(pose, props.lisiere, props.pince, paths.value.l, paths.value.d)) : []))
</script>

<template>
	<svg class="atelier-mini" :viewBox="`0 0 ${scenario.laize} ${scenario.depl}`" aria-hidden="true" focusable="false">
		<g :transform="`translate(0 ${scenario.depl}) scale(1 -1)`">
			<rect class="atelier-sheet-paper" :width="scenario.laize" :height="scenario.depl" />
			<path v-for="(transform, index) in poses" :key="index" class="atelier-sheet-cut" :transform="transform" :d="paths.path_coupe" />
		</g>
	</svg>
</template>
