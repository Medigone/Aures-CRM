<script setup lang="ts">
import { gapRoute } from '@/lib/accueil'
import type { EtudeWatch } from '@/lib/accueilEtude'

/** Ce qui mérite un regard : chaque ligne ouvre la liste déjà filtrée, sur les études ouvertes. */
defineProps<{ rows: EtudeWatch[] }>()

const percent = (row: EtudeWatch) => `${row.total ? Math.round((row.count * 100) / row.total) : 0}%`
const route = (row: EtudeWatch) => gapRoute('Etudes', { view: row.view, conditions: row.conditions ?? undefined })
const linked = (row: EtudeWatch) => Boolean(row.view || row.conditions?.length)
</script>

<template>
	<section class="card accueil-data">
		<div class="accueil-card-head">
			<h2 class="accueil-title">À surveiller</h2>
		</div>
		<component :is="linked(row) ? 'RouterLink' : 'div'" v-for="row in rows" :key="row.key" class="accueil-gap" :class="row.total === null && 'accueil-gap-doc'" :to="linked(row) ? route(row) : undefined">
			<span class="accueil-gap-label">{{ row.label }}</span>
			<span v-if="row.total !== null" class="accueil-track accueil-track-thin" aria-hidden="true"><i :style="{ width: percent(row) }"></i></span>
			<b class="accueil-gap-count tabular-nums" :class="row.alert && 'is-late'">{{ row.total !== null ? `${row.count} / ${row.total}` : row.count }}</b>
		</component>
	</section>
</template>
