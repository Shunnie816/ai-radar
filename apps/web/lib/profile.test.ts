import { describe, it, expect } from 'vitest'
import { Comment } from './comments'
import {
  MAX_DISPLAY_NAME_LENGTH,
  normalizeDisplayName,
  profileFromDoc,
  resolveCommentAuthor,
} from './profile'

describe('normalizeDisplayName', () => {
  it('should return trimmed name when valid', () => {
    expect(normalizeDisplayName('  Ponyo  ')).toBe('Ponyo')
  })

  it('should return null when name is empty or whitespace only', () => {
    expect(normalizeDisplayName('')).toBeNull()
    expect(normalizeDisplayName('   ')).toBeNull()
  })

  it('should return null when name exceeds the max length', () => {
    expect(normalizeDisplayName('あ'.repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toBeNull()
  })

  it('should accept name at exactly the max length', () => {
    const name = 'あ'.repeat(MAX_DISPLAY_NAME_LENGTH)

    expect(normalizeDisplayName(name)).toBe(name)
  })
})

describe('profileFromDoc', () => {
  it('should build a profile from a Firestore doc', () => {
    expect(
      profileFromDoc({
        displayName: 'Ponyo',
        photoURL: 'https://example.com/photo.png',
        avatarEmoji: '🐟',
      }),
    ).toEqual({
      displayName: 'Ponyo',
      photoURL: 'https://example.com/photo.png',
      avatarEmoji: '🐟',
    })
  })

  it('should fall back to defaults for missing fields', () => {
    expect(profileFromDoc({})).toEqual({ displayName: '', photoURL: '', avatarEmoji: '' })
  })
})

describe('resolveCommentAuthor', () => {
  const comment: Comment = {
    id: 'comment-1',
    uid: 'user-1',
    displayName: '旧しゅん',
    photoURL: 'https://example.com/old.png',
    text: 'コメント本文',
    createdAt: null,
    updatedAt: null,
  }

  it('should use the latest profile when available', () => {
    const author = resolveCommentAuthor(comment, {
      displayName: '新しゅん',
      photoURL: 'https://example.com/new.png',
      avatarEmoji: '🚀',
    })

    expect(author).toEqual({
      displayName: '新しゅん',
      photoURL: 'https://example.com/new.png',
      avatarEmoji: '🚀',
    })
  })

  it('should fall back to the snapshot when the profile is missing', () => {
    const author = resolveCommentAuthor(comment, null)

    expect(author).toEqual({
      displayName: '旧しゅん',
      photoURL: 'https://example.com/old.png',
      avatarEmoji: '',
    })
  })

  it('should keep the snapshot name when the profile name is empty', () => {
    const author = resolveCommentAuthor(comment, {
      displayName: '',
      photoURL: '',
      avatarEmoji: '',
    })

    expect(author.displayName).toBe('旧しゅん')
  })
})
