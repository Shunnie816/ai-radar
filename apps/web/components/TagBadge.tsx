export function TagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
      {tag}
    </span>
  )
}
