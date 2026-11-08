<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Crumb } from '@shared/shell'
import AtelierView from '@/components/AtelierView.vue'
import BureauShell from '@/components/BureauShell.vue'

/** Deux entrées pour un même atelier : le lien du menu pour un test rapide, la fiche d'une étude pour son imposition. */
const props = defineProps<{ id?: string; calcul?: string }>()
// Un tracé passé dans l'adresse ouvre un test rapide déjà chargé.
const route = useRoute()
const trace = computed(() => (!props.id && !props.calcul && typeof route.query.trace === 'string' ? route.query.trace : undefined))
const crumbs = computed<Crumb[]>(() =>
	props.id
		? [{ label: 'Études', to: { name: 'Etudes' } }, { label: props.id, to: { name: 'Etude', params: { id: props.id } } }, { label: 'Atelier' }]
		: props.calcul
			? [{ label: 'Atelier', to: { name: 'Atelier' } }, { label: props.calcul }]
			: [{ label: 'Atelier' }],
)
</script>

<template>
	<BureauShell :crumbs="crumbs" :active="id ? 'etudes' : 'atelier'">
		<div class="bureau-work"><AtelierView :etude="id" :calcul="calcul" :trace="trace" /></div>
	</BureauShell>
</template>
