import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getArticle } from '@/lib/firestore'
import { TagBadge } from '@/components/TagBadge'
import { FavoriteButton } from '@/components/FavoriteButton'
import { Comments } from '@/components/Comments'

export const revalidate = 3600

const importanceColor = {
  high: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  medium: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  low: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) notFound()

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/articles" className="text-sm text-gray-400 hover:text-gray-600 mb-6 inline-block transition-colors">
        ← 記事一覧に戻る
      </Link>

      <div className="flex items-start gap-2 mb-2">
        <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-snug flex-1">{article.title}</h1>
        <div className="shrink-0 flex items-center gap-2 mt-1">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${importanceColor[article.importance]}`}>
            {article.importance}
          </span>
          <FavoriteButton article={article} />
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400 mb-6">
        <span>{article.source}</span>
        <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('ja-JP') : ''}</span>
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
          原文を読む →
        </a>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
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

      <Comments articleId={article.id} />
    </main>
  )
}
