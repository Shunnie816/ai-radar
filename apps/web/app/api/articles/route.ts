import { NextRequest, NextResponse } from 'next/server'
import { getArticles } from '@/lib/firestore'
import { Importance } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const source = searchParams.get('source') ?? undefined
  const importance = (searchParams.get('importance') as Importance) ?? undefined
  const articles = await getArticles({ source, importance })
  return NextResponse.json(articles)
}
