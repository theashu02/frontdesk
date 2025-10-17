import { NextResponse } from 'next/server'

import {
  listKnowledgeBase,
  upsertKnowledgeBaseEntry,
} from '@/lib/store'

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? undefined
  const limitParam = searchParams.get('limit')
  const limit =
    typeof limitParam === 'string' ? Number.parseInt(limitParam, 10) : undefined

  if (Number.isNaN(limit ?? 0)) {
    return NextResponse.json(
      { error: 'limit must be a number' },
      { status: 400 },
    )
  }

  const entries = await listKnowledgeBase({
    query,
    limit: limit && limit > 0 ? limit : undefined,
  })

  return NextResponse.json({ data: entries })
}

export async function POST(request: Request): Promise<NextResponse> {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }

  if (typeof payload.question !== 'string' || typeof payload.answer !== 'string') {
    return NextResponse.json(
      { error: 'question and answer are required' },
      { status: 400 },
    )
  }

  const entry = await upsertKnowledgeBaseEntry({
    question: payload.question,
    answer: payload.answer,
    source:
      payload.source === 'seed' || payload.source === 'ai'
        ? payload.source
        : 'human',
    tags: Array.isArray(payload.tags)
      ? payload.tags.filter((tag: unknown): tag is string => typeof tag === 'string')
      : undefined,
  })

  return NextResponse.json({ data: entry }, { status: 201 })
}
