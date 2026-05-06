import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Radar',
  description: 'AI関連情報の自動収集・要約・蓄積システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const todayJst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
            <Link href="/" className="font-bold text-gray-900 hover:text-indigo-600 transition-colors">
              AI Radar
            </Link>
            <nav className="flex items-center gap-4 text-sm text-gray-600">
              <Link href="/articles" className="hover:text-gray-900 transition-colors">記事一覧</Link>
              <Link
                href={`/daily/${todayJst}`}
                className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium"
              >
                今日
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  )
}
