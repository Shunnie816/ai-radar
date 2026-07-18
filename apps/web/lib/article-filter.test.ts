import { describe, it, expect } from 'vitest'
import { extractSources, filterArticles, type ArticleFilterCriteria } from './article-filter'
import { Importance } from './types'

const article = (over: Partial<{ title: string; summary: string; source: string; importance: Importance }> = {}) => ({
  title: '',
  summary: '',
  source: 'Hacker News',
  importance: 'medium' as Importance,
  ...over,
})

const noFilter: ArticleFilterCriteria = { query: '', source: null, importance: null }

describe('filterArticles', () => {
  it('should return all articles when no filter is active', () => {
    const articles = [article(), article()]

    expect(filterArticles(articles, noFilter)).toEqual(articles)
  })

  it('should keep only articles from the selected source', () => {
    const hn = article({ source: 'Hacker News' })
    const zenn = article({ source: 'Zenn AI' })

    const result = filterArticles([hn, zenn], { ...noFilter, source: 'Zenn AI' })

    expect(result).toEqual([zenn])
  })

  it('should keep only articles with the selected importance', () => {
    const high = article({ importance: 'high' })
    const low = article({ importance: 'low' })

    const result = filterArticles([high, low], { ...noFilter, importance: 'high' })

    expect(result).toEqual([high])
  })

  it('should match the query against the title case-insensitively', () => {
    const matched = article({ title: 'Claude API Update' })
    const unmatched = article({ title: 'Firestore 入門' })

    const result = filterArticles([matched, unmatched], { ...noFilter, query: 'claude' })

    expect(result).toEqual([matched])
  })

  it('should match the query against the summary as well', () => {
    const matched = article({ summary: '新モデルが発表された' })

    const result = filterArticles([matched, article()], { ...noFilter, query: '新モデル' })

    expect(result).toEqual([matched])
  })

  it('should apply source and query as AND conditions', () => {
    const target = article({ source: 'Zenn AI', title: 'RAG構成の実践' })
    const sameSourceOnly = article({ source: 'Zenn AI', title: '別の話題' })
    const sameQueryOnly = article({ source: 'Hacker News', title: 'RAG構成の実践' })

    const result = filterArticles([target, sameSourceOnly, sameQueryOnly], {
      ...noFilter,
      source: 'Zenn AI',
      query: 'rag',
    })

    expect(result).toEqual([target])
  })

  it('should return an empty array when nothing matches the query', () => {
    const result = filterArticles([article({ title: 'AI News' })], { ...noFilter, query: '存在しない語' })

    expect(result).toEqual([])
  })
})

describe('extractSources', () => {
  it('should return unique sources sorted alphabetically', () => {
    const articles = [
      { source: 'Zenn AI' },
      { source: 'Hacker News' },
      { source: 'Zenn AI' },
    ]

    expect(extractSources(articles)).toEqual(['Hacker News', 'Zenn AI'])
  })

  it('should exclude articles with an empty source', () => {
    expect(extractSources([{ source: '' }, { source: 'Wired' }])).toEqual(['Wired'])
  })
})
