import Image from 'next/image'

// ユーザーアイコン。絵文字が設定されていればそれを優先し、
// なければ Google アカウントの写真、どちらもなければ既定アイコンを表示する
export function Avatar({
  emoji,
  photoURL,
  size = 24,
}: {
  emoji: string
  photoURL: string
  size?: number
}) {
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className="rounded-full bg-gray-100 flex items-center justify-center shrink-0 select-none"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
      >
        {emoji}
      </span>
    )
  }
  if (photoURL) {
    return (
      <Image src={photoURL} alt="" width={size} height={size} className="rounded-full shrink-0" />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="rounded-full bg-gray-100 flex items-center justify-center shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      👤
    </span>
  )
}
