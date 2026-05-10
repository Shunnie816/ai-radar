import Link from 'next/link'
import { getArticles, getDistinctSources } from '@/lib/firestore'
import { ArticleCard } from '@/components/ArticleCard'
import { Importance } from '@/lib/types'

export const revalidate = 3600

const IMPORTANCES: Importance[] = ['high', 'medium', 'low']

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; importance?: string }>
}) {
  const { source, importance } = await searchParams
  const [articles, sources] = await Promise.all([
    getArticles({ source, importance: importance as Importance | undefined }),
    getDistinctSources(),
  ])

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-4">記事一覧</h1>

      <div className="flex gap-2 flex-wrap mb-6">
        <Link
          href="/articles"
          className={`text-xs px-3 py-1 rounded-full border ${!source && !importance ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
        >
          すべて
        </Link>
        {IMPORTANCES.map((imp) => (
          <Link
            key={imp}
            href={`/articles?importance=${imp}`}
            className={`text-xs px-3 py-1 rounded-full border ${importance === imp ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
          >
            {imp}
          </Link>
        ))}
        {sources.map((s) => (
          <Link
            key={s}
            href={`/articles?source=${encodeURIComponent(s)}`}
            className={`text-xs px-3 py-1 rounded-full border ${source === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:border-gray-500'}`}
          >
            {s}
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-4">{articles.length}件</p>
      <div className="space-y-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </main>
  )
}
