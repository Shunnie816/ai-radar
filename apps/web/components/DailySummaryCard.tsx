import Link from 'next/link'
import { DailySummary } from '@/lib/types'

export function DailySummaryCard({ summary }: { summary: DailySummary }) {
  return (
    <Link href={`/daily/${summary.date}`} className="block border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-gray-900">{summary.date}</span>
        <span className="text-xs text-gray-400">{summary.articleCount}件</span>
      </div>
      <p className="text-sm text-gray-600 line-clamp-3">{summary.summary}</p>
      {summary.keyTopics.length > 0 && (
        <div className="flex gap-1 flex-wrap mt-3">
          {summary.keyTopics.map((topic) => (
            <span key={topic} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
              {topic}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
