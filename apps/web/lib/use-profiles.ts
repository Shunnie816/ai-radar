'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import { UserProfile, profileFromDoc } from './profile'

// コメント一覧などで複数ユーザーのプロフィールをまとめて解決するフック。
// 値が null のエントリは「取得済みだが存在しない」を表す（スナップショット表示に
// フォールバックするための区別）。マウント中はキャッシュし、同じ uid は再取得しない
export function useUserProfiles(uids: string[]): Record<string, UserProfile | null> {
  const [profiles, setProfiles] = useState<Record<string, UserProfile | null>>({})

  useEffect(() => {
    const missing = uids.filter((uid) => !(uid in profiles))
    if (missing.length === 0) return
    let cancelled = false
    Promise.all(
      missing.map(async (uid) => {
        const snap = await getDoc(doc(db, 'users', uid))
        return [uid, snap.exists() ? profileFromDoc(snap.data()) : null] as const
      }),
    )
      .then((entries) => {
        if (!cancelled) setProfiles((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
      })
      .catch((err) => console.error('profile fetch failed', err))
    return () => {
      cancelled = true
    }
  }, [uids, profiles])

  return profiles
}
