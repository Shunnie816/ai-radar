import Link from 'next/link'
import { Article } from '@/lib/types'
import { TagBadge } from './TagBadge'

const importanceColor = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-600',
}

export function ArticleCard({ article }: { article: Article }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/articles/${article.id}`} className="font-medium text-gray-900 hover:text-blue-600 leading-snug">
          {article.title}
        </Link>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${importanceColor[article.importance]}`}>
          {article.importance}
        </span>
      </div>
      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{article.summary}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">{article.source}</span>
        {article.tags.map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
      </div>
    </div>
  )
}
