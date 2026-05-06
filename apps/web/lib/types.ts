export type Importance = 'high' | 'medium' | 'low'

export interface Article {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string
  rawContent: string
  summary: string
  importance: Importance
  tags: string[]
  createdAt: string
}

export interface DailySummary {
  id: string
  date: string
  summary: string
  keyTopics: string[]
  articleCount: number
  articleIds: string[]
  createdAt: string
}
