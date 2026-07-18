export function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full">
      {tag}
    </span>
  )
}
