import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getArticle } from '@/lib/firestore'
import { TagBadge } from '@/components/TagBadge'

export const revalidate = 3600

const importanceColor = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/articles" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block">
        ← 記事一覧に戻る
      </Link>

      <div className="flex items-start gap-2 mb-2">
        <h1 className="text-xl font-bold text-gray-900 leading-snug flex-1">{article.title}</h1>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full mt-1 ${importanceColor[article.importance]}`}>
          {article.importance}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 mb-6">
        <span>{article.source}</span>
        <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('ja-JP') : ''}</span>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          原文を読む →
        </a>
      </div>

      <div className="bg-gray-50 rounded-xl p-5 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI 要約</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{article.summary}</p>
      </div>

      {article.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {article.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}
    </main>
  )
}
