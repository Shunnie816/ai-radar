'use client'

import { useAuth } from '@/lib/auth-context'
import { useFavorites } from '@/lib/favorites-context'
import { Article } from '@/lib/types'

// お気に入りの登録・解除ボタン（ログイン時のみ表示）
export function FavoriteButton({ article }: { article: Article }) {
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()

  if (!user) return null

  const active = isFavorite(article.id)

  return (
    <button
      onClick={() => {
        toggleFavorite(article).catch((e) => console.error('favorite toggle failed', e))
      }}
      aria-label={active ? 'お気に入りを解除' : 'お気に入りに追加'}
      aria-pressed={active}
      className={`shrink-0 transition-colors ${
        active ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 hover:text-amber-400'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>
    </button>
  )
}
