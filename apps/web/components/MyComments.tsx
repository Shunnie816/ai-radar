'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { commentFromDoc } from '@/lib/comments'

interface MyCommentItem {
  id: string
  articleId: string
  articleTitle: string
  text: string
  createdAt: Date | null
}

// 自分が投稿したコメントの一覧（新しい順）。コレクショングループクエリで
// 全記事横断で取得し、記事タイトルは articles から都度解決する
export function MyComments() {
  const { user } = useAuth()
  const [items, setItems] = useState<MyCommentItem[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      const commentsQuery = query(
        collectionGroup(db, 'comments'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(commentsQuery)
      const rows = snap.docs.map((d) => ({
        comment: commentFromDoc(d.id, d.data()),
        articleId: d.ref.parent.parent?.id ?? '',
      }))
      const articleIds = [...new Set(rows.map((r) => r.articleId).filter(Boolean))]
      const titles = new Map<string, string>()
      await Promise.all(
        articleIds.map(async (id) => {
          const article = await getDoc(doc(db, 'articles', id))
          titles.set(id, article.exists() ? ((article.data().title as string) ?? '') : '')
        }),
      )
      if (cancelled) return
      setItems(
        rows.map(({ comment, articleId }) => ({
          id: comment.id,
          articleId,
          articleTitle: titles.get(articleId) || '(記事が見つかりません)',
          text: comment.text,
          createdAt: comment.createdAt,
        })),
      )
    }
    load().catch((err) => {
      console.error('my comments fetch failed', err)
      if (!cancelled) setLoadFailed(true)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (loadFailed) {
    return <p className="text-sm text-gray-400 text-center py-12">コメントを読み込めませんでした</p>
  }
  if (items === null) {
    return <p className="text-sm text-gray-400 text-center py-12">読み込み中...</p>
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-12">
        コメントはまだありません。記事詳細ページから投稿できます。
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
          <Link
            href={`/articles/${item.articleId}`}
            className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors"
          >
            {item.articleTitle}
          </Link>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mt-1">
            {item.text}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {item.createdAt?.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
          </p>
        </li>
      ))}
    </ul>
  )
}
