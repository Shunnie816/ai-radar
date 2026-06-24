'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-4">記事一覧</h1>
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">記事の読み込みに失敗しました</p>
        <button
          onClick={reset}
          className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          再試行
        </button>
      </div>
    </main>
  )
}
