import Link from 'next/link'
import { Article } from '@/lib/types'
import { TagBadge } from './TagBadge'
import { FavoriteButton } from './FavoriteButton'

const importanceColor = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

export function ArticleCard({ article }: { article: Article }) {
  const date = formatDate(article.publishedAt)
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/articles/${article.id}`} className="font-medium text-gray-900 hover:text-blue-600 leading-snug">
          {article.title}
        </Link>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${importanceColor[article.importance]}`}>
            {article.importance}
          </span>
          <FavoriteButton article={article} />
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{article.summary}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">{article.source}</span>
        {date && <span className="text-xs text-gray-300">{date}</span>}
        {article.tags.map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
      </div>
    </div>
  )
}
