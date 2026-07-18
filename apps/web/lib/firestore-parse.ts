// Firestore REST API のレスポンス値を通常の JS 値に変換する（テスト: firestore-parse.test.ts）

export type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { timestampValue: string }
  | { booleanValue: boolean }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields: Record<string, FsValue> } }

export function parseValue(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('timestampValue' in v) return v.timestampValue
  if ('booleanValue' in v) return v.booleanValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(parseValue)
  if ('mapValue' in v) return parseFields(v.mapValue.fields)
  return null
}

export function parseFields(fields: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, parseValue(v)]))
}
