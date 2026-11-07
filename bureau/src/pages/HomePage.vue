<script setup lang="ts">
import { computed } from 'vue'
import { activePoste } from '@/lib/postes'
import AccueilEtudePage from './AccueilEtudePage.vue'
import AccueilPage from './AccueilPage.vue'

/** Même adresse pour tous : chaque poste a son accueil. */
const isEtude = computed(() => activePoste().key === 'etude')
</script>

<template>
	<AccueilEtudePage v-if="isEtude" />
	<AccueilPage v-else />
</template>
