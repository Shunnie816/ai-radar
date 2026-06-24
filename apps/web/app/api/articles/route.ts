import { NextRequest, NextResponse } from 'next/server'
import { getArticles } from '@/lib/firestore'
import { Importance } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const source = searchParams.get('source') ?? undefined
  const importance = (searchParams.get('importance') as Importance) ?? undefined
  const limit = Number(searchParams.get('limit') ?? 500)
  const articles = await getArticles({ source, importance, limitCount: limit })
  return NextResponse.json(articles)
}
