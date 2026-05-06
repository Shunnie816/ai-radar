import { NextResponse } from 'next/server'
import { getArticle } from '@/lib/firestore'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const article = await getArticle(id)
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(article)
}
