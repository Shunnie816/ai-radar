import { NextResponse } from 'next/server'
import { getDailySummary, getArticlesByIds } from '@/lib/firestore'

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const summary = await getDailySummary(date)
  if (!summary) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const articles = await getArticlesByIds(summary.articleIds)
  return NextResponse.json({ summary, articles })
}
