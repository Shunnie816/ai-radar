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

type FetchCache =
  | { cache: 'no-store' }
  | { cache: 'force-cache' }
  | { next: { revalidate: number } }

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

async function runQuery(body: object, fetchCache: FetchCache): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...fetchCache,
  })
  const rows: { document?: { name: string; fields: Record<string, FsValue> } }[] = await res.json()
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: docId(r.document!.name), ...parseFields(r.document!.fields) }))
}

async function getDoc(collection: string, id: string, fetchCache: FetchCache): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}/${collection}/${id}?key=${API_KEY}`, fetchCache)
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

// ダッシュボード専用：バッチ実行後すぐ反映させるため常に最新を取得
export async function getDailySummaries(limitCount = 7): Promise<DailySummary[]> {
  const rows = await runQuery(
    {
      structuredQuery: {
        from: [{ collectionId: 'daily_summaries' }],
        orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
        limit: limitCount,
      },
    },
    { cache: 'no-store' },
  )
  return rows.map((r) => normalizeDailySummary(r as unknown as DailySummary))
}

// 過去日のデータは変化しないため24時間キャッシュ
export async function getDailySummary(date: string): Promise<DailySummary | null> {
  const doc = await getDoc('daily_summaries', date, { next: { revalidate: 86400 } })
  if (!doc) return null
  return normalizeDailySummary({ ...doc, id: date } as unknown as DailySummary)
}

export interface ArticleFilter {
  source?: string
  importance?: Importance
  limitCount?: number
}

// 記事一覧は1時間キャッシュ（日次バッチで十分）
export async function getArticles(filter: ArticleFilter = {}): Promise<Article[]> {
  const { source, importance, limitCount = 50 } = filter
  const rows = await runQuery(
    {
      structuredQuery: {
        from: [{ collectionId: 'articles' }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: limitCount,
      },
    },
    { next: { revalidate: 3600 } },
  )
  let articles = rows.map((r) => r as unknown as Article)
  if (source) articles = articles.filter((a) => a.source === source)
  if (importance) articles = articles.filter((a) => a.importance === importance)
  return articles
}

// ソース一覧は記事一覧と同じ周期でキャッシュ
export async function getDistinctSources(): Promise<string[]> {
  const rows = await runQuery(
    {
      structuredQuery: {
        from: [{ collectionId: 'articles' }],
        select: { fields: [{ fieldPath: 'source' }] },
        limit: 500,
      },
    },
    { next: { revalidate: 3600 } },
  )
  return [...new Set(rows.map((r) => r.source as string).filter(Boolean))].sort()
}

// 記事詳細は保存後に変化しないため永続キャッシュ
export async function getArticle(id: string): Promise<Article | null> {
  const doc = await getDoc('articles', id, { cache: 'force-cache' })
  if (!doc) return null
  return { ...doc, id } as unknown as Article
}

// 日次ページの記事は24時間キャッシュ（過去データは不変）
export async function getArticlesByIds(ids: string[]): Promise<Article[]> {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return []
  const docs = await Promise.all(uniqueIds.map((id) => getDoc('articles', id, { next: { revalidate: 86400 } })))
  return docs.filter(Boolean).map((d) => d as unknown as Article)
}
