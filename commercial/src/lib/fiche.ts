import type { Article } from '@/types'
import type { FicheDoc } from '@shared/fiche'

export * from '@shared/fiche'

/** Document évalué : l'identité de l'article (procédé, type…) et les valeurs de sa fiche. */
export function ficheDoc(article: Pick<Article, 'designation' | 'client' | 'procede' | 'compose' | 'sous_article'>, fiche: Record<string, any> = {}): FicheDoc {
	return {
		custom_type_article: 'Client',
		custom_client: article.client,
		custom_procédé: article.procede,
		custom_article_compose: article.compose || 0,
		custom_sous_article: article.sous_article || 0,
		item_code: article.designation,
		item_name: article.designation,
		...fiche,
	}
}
