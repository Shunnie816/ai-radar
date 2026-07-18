'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth-context'
import { UserProfile, profileFromDoc } from './profile'

interface ProfileContextValue {
  // 自分のプロフィール。未ログインまたは読み込み中は null
  profile: UserProfile | null
  updateProfile: (fields: { displayName: string; avatarEmoji: string }) => Promise<void>
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  // 購読結果を uid とセットで保持し、ログアウト・ユーザー切替時の
  // 古い結果は派生値の計算で無効化する（effect 内の同期 setState を避ける）
  const [snapshot, setSnapshot] = useState<{ uid: string; profile: UserProfile } | null>(null)

  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setSnapshot({ uid: user.uid, profile: profileFromDoc(snap.data() ?? {}) })
    })
  }, [user])

  const profile = user && snapshot?.uid === user.uid ? snapshot.profile : null

  const updateProfile = async (fields: { displayName: string; avatarEmoji: string }) => {
    if (!user) return
    await setDoc(doc(db, 'users', user.uid), fields, { merge: true })
  }

  return (
    <ProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}
