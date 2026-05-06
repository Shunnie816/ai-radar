import { NextResponse } from 'next/server'
import { getDailySummaries } from '@/lib/firestore'

export async function GET() {
  const summaries = await getDailySummaries(7)
  return NextResponse.json(summaries)
}
