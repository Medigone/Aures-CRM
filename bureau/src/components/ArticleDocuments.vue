<script setup lang="ts">
import { computed } from 'vue'
import MoreMenu from '@shared/components/MoreMenu.vue'
import ListState from '@shared/components/ListState.vue'
import { fileExtension, formatFileSize, fileUrl } from '@shared/text'
import { removeArticleFile, setArticleFile } from '@/lib/api'
import { isImageFile, ROLE_LABELS, type ArticleDetail, type ArticleDocument } from '@/lib/articles'
import { formatDay } from '@/lib/display'

/** Tous les fichiers de l'article. Le menu d'une ligne dit à quoi le fichier sert, sans l'envoyer une seconde fois. */
const props = defineProps<{ article: ArticleDetail; busy: boolean; perform: (action: () => Promise<ArticleDetail>) => Promise<boolean> }>()

const PIECES = ['image', 'fiche_technique', 'trace_decoupe'] as const
const documents = computed(() => props.article.documents)
function usable(row: ArticleDocument) {
	return PIECES.filter((piece) => !row.roles.includes(piece) && (piece !== 'image' || isImageFile(row.file_name)))
}
function use(row: ArticleDocument, piece: string) {
	props.perform(() => setArticleFile(props.article, piece, row.file_url))
}
function remove(row: ArticleDocument) {
	const used = row.roles.length ? ` Il sert de ${row.roles.map((role) => ROLE_LABELS[role]).join(' et de ')}.` : ''
	if (window.confirm(`Retirer le fichier « ${row.file_name} » de cet article ?${used}`)) props.perform(() => removeArticleFile(props.article, row.file_url))
}
</script>

<template>
	<section class="card ref-card" aria-label="Fichiers de l'article">
		<h3>Fichiers de l'article</h3>
		<ListState v-if="!documents.length" dieline title="Aucun fichier" text="Les fichiers joints à l'article apparaissent ici." />
		<ul v-else class="upload-list">
			<li v-for="row in documents" :key="row.file_url" class="upload-item">
				<span class="upload-ext" aria-hidden="true">{{ fileExtension(row.file_name) }}</span>
				<span class="min-w-0">
					<a class="upload-name ref-link" :href="fileUrl(row.file_url) || undefined" target="_blank" rel="noopener noreferrer" :title="row.file_name">{{ row.file_name }}</a>
					<span class="upload-meta">{{ [formatFileSize(row.file_size), row.owner_name, formatDay(row.creation)].filter(Boolean).join(' · ') }}</span>
					<span v-if="row.roles.length" class="tag-row mt-1"><span v-for="role in row.roles" :key="role" class="tag-pill">{{ ROLE_LABELS[role] }}</span></span>
				</span>
				<MoreMenu v-if="article.can_edit">
					<button v-for="piece in usable(row)" :key="piece" type="button" class="app-menu-item" role="menuitem" :disabled="busy" @click="use(row, piece)">Utiliser comme {{ ROLE_LABELS[piece] === 'BAT' ? 'BAT' : ROLE_LABELS[piece].toLowerCase() }}</button>
					<a class="app-menu-item" role="menuitem" :href="fileUrl(row.file_url) || undefined" download>Télécharger</a>
					<div class="app-menu-sep"></div>
					<button type="button" class="app-menu-item text-tone-red" role="menuitem" :disabled="busy" @click="remove(row)">Retirer le fichier</button>
				</MoreMenu>
			</li>
		</ul>
	</section>
</template>
