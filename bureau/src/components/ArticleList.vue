<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import StatusPill from '@shared/components/StatusPill.vue'
import AppToast from './AppToast.vue'
import ArticleDialog from './ArticleDialog.vue'
import DataList from './DataList.vue'
import FilterBuilder from './FilterBuilder.vue'
import TagCell from './TagCell.vue'
import { getArticleOptions, getArticles } from '@/lib/api'
import { ARTICLE_COLUMNS, ARTICLE_FILTER_FIELDS, ARTICLE_VIEWS, articleConditionLabel, articleFilterChoices, articleSigle, articleSortText, clientTone, DEFAULT_ARTICLE_COLUMNS, procedeLabel, procedeTone, TYPE_GENERAL, visibleArticleColumns, type ArticleOptions, type ArticleRow } from '@/lib/articles'
import { formatAmount } from '@/lib/clients'
import { formatDay } from '@/lib/display'
import { withDoctypeFields, type Condition } from '@/lib/filters'
import type { ArticlesState } from '@/lib/useArticles'

const props = defineProps<{ state: ArticlesState; selected?: string }>()
const emit = defineEmits<{ pick: [name?: string]; open: [name: string, tab?: string]; changed: [] }>()

const options = ref<ArticleOptions | null>(null)
const optionsError = ref('')
const dataList = ref<{ revealCreated: () => Promise<void> } | null>(null)
const labelOf = (condition: Condition) => articleConditionLabel(condition, options.value)
async function fetchAll(start: number, pageLength: number) {
	const state = props.state
	const response = await getArticles(state.view.value, state.conditions.value, state.search.value, { start, pageLength, sort: state.sort.value?.key, direction: state.sort.value?.dir })
	return { rows: response.articles as ArticleRow[], total: response.total }
}
function flagOf(row: ArticleRow) {
	if (row.compose) return 'Composé'
	if (row.sous_article) return 'Sous-article'
	return row.type === TYPE_GENERAL ? 'Article général' : ''
}

// Création : la liste reste en place, avec la nouvelle ligne surlignée et un lien vers sa fiche.
const creating = ref(false)
const created = ref<string | null>(null)
let createdTimer: ReturnType<typeof setTimeout> | null = null
function dismissCreated() {
	if (createdTimer) clearTimeout(createdTimer)
	created.value = null
}
async function onCreated(name: string) {
	const state = props.state
	dismissCreated()
	created.value = name
	createdTimer = setTimeout(dismissCreated, 8000)
	state.view.value = 'all'
	state.search.value = ''
	state.conditions.value = []
	await nextTick()
	await state.load()
	await state.reveal(name)
	await dataList.value?.revealCreated()
}
function openCreated() {
	const name = created.value
	dismissCreated()
	if (name) emit('open', name)
}

onMounted(async () => {
	try {
		options.value = await getArticleOptions()
	} catch (e) {
		optionsError.value = (e as Error).message
	}
})
onBeforeUnmount(() => {
	if (createdTimer) clearTimeout(createdTimer)
})
</script>

<template>
	<DataList
		ref="dataList"
		:state="state"
		:rows="state.articles.value"
		title="Articles"
		noun="article"
		search-label="Rechercher un article"
		search-placeholder="Désignation, code, réf. client, client"
		create-label="Nouvel article"
		:columns="ARTICLE_COLUMNS"
		:visible-of="visibleArticleColumns"
		:default-columns="DEFAULT_ARTICLE_COLUMNS"
		columns-key="bureau-articles-colonnes"
		:views="ARTICLE_VIEWS"
		:counts="state.response.value?.counts"
		default-sort-label="Ordre par désignation"
		:sort-text="articleSortText(state.sort.value)"
		:condition-label="labelOf"
		:fetch-all="fetchAll"
		:selected="selected"
		:created="created ?? undefined"
		:load-error="optionsError"
		bulk-doctype="Item"
		@pick="emit('pick', $event)"
		@open="emit('open', $event)"
		@changed="emit('changed')"
		@create="creating = true"
	>
		<template #filters>
			<FilterBuilder v-model="state.conditions.value" :fields="withDoctypeFields(ARTICLE_FILTER_FIELDS, options?.filter_fields)" first-field="procede" :choices-of="(field) => articleFilterChoices(field, options)" />
		</template>

		<template #cells="{ row, columns }">
			<template v-for="column in columns" :key="column.key">
				<span v-if="column.key === 'designation'" class="flex min-w-0 items-center gap-2" :title="row.designation">
					<span class="list-tile flex-none" :class="procedeTone(row.procede)" aria-hidden="true">{{ articleSigle(row) }}</span>
					<span class="list-client truncate">{{ row.designation }}</span>
					<span v-if="flagOf(row)" class="list-tag list-tag-small flex-none" :class="flagOf(row) === 'Article général' ? 'tone-gray' : 'tone-amber'">{{ flagOf(row) }}</span>
				</span>
				<span v-else-if="column.key === 'name'" class="tabular-nums" :title="row.name">{{ row.name }}</span>
				<span v-else-if="column.key === 'client_label'" class="flex min-w-0 items-center gap-1.5" :title="row.client_label || undefined">
					<span v-if="row.client_label" class="list-mono flex-none" :class="clientTone(row.client_label)" aria-hidden="true">{{ row.client_label.charAt(0) }}</span>
					<span class="truncate">{{ row.client_label || '—' }}</span>
				</span>
				<span v-else-if="column.key === 'procede'"><span v-if="row.procede" class="list-tag" :class="procedeTone(row.procede)">{{ procedeLabel(row.procede) }}</span><template v-else>—</template></span>
				<span v-else-if="column.key === 'support'" :title="row.support || undefined">{{ row.support || '—' }}</span>
				<span v-else-if="column.key === 'format'" class="tabular-nums">{{ row.format || '—' }}</span>
				<span v-else-if="column.key === 'bat'"><StatusPill v-if="row.bat" :status="row.bat" /><span v-else class="text-ink-gray-6">Aucun</span></span>
				<span v-else-if="column.key === 'commande'" :class="row.commande ? 'tabular-nums' : 'text-ink-gray-6'">{{ formatDay(row.commande) || '—' }}</span>
				<TagCell v-else-if="column.key === 'tags'" :tags="row.tags" :max="1" />
				<span v-else-if="column.key === 'reference'" class="tabular-nums">{{ row.reference || '—' }}</span>
				<span v-else-if="column.key === 'commercial'" :title="row.commercial || undefined">{{ row.commercial || '—' }}</span>
				<span v-else-if="column.key === 'groupe'">{{ row.groupe || '—' }}</span>
				<span v-else-if="column.key === 'couleurs'">{{ row.couleurs || '—' }}</span>
				<span v-else-if="column.key === 'consommation'" class="list-col-end tabular-nums" :class="!row.consommation && 'text-ink-gray-6'">{{ row.consommation ? formatAmount(row.consommation) : '—' }}</span>
			</template>
		</template>

		<template #rowMenu="{ row }">
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name)">Ouvrir la fiche</button>
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name, 'prepresse')">Voir la prépresse</button>
			<button type="button" class="app-menu-item" role="menuitem" @click="emit('open', row.name, 'affaires')">Voir les affaires</button>
		</template>

		<template #drawer><slot name="drawer"></slot></template>

		<ArticleDialog v-if="creating" @close="creating = false" @created="onCreated" />
		<AppToast :message="created ? 'Article créé.' : ''" :duration="0" @close="created = null">
			<button type="button" class="app-toast-action" @click="openCreated">Ouvrir la fiche</button>
		</AppToast>
	</DataList>
</template>
