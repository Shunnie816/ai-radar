'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useProfile } from '@/lib/profile-context'
import { useFavorites } from '@/lib/favorites-context'
import { ProfileForm } from '@/components/ProfileForm'
import { MyComments } from '@/components/MyComments'
import { ArticleCard } from '@/components/ArticleCard'

type Tab = 'favorites' | 'comments'

// プロフィールページ（本人専用）。他ユーザーへの公開ページは設けない
export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { favorites, loading: favoritesLoading } = useFavorites()
  const [tab, setTab] = useState<Tab>('favorites')

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-6">プロフィール</h1>

      {authLoading || (user && !profile) ? (
        <p className="text-sm text-gray-400 text-center py-12">読み込み中...</p>
      ) : !user || !profile ? (
        <p className="text-sm text-gray-500 text-center py-12">
          プロフィールを使うには、ヘッダーからログインしてください。
        </p>
      ) : (
        <>
          <ProfileForm
            key={user.uid}
            initial={{
              displayName: profile.displayName || user.displayName || '',
              avatarEmoji: profile.avatarEmoji,
            }}
            googlePhotoURL={profile.photoURL || user.photoURL || ''}
            onSave={updateProfile}
          />

          <div className="flex gap-1 mt-8 mb-4 border-b border-gray-200" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'favorites'}
              onClick={() => setTab('favorites')}
              className={`text-sm px-4 py-2 -mb-px border-b-2 transition-colors ${
                tab === 'favorites'
                  ? 'border-blue-500 text-gray-900 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              お気に入り
            </button>
            <button
              role="tab"
              aria-selected={tab === 'comments'}
              onClick={() => setTab('comments')}
              className={`text-sm px-4 py-2 -mb-px border-b-2 transition-colors ${
                tab === 'comments'
                  ? 'border-blue-500 text-gray-900 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              コメント
            </button>
          </div>

          {tab === 'favorites' ? (
            favoritesLoading ? (
              <p className="text-sm text-gray-400 text-center py-12">読み込み中...</p>
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
            )
          ) : (
            <MyComments />
          )}
        </>
      )}
    </main>
  )
}
