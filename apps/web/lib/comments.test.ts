import { describe, it, expect } from 'vitest'
import { MAX_COMMENT_LENGTH, commentFromDoc, normalizeCommentText } from './comments'

describe('normalizeCommentText', () => {
  it('should return trimmed text when valid', () => {
    expect(normalizeCommentText('  良い記事でした  ')).toBe('良い記事でした')
  })

  it('should return null when text is empty or whitespace only', () => {
    expect(normalizeCommentText('')).toBeNull()
    expect(normalizeCommentText('   \n\t ')).toBeNull()
  })

  it('should return null when text exceeds the max length', () => {
    expect(normalizeCommentText('あ'.repeat(MAX_COMMENT_LENGTH + 1))).toBeNull()
  })

  it('should accept text at exactly the max length', () => {
    const text = 'あ'.repeat(MAX_COMMENT_LENGTH)

    expect(normalizeCommentText(text)).toBe(text)
  })
})

describe('commentFromDoc', () => {
  it('should convert a Firestore doc with a Timestamp into a Comment', () => {
    const createdAt = new Date('2026-07-18T09:00:00Z')

    const comment = commentFromDoc('comment-1', {
      uid: 'user-1',
      displayName: 'Ponyo',
      photoURL: 'https://example.com/avatar.png',
      text: '参考になりました',
      createdAt: { toDate: () => createdAt },
    })

    expect(comment).toEqual({
      id: 'comment-1',
      uid: 'user-1',
      displayName: 'Ponyo',
      photoURL: 'https://example.com/avatar.png',
      text: '参考になりました',
      createdAt,
    })
  })

  it('should fall back to defaults for missing fields', () => {
    const comment = commentFromDoc('comment-1', {})

    expect(comment).toEqual({
      id: 'comment-1',
      uid: '',
      displayName: '',
      photoURL: '',
      text: '',
      createdAt: null,
    })
  })
})
