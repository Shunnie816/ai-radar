'use client'

import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'

// ユーザーがポップアップを自分で閉じた場合はエラー扱いにしない
const IGNORED_AUTH_ERRORS = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']

export function UserMenu() {
  const { user, loading, signIn, signOut } = useAuth()

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
    <div className="flex items-center gap-2">
      {user.photoURL && (
        <Image
          src={user.photoURL}
          alt=""
          width={24}
          height={24}
          className="rounded-full"
        />
      )}
      <span className="hidden sm:inline text-gray-700">{user.displayName}</span>
      <button onClick={() => signOut()} className="hover:text-gray-900 transition-colors">
        ログアウト
      </button>
    </div>
  )
}
