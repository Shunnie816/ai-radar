'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useFavorites } from '@/lib/favorites-context'
import { ArticleCard } from '@/components/ArticleCard'

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth()
  const { favorites, loading } = useFavorites()

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">お気に入り</h1>

      {authLoading || loading ? (
        <p className="text-sm text-gray-400 text-center py-12">読み込み中...</p>
      ) : !user ? (
        <p className="text-sm text-gray-500 text-center py-12">
          お気に入りを使うには、ヘッダーからログインしてください。
        </p>
      ) : favorites.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          お気に入りはまだありません。
          <Link href="/articles" className="text-blue-500 hover:underline ml-1">
            記事一覧
          </Link>
          の ★ から登録できます。
        </p>
      ) : (
        <div className="space-y-3">
          {favorites.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </main>
  )
}
