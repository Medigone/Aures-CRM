<script setup lang="ts">
import { computed } from 'vue'
import EtudeFeuille from './EtudeFeuille.vue'
import { percentLabel, referenceFormat, referenceReason, type AtelierReference, type AtelierReferences } from '@/lib/atelier'

/** Déjà fabriqué : l'imposition actuelle de l'article et celles d'articles proches, pour partir de l'existant. */
const props = defineProps<{ references: AtelierReferences; canStart: boolean; canSimulate: boolean }>()
const emit = defineEmits<{ start: [row: AtelierReference] }>()

const cards = computed(() => [...(props.references.actuelle ? [{ row: props.references.actuelle, kind: 'actuelle' as const }] : []), ...props.references.proches.map((row) => ({ row, kind: 'proche' as const }))])
const kindLabel = (row: AtelierReference, kind: 'actuelle' | 'proche') => (kind === 'proche' ? 'Article proche' : row.liee ? "Imposition de l'étude" : row.ideale ? "Idéale de l'article" : 'Déjà faite pour cet article')
const startLabel = computed(() => (props.canSimulate ? 'Essayer ce format' : 'Ajouter ce format'))
</script>

<template>
	<section class="card atelier-refs" aria-label="Impositions déjà fabriquées">
		<details :open="cards.length > 0">
			<summary>
				Déjà fabriqué
				<small>{{ cards.length ? `${cards.length} imposition${cards.length > 1 ? 's' : ''}` : 'Rien pour cet article ni pour un article proche' }}<template v-if="references.cotations"> · cotes {{ references.cotations.replace(/x/g, ' × ') }}</template></small>
			</summary>
			<p v-if="!cards.length" class="m-0 text-sm text-ink-gray-6">Un article est proche s'il a le même procédé et des cotes à 10 % près ; sans cotes, le même client et le même support.</p>
			<ul v-else class="atelier-refs-list">
				<li v-for="{ row, kind } in cards" :key="`${kind}-${row.name}`" class="atelier-ref" :data-kind="kind">
					<EtudeFeuille v-if="row.dessin" :dessin="row.dessin" class="atelier-ref-sheet" />
					<div v-else class="atelier-ref-blank" aria-hidden="true">{{ row.format || 'Format inconnu' }}</div>
					<div class="atelier-ref-body">
						<span class="atelier-ref-kind">{{ kindLabel(row, kind) }}</span>
						<b class="truncate" :title="row.designation">{{ row.designation }}</b>
						<small v-if="kind === 'proche'">{{ referenceReason(row) }}<template v-if="row.cotations"> · {{ row.cotations.replace(/x/g, ' × ') }}</template></small>
						<span class="tabular-nums">{{ row.format || '—' }} · {{ row.nbr_poses }} pose{{ row.nbr_poses > 1 ? 's' : '' }}<template v-if="row.n_col"> ({{ row.n_col }} × {{ row.n_rang }})</template><template v-if="row.taux_chutes != null"> · {{ percentLabel(row.taux_chutes) }} de chutes</template></span>
					</div>
					<div class="atelier-ref-actions">
						<a v-if="row.fichier" class="btn-ghost" :href="row.fichier.url" target="_blank" rel="noopener noreferrer">PDF</a>
						<button v-if="canStart" type="button" class="btn-secondary" :disabled="!referenceFormat(row)" :title="referenceFormat(row) ? undefined : 'Format de feuille inconnu'" @click="emit('start', row)">{{ startLabel }}</button>
					</div>
				</li>
			</ul>
		</details>
	</section>
</template>
