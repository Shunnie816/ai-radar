import { Comment } from './comments'

export const MAX_DISPLAY_NAME_LENGTH = 50

// プロフィールで選べるプリセットアイコン。先頭は AI Radar らしく📡
export const PRESET_AVATARS = ['📡', '🦊', '🐱', '🐶', '🐧', '🦉', '🚀', '⭐']

// users/{uid} のプロフィール。avatarEmoji が空文字のときは
// photoURL（Google アカウントの写真）をアイコンとして使う
export interface UserProfile {
  displayName: string
  photoURL: string
  avatarEmoji: string
}

// 保存前のバリデーション: 前後の空白を除去し、空または上限超過なら null を返す
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.trim()
  if (name.length === 0 || name.length > MAX_DISPLAY_NAME_LENGTH) return null
  return name
}

export function profileFromDoc(data: unknown): UserProfile {
  const d = data as Partial<UserProfile>
  return {
    displayName: d.displayName ?? '',
    photoURL: d.photoURL ?? '',
    avatarEmoji: d.avatarEmoji ?? '',
  }
}

export interface CommentAuthor {
  displayName: string
  photoURL: string
  avatarEmoji: string
}

// コメントの投稿者表示を解決する。プロフィールがあれば常に最新を表示し、
// 取得できない場合（ユーザードキュメント欠落など）は投稿時のスナップショットに戻す
export function resolveCommentAuthor(
  comment: Comment,
  profile: UserProfile | null | undefined,
): CommentAuthor {
  if (!profile) {
    return { displayName: comment.displayName, photoURL: comment.photoURL, avatarEmoji: '' }
  }
  return {
    displayName: profile.displayName || comment.displayName,
    photoURL: profile.photoURL,
    avatarEmoji: profile.avatarEmoji,
  }
}
