'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

interface AuthContextValue {
  user: User | null
  // Firebase Auth の初期化中（ログイン状態が未確定の間）は true
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// 初回ログイン時に users/{uid} を作成する。
// 2回目以降は Google アカウント側の表示名・アイコンの変更を反映する
async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  const profile = { displayName: user.displayName ?? '', photoURL: user.photoURL ?? '' }
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await setDoc(ref, profile, { merge: true })
  } else {
    await setDoc(ref, { ...profile, createdAt: serverTimestamp() })
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  const signIn = async () => {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    await ensureUserDoc(cred.user)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
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
