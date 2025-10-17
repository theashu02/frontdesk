import { NextResponse } from 'next/server'

import {
  createHelpRequest,
  listHelpRequests,
} from '@/lib/store'
import type { HelpRequestStatus } from '@/lib/types'

export async function GET(
  request: Request,
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status') ?? 'all'
  const allowedStatuses = new Set<HelpRequestStatus | 'all'>([
    'pending',
    'resolved',
    'timeout',
    'all',
  ])

  const status = allowedStatuses.has(statusParam as HelpRequestStatus | 'all')
    ? (statusParam as HelpRequestStatus | 'all')
    : 'all'

  const helpRequests = await listHelpRequests({ status })
  return NextResponse.json({ data: helpRequests })
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const payload = await request.json().catch(() => null)
  if (
    !payload ||
    typeof payload.question !== 'string' ||
    typeof payload.customerPhone !== 'string'
  ) {
    return NextResponse.json(
      { error: 'question and customerPhone are required' },
      { status: 400 },
    )
  }

  const helpRequest = await createHelpRequest({
    question: payload.question,
    customerPhone: payload.customerPhone,
    customerName:
      typeof payload.customerName === 'string'
        ? payload.customerName
        : undefined,
    channel:
      payload.channel === 'sms' || payload.channel === 'web'
        ? payload.channel
        : 'voice',
  })

  return NextResponse.json({ data: helpRequest }, { status: 201 })
}
