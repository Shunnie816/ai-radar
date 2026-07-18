'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import {
  Comment,
  MAX_COMMENT_LENGTH,
  commentFromDoc,
  normalizeCommentText,
} from '@/lib/comments'

// 記事詳細ページのコメント欄。一覧は誰でも閲覧でき、投稿・削除はログイン時のみ
export function Comments({ articleId }: { articleId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const commentsQuery = query(
      collection(db, 'articles', articleId, 'comments'),
      orderBy('createdAt', 'asc'),
    )
    return onSnapshot(
      commentsQuery,
      (snap) => {
        // estimate: 投稿直後のローカル反映時も createdAt を仮値で埋めて表示順を保つ
        setComments(
          snap.docs.map((d) => commentFromDoc(d.id, d.data({ serverTimestamps: 'estimate' }))),
        )
      },
      (err) => {
        console.error('comments subscription failed', err)
        setLoadFailed(true)
      },
    )
  }, [articleId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const text = normalizeCommentText(draft)
    if (!text) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'articles', articleId, 'comments'), {
        uid: user.uid,
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        text,
        createdAt: serverTimestamp(),
      })
      setDraft('')
    } catch (err) {
      console.error('comment post failed', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (commentId: string) => {
    if (!window.confirm('このコメントを削除しますか？')) return
    deleteDoc(doc(db, 'articles', articleId, 'comments', commentId)).catch((err) =>
      console.error('comment delete failed', err),
    )
  }

  const overLimit = draft.length > MAX_COMMENT_LENGTH

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        コメント{comments !== null && comments.length > 0 && ` (${comments.length})`}
      </h2>

      {loadFailed ? (
        <p className="text-sm text-gray-400">コメントを読み込めませんでした</p>
      ) : comments === null ? (
        <p className="text-sm text-gray-400">読み込み中...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400">まだコメントはありません</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                {c.photoURL && (
                  <Image src={c.photoURL} alt="" width={20} height={20} className="rounded-full" />
                )}
                <span className="text-xs font-medium text-gray-700">{c.displayName}</span>
                <span className="text-xs text-gray-400">
                  {c.createdAt?.toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                {user?.uid === c.uid && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    削除
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="mt-6">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="コメントを書く"
            rows={3}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
              {draft.length}/{MAX_COMMENT_LENGTH}
            </span>
            <button
              type="submit"
              disabled={submitting || overLimit || normalizeCommentText(draft) === null}
              className="text-sm px-4 py-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:bg-gray-200 disabled:text-gray-400"
            >
              投稿
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-6 text-sm text-gray-400">コメントを投稿するにはログインしてください</p>
      )}
    </section>
  )
}
