'use client'

import { useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { MAX_DISPLAY_NAME_LENGTH, PRESET_AVATARS, normalizeDisplayName } from '@/lib/profile'

// 表示名とアイコンの編集フォーム。initial はマウント時に一度だけ反映されるため、
// 呼び出し側で key={uid} を付けてユーザー切替時に再マウントさせること
export function ProfileForm({
  initial,
  googlePhotoURL,
  onSave,
}: {
  initial: { displayName: string; avatarEmoji: string }
  googlePhotoURL: string
  onSave: (fields: { displayName: string; avatarEmoji: string }) => Promise<void>
}) {
  const [name, setName] = useState(initial.displayName)
  const [emoji, setEmoji] = useState(initial.avatarEmoji)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const displayName = normalizeDisplayName(name)
    if (!displayName) return
    setSaving(true)
    try {
      await onSave({ displayName, avatarEmoji: emoji })
      setSaved(true)
    } catch (err) {
      console.error('profile save failed', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5">
      <label className="block text-xs font-semibold text-gray-500 mb-1" htmlFor="display-name">
        表示名
      </label>
      <input
        id="display-name"
        type="text"
        value={name}
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        onChange={(e) => {
          setName(e.target.value)
          setSaved(false)
        }}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      <p className="text-xs font-semibold text-gray-500 mt-4 mb-2">アイコン</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setEmoji('')
            setSaved(false)
          }}
          aria-label="Google アカウントの写真を使う"
          aria-pressed={emoji === ''}
          className={`rounded-full p-0.5 ring-2 transition-colors ${
            emoji === '' ? 'ring-blue-400' : 'ring-transparent hover:ring-gray-200'
          }`}
        >
          <Avatar emoji="" photoURL={googlePhotoURL} size={32} />
        </button>
        {PRESET_AVATARS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => {
              setEmoji(preset)
              setSaved(false)
            }}
            aria-label={`アイコン ${preset} を選ぶ`}
            aria-pressed={emoji === preset}
            className={`rounded-full p-0.5 ring-2 transition-colors ${
              emoji === preset ? 'ring-blue-400' : 'ring-transparent hover:ring-gray-200'
            }`}
          >
            <Avatar emoji={preset} photoURL="" size={32} />
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 mt-5">
        {saved && <span className="text-xs text-green-600">保存しました</span>}
        <button
          type="submit"
          disabled={saving || normalizeDisplayName(name) === null}
          className="text-sm px-4 py-1.5 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:bg-gray-200 disabled:text-gray-400"
        >
          保存
        </button>
      </div>
    </form>
  )
}
