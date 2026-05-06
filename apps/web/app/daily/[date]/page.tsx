import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDailySummary, getArticlesByIds } from '@/lib/firestore'
import { ArticleCard } from '@/components/ArticleCard'

export const revalidate = 3600

export default async function DailyPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const summary = await getDailySummary(date)
  if (!summary) notFound()

  const articles = await getArticlesByIds(summary.articleIds)

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">
        ← ホームに戻る
      </Link>

      <h1 className="text-xl font-bold text-gray-900 mb-1">{summary.date} のトレンド</h1>
      <p className="text-xs text-gray-400 mb-4">{new Set(summary.articleIds).size}件</p>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6">
        <p className="text-sm text-indigo-800 leading-relaxed mb-3">{summary.summary}</p>
        {summary.keyTopics.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {summary.keyTopics.map((topic) => (
              <span key={topic} className="text-xs bg-white text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full">
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">記事一覧</h2>
      <div className="space-y-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </main>
  )
}
