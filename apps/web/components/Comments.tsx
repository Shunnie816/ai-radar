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
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import {
  Comment,
  MAX_COMMENT_LENGTH,
  commentFromDoc,
  normalizeCommentText,
} from '@/lib/comments'

// 記事詳細ページのコメント欄。一覧は誰でも閲覧でき、投稿・編集・削除はログイン時のみ
export function Comments({ articleId }: { articleId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

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

  const startEdit = (c: Comment) => {
    setEditingId(c.id)
    setEditDraft(c.text)
  }

  const handleSaveEdit = async (commentId: string) => {
    const text = normalizeCommentText(editDraft)
    if (!text) return
    try {
      await updateDoc(doc(db, 'articles', articleId, 'comments', commentId), {
        text,
        updatedAt: serverTimestamp(),
      })
      setEditingId(null)
    } catch (err) {
      console.error('comment update failed', err)
    }
  }

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return
    deleteDoc(doc(db, 'articles', articleId, 'comments', deleteTargetId)).catch((err) =>
      console.error('comment delete failed', err),
    )
    setDeleteTargetId(null)
  }

  const overLimit = draft.length > MAX_COMMENT_LENGTH
  const editOverLimit = editDraft.length > MAX_COMMENT_LENGTH

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
                  {c.updatedAt && ' (編集済み)'}
                </span>
                {user?.uid === c.uid && editingId !== c.id && (
                  <span className="ml-auto flex items-center gap-3">
                    <button
                      onClick={() => startEdit(c)}
                      className="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(c.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      削除
                    </button>
                  </span>
                )}
              </div>
              {editingId === c.id ? (
                <div>
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs ${editOverLimit ? 'text-red-500' : 'text-gray-400'}`}>
                      {editDraft.length}/{MAX_COMMENT_LENGTH}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm px-4 py-1.5 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        disabled={editOverLimit || normalizeCommentText(editDraft) === null}
                        className="text-sm px-4 py-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:bg-gray-200 disabled:text-gray-400"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.text}</p>
              )}
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

      {deleteTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="コメントの削除確認"
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-gray-700 mb-6">このコメントを削除しますか？</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="text-sm px-4 py-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmDelete}
                className="text-sm px-4 py-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
