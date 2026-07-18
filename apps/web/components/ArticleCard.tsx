import Link from 'next/link'
import { Article } from '@/lib/types'
import { TagBadge } from './TagBadge'
import { FavoriteButton } from './FavoriteButton'

const importanceColor = {
  high: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  medium: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  low: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200',
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
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/articles/${article.id}`} className="font-medium text-gray-900 hover:text-indigo-600 leading-snug transition-colors">
          {article.title}
        </Link>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${importanceColor[article.importance]}`}>
            {article.importance}
          </span>
          <FavoriteButton article={article} />
        </div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2">{article.summary}</p>
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
