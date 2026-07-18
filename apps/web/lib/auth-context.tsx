'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db } from './firebase'

interface AuthContextValue {
  user: User | null
  // Firebase Auth の初期化中（ログイン状態が未確定の間）は true
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 初回ログイン時に users/{uid} を作成する。
// 表示名・アイコンはプロフィール編集（/profile）で管理するため再ログインでは
// 上書きせず、失効しうる Google の写真 URL だけを最新に保つ
async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await setDoc(ref, { photoURL: user.photoURL ?? '' }, { merge: true })
  } else {
    await setDoc(ref, {
      displayName: user.displayName ?? '',
      photoURL: user.photoURL ?? '',
      avatarEmoji: '',
      createdAt: serverTimestamp(),
    })
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // getAuth は初期化時に API キーを検証するため、ビルド時のプリレンダーでは
  // 呼ばずブラウザ実行時（effect・イベントハンドラ内）に限定する
  useEffect(() => {
    return onAuthStateChanged(getAuth(app), (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = async () => {
    const cred = await signInWithPopup(getAuth(app), new GoogleAuthProvider())
    await ensureUserDoc(cred.user)
  }

  const signOut = async () => {
    await firebaseSignOut(getAuth(app))
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
