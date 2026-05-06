import Link from 'next/link'
import { getDailySummaries, getArticles } from '@/lib/firestore'
import { DailySummaryCard } from '@/components/DailySummaryCard'
import { ArticleCard } from '@/components/ArticleCard'

export const revalidate = 3600

export default async function HomePage() {
  const [summaries, articles] = await Promise.all([
    getDailySummaries(7),
    getArticles({ importance: 'high', limitCount: 3 }),
  ])
  const latest = summaries[0] ?? null

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">AI Radar</h1>

      {latest && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">最新トレンド</h2>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-indigo-900">{latest.date}</span>
              <span className="text-xs text-indigo-400">{new Set(latest.articleIds).size}件</span>
            </div>
            <p className="text-sm text-indigo-800 leading-relaxed mb-3">{latest.summary}</p>
            {latest.keyTopics.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {latest.keyTopics.map((topic) => (
                  <span key={topic} className="text-xs bg-white text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {topic}
                  </span>
                ))}
              </div>
            )}
            <Link href={`/daily/${latest.date}`} className="inline-block mt-3 text-xs text-indigo-600 hover:underline">
              記事一覧を見る →
            </Link>
          </div>
        </section>
      )}

      {articles.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">重要記事</h2>
          <div className="space-y-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
          <Link href="/articles" className="inline-block mt-3 text-sm text-blue-600 hover:underline">
            すべての記事を見る →
          </Link>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">過去7日間</h2>
        <div className="space-y-2">
          {summaries.map((s) => (
            <DailySummaryCard key={s.id} summary={s} />
          ))}
        </div>
      </section>
    </main>
  )
}
