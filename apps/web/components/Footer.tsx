const REPO_URL = 'https://github.com/Shunnie816/ai-radar'

export function Footer() {
  return (
    <footer className="border-t border-gray-200/80 bg-white">
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>© 2026 Shunnie816</p>
        <nav className="flex items-center gap-4">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition-colors"
          >
            GitHub
          </a>
          <a
            href={`${REPO_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition-colors"
          >
            MIT License
          </a>
        </nav>
      </div>
    </footer>
  )
}
