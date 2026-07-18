import { Article, Importance } from './types'

// users/{uid}/favorites/{articleId} に保存する記事スナップショット。
// 記事は保存後に変化しないため非正規化しても整合性の問題はなく、
// お気に入り一覧を favorites への1クエリだけで描画できる。
// rawContent はカード表示に不要なため保存しない
export interface FavoriteData {
  title: string
  url: string
  source: string
  publishedAt: string
  summary: string
  importance: Importance
  tags: string[]
}

export function articleToFavorite(article: Article): FavoriteData {
  return {
    title: article.title,
    url: article.url,
    source: article.source,
    publishedAt: article.publishedAt,
    summary: article.summary,
    importance: article.importance,
    tags: article.tags,
  }
}

// Firestore から読み出した favorite ドキュメントを ArticleCard で使える形に戻す。
// 過去に保存された古い形式のドキュメントでも壊れないよう欠落フィールドは既定値で補う
export function favoriteToArticle(id: string, data: unknown): Article {
  const d = data as Partial<FavoriteData>
  return {
    id,
    title: d.title ?? '',
    url: d.url ?? '',
    source: d.source ?? '',
    publishedAt: d.publishedAt ?? '',
    rawContent: '',
    summary: d.summary ?? '',
    importance: d.importance ?? 'low',
    tags: d.tags ?? [],
    createdAt: '',
  }
}
