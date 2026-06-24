'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Article, Importance } from '@/lib/types'
import { ArticleCard } from './ArticleCard'

const IMPORTANCES: Importance[] = ['high', 'medium', 'low']

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('fetch failed')
    return r.json() as Promise<Article[]>
  })

const ArticleSkeleton = () => (
  <div className="border border-gray-200 rounded-lg p-4 animate-pulse">
    <div className="flex justify-between gap-2 mb-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-100 rounded w-12 shrink-0" />
    </div>
    <div className="h-3 bg-gray-100 rounded w-full mb-2" />
    <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
    <div className="h-3 bg-gray-100 rounded w-1/4" />
  </div>
)

export function ArticleList() {
  const [query, setQuery] = useState('')
  const [selectedSource, setSelectedSource] = useState<string | null>(null)
  const [selectedImportance, setSelectedImportance] = useState<Importance | null>(null)

  const { data, error, isLoading } = useSWR<Article[]>('/api/articles?limit=500', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5 * 60 * 1000,
  })

  const sources = useMemo(
    () => [...new Set((data ?? []).map((a) => a.source).filter(Boolean))].sort(),
    [data],
  )

  const articles = useMemo(() => {
    const items = data ?? []
    return items.filter((a) => {
      if (selectedSource && a.source !== selectedSource) return false
      if (selectedImportance && a.importance !== selectedImportance) return false
      if (query) {
        const q = query.toLowerCase()
        return a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
      }
      return true
    })
  }, [data, query, selectedSource, selectedImportance])

  const isFiltered = !selectedSource && !selectedImportance

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="タイトル・要約で検索..."
        aria-label="記事を検索"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => { setSelectedSource(null); setSelectedImportance(null) }}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            isFiltered
              ? 'bg-gray-900 text-white border-gray-900'
              : 'border-gray-300 text-gray-600 hover:border-gray-500'
          }`}
        >
          すべて
        </button>
        {IMPORTANCES.map((imp) => (
          <button
            key={imp}
            onClick={() => setSelectedImportance(selectedImportance === imp ? null : imp)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              selectedImportance === imp
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            {imp}
          </button>
        ))}
        {sources.map((s) => (
          <button
            key={s}
            onClick={() => setSelectedSource(selectedSource === s ? null : s)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              selectedSource === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500 text-center py-8">
          記事の取得に失敗しました。しばらくしてから再読み込みしてください。
        </p>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ArticleSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <p className="text-xs text-gray-400 mb-4">{articles.length}件</p>
          {articles.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-12">
              {query ? `「${query}」に一致する記事が見つかりませんでした。` : '記事がありません。'}
            </p>
          ) : (
            <div className="space-y-3">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
