import { describe, it, expect } from 'vitest'
import { parseFields, parseValue, type FsValue } from './firestore-parse'

describe('parseValue', () => {
  it('should convert stringValue to a string', () => {
    expect(parseValue({ stringValue: 'AI記事' })).toBe('AI記事')
  })

  it('should convert integerValue from a string to a number', () => {
    expect(parseValue({ integerValue: '8' })).toBe(8)
  })

  it('should convert booleanValue to a boolean', () => {
    expect(parseValue({ booleanValue: true })).toBe(true)
  })

  it('should keep timestampValue as an ISO string', () => {
    expect(parseValue({ timestampValue: '2026-07-18T06:00:00Z' })).toBe('2026-07-18T06:00:00Z')
  })

  it('should convert arrayValue items recursively', () => {
    const value: FsValue = {
      arrayValue: { values: [{ stringValue: 'LLM' }, { stringValue: 'security' }] },
    }

    expect(parseValue(value)).toEqual(['LLM', 'security'])
  })

  it('should return an empty array when arrayValue has no values', () => {
    expect(parseValue({ arrayValue: {} })).toEqual([])
  })

  it('should convert mapValue fields recursively', () => {
    const value: FsValue = {
      mapValue: { fields: { technicalImpact: { integerValue: '3' } } },
    }

    expect(parseValue(value)).toEqual({ technicalImpact: 3 })
  })

  it('should return null for an unknown value type', () => {
    expect(parseValue({ nullValue: null } as unknown as FsValue)).toBeNull()
  })
})

describe('parseFields', () => {
  it('should convert every field preserving its key', () => {
    const fields: Record<string, FsValue> = {
      title: { stringValue: '新モデル発表' },
      totalScore: { integerValue: '9' },
    }

    expect(parseFields(fields)).toEqual({ title: '新モデル発表', totalScore: 9 })
  })
})
