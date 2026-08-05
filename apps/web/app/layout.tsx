import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import { AuthProvider } from '@/lib/auth-context'
import { ProfileProvider } from '@/lib/profile-context'
import { FavoritesProvider } from '@/lib/favorites-context'
import { UserMenu } from '@/components/UserMenu'
import { Footer } from '@/components/Footer'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

const SITE_URL = 'https://ai-radar.shunniehub.com'
const SITE_NAME = 'AI Radar'
const SITE_DESCRIPTION = 'AI関連ニュースを毎朝自動で収集・要約するパーソナルニュースレーダー'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50 font-sans text-gray-900">
        <AuthProvider>
          <ProfileProvider>
          <FavoritesProvider>
            <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/85 backdrop-blur">
              <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
                <Link href="/" className="font-bold tracking-tight text-gray-900 hover:text-indigo-600 transition-colors">
                  AI Radar
                </Link>
                <nav className="flex items-center gap-4 text-sm text-gray-600">
                  <Link href="/articles" className="hover:text-gray-900 transition-colors">記事一覧</Link>
                  <UserMenu />
                </nav>
              </div>
            </header>
            <div className="flex-1">{children}</div>
            <Footer />
          </FavoritesProvider>
          </ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
