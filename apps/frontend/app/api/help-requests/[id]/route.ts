import { NextResponse } from 'next/server'

import {
  getHelpRequest,
  markHelpRequestTimeout,
  resolveHelpRequest,
} from '@/lib/store'

export async function GET(
  _request: Request,
  context: { params: { id: string } },
): Promise<NextResponse> {
  const requestId = context.params.id
  const helpRequest = await getHelpRequest(requestId)
  if (!helpRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ data: helpRequest })
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } },
): Promise<NextResponse> {
  const requestId = context.params.id
  const existing = await getHelpRequest(requestId)
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const payload = await request.json().catch(() => null)
  const action = payload?.action ?? 'resolve'

  if (action === 'timeout') {
    const updated = await markHelpRequestTimeout(requestId)
    return NextResponse.json({ data: updated })
  }

  if (typeof payload?.answer !== 'string' || !payload.answer.trim()) {
    return NextResponse.json(
      { error: 'answer is required to resolve a request' },
      { status: 400 },
    )
  }

  const resolved = await resolveHelpRequest({
    id: requestId,
    answer: payload.answer,
    supervisorName:
      typeof payload.supervisorName === 'string'
        ? payload.supervisorName
        : undefined,
    supervisorNotes:
      typeof payload.supervisorNotes === 'string'
        ? payload.supervisorNotes
        : undefined,
    shouldAddToKnowledgeBase:
      payload.shouldAddToKnowledgeBase === false ? false : true,
  })

  console.log(
    `[FrontDesk] Sending SMS to ${existing.customerPhone}: ${resolved.answer}`,
  )

  return NextResponse.json({ data: resolved })
}
