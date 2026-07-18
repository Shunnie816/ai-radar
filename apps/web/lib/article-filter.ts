import { Importance } from './types'

// ArticleList の絞り込み仕様（テスト: article-filter.test.ts）:
// source / importance は完全一致、query はタイトル・要約への部分一致
// （大文字小文字を無視）。指定された条件はすべて AND で適用する

export interface ArticleFilterCriteria {
  query: string
  source: string | null
  importance: Importance | null
}

interface FilterableArticle {
  title: string
  summary: string
  source: string
  importance: Importance
}

export function filterArticles<T extends FilterableArticle>(
  articles: T[],
  { query, source, importance }: ArticleFilterCriteria,
): T[] {
  return articles.filter((a) => {
    if (source && a.source !== source) return false
    if (importance && a.importance !== importance) return false
    if (query) {
      const q = query.toLowerCase()
      return a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
    }
    return true
  })
}

// フィルタチップに表示するソース一覧（重複除去・空文字除外・昇順ソート）
export function extractSources(articles: { source: string }[]): string[] {
  return [...new Set(articles.map((a) => a.source).filter(Boolean))].sort()
}
