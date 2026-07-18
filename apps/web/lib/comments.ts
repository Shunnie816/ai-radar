// 記事コメント（articles/{id}/comments/{commentId}）の型と純粋関数。
// firestore.rules 側でも同じ上限で検証しているため、変更時は両方を更新すること
export const MAX_COMMENT_LENGTH = 500

// 投稿時のプロフィールをスナップショット保存する。
// プロフィール機能（#57）導入後も過去コメントの表示は投稿時点のままとする
export interface CommentData {
  uid: string
  displayName: string
  photoURL: string
  text: string
}

export interface Comment extends CommentData {
  id: string
  createdAt: Date | null
}

// 投稿前のバリデーション: 前後の空白を除去し、空または上限超過なら null を返す
export function normalizeCommentText(raw: string): string | null {
  const text = raw.trim()
  if (text.length === 0 || text.length > MAX_COMMENT_LENGTH) return null
  return text
}

// Firestore から読み出したコメントドキュメントを表示用に変換する。
// 欠落フィールドは既定値で補い、createdAt は Timestamp → Date に変換する
export function commentFromDoc(id: string, data: unknown): Comment {
  const d = data as Partial<CommentData> & { createdAt?: { toDate?: () => Date } }
  return {
    id,
    uid: d.uid ?? '',
    displayName: d.displayName ?? '',
    photoURL: d.photoURL ?? '',
    text: d.text ?? '',
    createdAt: typeof d.createdAt?.toDate === 'function' ? d.createdAt.toDate() : null,
  }
}
