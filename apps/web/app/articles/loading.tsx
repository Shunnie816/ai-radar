export default function Loading() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="h-6 bg-gray-200 rounded w-24 mb-4 animate-pulse" />
      <div className="h-10 bg-gray-100 rounded-lg mb-4 animate-pulse" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-16 bg-gray-100 rounded-full animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
            <div className="flex justify-between gap-2 mb-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-12 shrink-0" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-full mb-2" />
            <div className="h-3 bg-gray-100 rounded w-2/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/4" />
          </div>
        ))}
      </div>
    </main>
  )
}
