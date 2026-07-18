'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useProfile } from '@/lib/profile-context'
import { Avatar } from '@/components/Avatar'

// ユーザーがポップアップを自分で閉じた場合はエラー扱いにしない
const IGNORED_AUTH_ERRORS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

export function UserMenu() {
  const { user, loading, signIn, signOut } = useAuth()
  const { profile } = useProfile()

  const handleSignIn = () => {
    signIn().catch((e: unknown) => {
      const code = (e as { code?: string }).code
      if (code && IGNORED_AUTH_ERRORS.includes(code)) return
      console.error('sign-in failed', e)
    })
  }

  if (loading) {
    // ログイン状態の確定前にボタンが一瞬出るちらつきを防ぐ
    return <span className="inline-block w-16" aria-hidden="true" />
  }

  if (!user) {
    return (
      <button onClick={handleSignIn} className="hover:text-gray-900 transition-colors">
        ログイン
      </button>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/favorites" className="hover:text-gray-900 transition-colors">
        お気に入り
      </Link>
      <Link
        href="/profile"
        className="flex items-center gap-2 hover:text-gray-900 transition-colors"
      >
        <Avatar
          emoji={profile?.avatarEmoji ?? ''}
          photoURL={profile?.photoURL ?? user.photoURL ?? ''}
          size={24}
        />
        <span className="hidden sm:inline text-gray-700">
          {profile?.displayName || user.displayName}
        </span>
      </Link>
      <button onClick={() => signOut()} className="hover:text-gray-900 transition-colors">
        ログアウト
      </button>
    </div>
  )
}
