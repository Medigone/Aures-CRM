/** Chargement et écritures d'un article, communs à l'aperçu et à la fiche. */
import { getArticle } from './api'
import type { ArticleDetail } from './articles'
import { useRecord } from './useRecord'

export function useArticle(id: () => string, changed: () => void = () => {}) {
	const { record, ...rest } = useRecord<ArticleDetail>(id, getArticle, changed)
	return { article: record, ...rest }
}
