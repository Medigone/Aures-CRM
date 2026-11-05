/** État de la liste des articles. */
import { computed } from 'vue'
import { getArticles } from './api'
import type { ArticlesResponse, ArticleView } from './articles'
import { useServerList } from './useServerList'

export function useArticles(initial: { view?: ArticleView; page?: number } = {}) {
	const list = useServerList<ArticlesResponse, ArticleView>({ view: initial.view ?? 'all', page: initial.page, pageSizeKey: 'bureau-articles-par-page', fetch: getArticles })
	const articles = computed(() => list.response.value?.articles ?? [])
	return { ...list, articles }
}

export type ArticlesState = ReturnType<typeof useArticles>
