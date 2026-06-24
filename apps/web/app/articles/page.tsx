import { ArticleList } from '@/components/ArticleList'

export default function ArticlesPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-gray-900 mb-4">記事一覧</h1>
      <ArticleList />
    </main>
  )
}
