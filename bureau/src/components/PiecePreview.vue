<script setup lang="ts">
import { computed } from 'vue'
import { fileName, fileUrl } from '@shared/text'
import EtudeFeuille from './EtudeFeuille.vue'
import TracePreview from './TracePreview.vue'
import { isImageFile, isPdfFile } from '@/lib/articles'
import type { SheetDrawing } from '@/lib/etudePieces'

/**
 * Aperçu d'un tracé ou d'une imposition dans un cadre de taille fixe, pour que deux cartes voisines restent alignées.
 * Le dessin de la feuille passe avant le fichier ; un PDF de tracé se rend en image, une image s'affiche telle quelle.
 * `thumb` : vignette sans texte, pour l'onglet Aperçu.
 */
const props = defineProps<{ kind: 'trace' | 'imposition'; name: string; file?: string | null; dessin?: SheetDrawing | null; thumb?: boolean; empty?: string }>()

const url = computed(() => (props.file ? fileUrl(props.file) || props.file : ''))
const label = computed(() => (props.file ? fileName(props.file) : ''))
const mode = computed(() => {
	if (props.dessin) return 'dessin'
	if (!props.file) return 'none'
	if (isImageFile(props.file)) return 'image'
	if (props.kind === 'trace' && isPdfFile(props.file)) return 'pdf'
	return 'file'
})
const what = computed(() => (props.kind === 'trace' ? `du tracé ${props.name}` : `de l'imposition ${props.name}`))
</script>

<template>
	<div v-if="!(thumb && mode !== 'dessin' && mode !== 'image' && mode !== 'pdf')" class="piece-frame" :data-thumb="thumb || undefined">
		<EtudeFeuille v-if="mode === 'dessin' && dessin" :dessin="dessin" />
		<a v-else-if="mode === 'image'" class="piece-frame-link" :href="url" target="_blank" rel="noopener noreferrer" :title="`Ouvrir ${label}`">
			<img :src="url" :alt="`${kind === 'trace' ? 'Image' : 'Fichier joint'} ${what}`" loading="lazy" />
		</a>
		<TracePreview v-else-if="mode === 'pdf'" :name="name" :url="url" :label="label" />
		<p v-else-if="mode === 'file'" class="piece-frame-state">
			<template v-if="kind === 'imposition'">Le dessin de la feuille n'est pas disponible. Le fichier joint fait foi.</template>
			<template v-else>Ce fichier ne s'affiche pas en aperçu.</template>
			<a class="btn-secondary" :href="url" target="_blank" rel="noopener noreferrer">Ouvrir le fichier</a>
		</p>
		<p v-else class="piece-frame-state">{{ empty || 'Aucun fichier joint.' }}</p>
	</div>
</template>
