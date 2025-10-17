export type HelpRequestStatus = 'pending' | 'resolved' | 'timeout'

export interface HelpRequest {
  id: string
  customerPhone: string
  customerName?: string
  channel: 'voice' | 'sms' | 'web'
  question: string
  status: HelpRequestStatus
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  supervisorNotes?: string
  answer?: string
  supervisorName?: string
}

export interface KnowledgeBaseEntry {
  id: string
  question: string
  answer: string
  createdAt: string
  updatedAt?: string
  source: 'seed' | 'human' | 'ai'
  tags?: string[]
  relatedRequestId?: string
}

export interface DatabaseSnapshot {
  helpRequests: HelpRequest[]
  knowledgeBase: KnowledgeBaseEntry[]
}
