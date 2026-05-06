import { Article, DailySummary, Importance } from './types'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { timestampValue: string }
  | { booleanValue: boolean }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields: Record<string, FsValue> } }

function parseValue(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('timestampValue' in v) return v.timestampValue
  if ('booleanValue' in v) return v.booleanValue
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(parseValue)
  if ('mapValue' in v) return parseFields(v.mapValue.fields)
  return null
}

function parseFields(fields: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, parseValue(v)]))
}

function docId(name: string): string {
  return name.split('/').pop() ?? ''
}

async function runQuery(body: object): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  })
  const rows: { document?: { name: string; fields: Record<string, FsValue> } }[] = await res.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: docId(r.document!.name), ...parseFields(r.document!.fields) }))
}

async function getDoc(collection: string, id: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/${collection}/${id}?key=${API_KEY}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  const doc: { name: string; fields: Record<string, FsValue> } = await res.json()
  return { id: docId(doc.name), ...parseFields(doc.fields) }
}

// ---- normalization ----

function normalizeDailySummary(raw: DailySummary): DailySummary {
  const uniqueIds = [...new Set(raw.articleIds)]
  return { ...raw, articleIds: uniqueIds, articleCount: uniqueIds.length }
}

// ---- public API ----

export async function getDailySummaries(limitCount = 7): Promise<DailySummary[]> {
  const rows = await runQuery({
    structuredQuery: {
      from: [{ collectionId: 'daily_summaries' }],
      orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
      limit: limitCount,
    },
  })
  return rows.map((r) => normalizeDailySummary(r as unknown as DailySummary))
}

export async function getDailySummary(date: string): Promise<DailySummary | null> {
  const doc = await getDoc('daily_summaries', date)
  if (!doc) return null
  return normalizeDailySummary({ ...doc, id: date } as unknown as DailySummary)
}

export interface ArticleFilter {
  source?: string
  importance?: Importance
  limitCount?: number
}

export async function getArticles(filter: ArticleFilter = {}): Promise<Article[]> {
  const { source, importance, limitCount = 50 } = filter
  const where = []
  if (source) {
    where.push({ fieldFilter: { field: { fieldPath: 'source' }, op: 'EQUAL', value: { stringValue: source } } })
  }
  if (importance) {
    where.push({ fieldFilter: { field: { fieldPath: 'importance' }, op: 'EQUAL', value: { stringValue: importance } } })
  }
  const query: Record<string, unknown> = {
    from: [{ collectionId: 'articles' }],
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
    limit: limitCount,
  }
  if (where.length === 1) query.where = where[0]
  if (where.length > 1) query.where = { compositeFilter: { op: 'AND', filters: where } }
  const rows = await runQuery({ structuredQuery: query })
  return rows.map((r) => r as unknown as Article)
}

export async function getArticle(id: string): Promise<Article | null> {
  const doc = await getDoc('articles', id)
  if (!doc) return null
  return { ...doc, id } as unknown as Article
}

export async function getArticlesByIds(ids: string[]): Promise<Article[]> {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return []
  const docs = await Promise.all(uniqueIds.map((id) => getDoc('articles', id)))
  return docs.filter(Boolean).map((d) => d as unknown as Article)
}
