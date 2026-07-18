import { describe, it, expect } from 'vitest'
import { articleToFavorite, favoriteToArticle } from './favorites'
import { Article } from './types'

const article: Article = {
  id: 'article-1',
  title: '新モデル発表',
  url: 'https://example.com/article',
  source: 'TechCrunch',
  publishedAt: '2026-07-18T06:00:00Z',
  rawContent: '本文テキスト',
  summary: '要約テキスト',
  importance: 'high',
  tags: ['AI'],
  createdAt: '2026-07-18T06:30:00Z',
}

describe('articleToFavorite', () => {
  it('should keep every field needed to render the article card', () => {
    expect(articleToFavorite(article)).toEqual({
      title: '新モデル発表',
      url: 'https://example.com/article',
      source: 'TechCrunch',
      publishedAt: '2026-07-18T06:00:00Z',
      summary: '要約テキスト',
      importance: 'high',
      tags: ['AI'],
    })
  })

  it('should not store rawContent or id', () => {
    const favorite = articleToFavorite(article)

    expect(favorite).not.toHaveProperty('rawContent')
    expect(favorite).not.toHaveProperty('id')
  })
})

describe('favoriteToArticle', () => {
  it('should restore an article renderable by ArticleCard with the given id', () => {
    const restored = favoriteToArticle('article-1', articleToFavorite(article))

    expect(restored).toEqual({ ...article, rawContent: '', createdAt: '' })
  })

  it('should fall back to defaults for missing fields', () => {
    const restored = favoriteToArticle('article-1', {})

    expect(restored.title).toBe('')
    expect(restored.importance).toBe('low')
    expect(restored.tags).toEqual([])
  })
})
