'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth-context'
import { Article } from './types'
import { articleToFavorite, favoriteToArticle } from './favorites'

interface FavoritesContextValue {
  // お気に入り記事（新しく登録した順）
  favorites: Article[]
  loading: boolean
  isFavorite: (articleId: string) => boolean
  toggleFavorite: (article: Article) => Promise<void>
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // 購読結果を uid とセットで保持し、ログアウト・ユーザー切替時の
  // 古い結果は派生値の計算で無効化する（effect 内の同期 setState を避ける）
  const [snapshot, setSnapshot] = useState<{ uid: string; articles: Article[] } | null>(null)

  useEffect(() => {
    if (!user) return
    const favoritesQuery = query(
      collection(db, 'users', user.uid, 'favorites'),
      orderBy('favoritedAt', 'desc'),
    )
    return onSnapshot(favoritesQuery, (snap) => {
      setSnapshot({
        uid: user.uid,
        articles: snap.docs.map((d) => favoriteToArticle(d.id, d.data())),
      })
    })
  }, [user])

  const current = user && snapshot?.uid === user.uid ? snapshot.articles : null
  const favorites = current ?? []
  // ログイン中で最初の購読結果が届くまでの間だけ true
  const loading = user !== null && current === null

  const isFavorite = (articleId: string) => favorites.some((f) => f.id === articleId)

  const toggleFavorite = async (article: Article) => {
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'favorites', article.id)
    if (isFavorite(article.id)) {
      await deleteDoc(ref)
    } else {
      await setDoc(ref, { ...articleToFavorite(article), favoritedAt: serverTimestamp() })
    }
  }

  return (
    <FavoritesContext.Provider value={{ favorites, loading, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
