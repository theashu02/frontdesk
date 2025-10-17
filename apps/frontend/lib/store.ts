import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  DatabaseSnapshot,
  HelpRequest,
  HelpRequestStatus,
  KnowledgeBaseEntry,
} from './types'

const FALLBACK_DATA: DatabaseSnapshot = {
  helpRequests: [],
  knowledgeBase: [
    {
      id: 'seed-hours',
      question: 'What are your hours?',
      answer: "We're open 9 AM to 6 PM, Monday through Saturday.",
      createdAt: '2025-10-17T00:00:00.000Z',
      source: 'seed',
      tags: ['hours', 'availability'],
    },
    {
      id: 'seed-location',
      question: 'Where are you located?',
      answer: "We're located at 123 Main Street, Suite 4, Springfield.",
      createdAt: '2025-10-17T00:00:00.000Z',
      source: 'seed',
      tags: ['location', 'directions'],
    },
    {
      id: 'seed-services',
      question: 'What services do you offer?',
      answer:
        'We offer haircuts, color services, blowouts, highlights, and bridal styling.',
      createdAt: '2025-10-17T00:00:00.000Z',
      source: 'seed',
      tags: ['services'],
    },
    {
      id: 'seed-pricing',
      question: 'How much are haircuts?',
      answer: 'Standard haircuts start at $45 and include a shampoo and blow-dry.',
      createdAt: '2025-10-17T00:00:00.000Z',
      source: 'seed',
      tags: ['pricing', 'haircut'],
    },
  ],
}

function loadDefaultData(): DatabaseSnapshot {
  const candidatePath = path.join(process.cwd(), 'data', 'frontdesk-db.json')
  if (existsSync(candidatePath)) {
    try {
      const raw = readFileSync(candidatePath, 'utf-8')
      return JSON.parse(raw) as DatabaseSnapshot
    } catch {
      return FALLBACK_DATA
    }
  }
  return FALLBACK_DATA
}

const DEFAULT_DATA = loadDefaultData()

const DB_FILENAME = 'frontdesk-db.json'
const DATA_DIR_CANDIDATES = [
  path.join(process.cwd(), 'data'),
  path.join(process.cwd(), '..', 'data'),
  path.join(process.cwd(), '..', '..', 'data'),
  path.join(process.cwd(), 'apps', 'frontend', 'data'),
]

function resolveDataDir(): string {
  for (const candidate of DATA_DIR_CANDIDATES) {
    if (existsSync(path.join(candidate, DB_FILENAME))) {
      return candidate
    }
  }
  if (existsSync(path.join(process.cwd(), 'data'))) {
    return path.join(process.cwd(), 'data')
  }
  return path.join(process.cwd(), 'apps', 'frontend', 'data')
}

const DATA_DIR = resolveDataDir()
const DB_PATH = path.join(DATA_DIR, DB_FILENAME)

async function ensureDataFile(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
  if (!existsSync(DB_PATH)) {
    await writeFile(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8')
  }
}

async function readDatabase(): Promise<DatabaseSnapshot> {
  await ensureDataFile()
  const raw = await readFile(DB_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as DatabaseSnapshot
  return {
    helpRequests: parsed.helpRequests ?? [],
    knowledgeBase: parsed.knowledgeBase ?? [],
  }
}

async function writeDatabase(snapshot: DatabaseSnapshot): Promise<void> {
  await ensureDataFile()
  const serialised = JSON.stringify(snapshot, null, 2)
  await writeFile(DB_PATH, serialised, 'utf-8')
}

export interface CreateHelpRequestInput {
  question: string
  customerPhone: string
  customerName?: string
  channel?: 'voice' | 'sms' | 'web'
  metadata?: Record<string, unknown>
}

export async function createHelpRequest(
  input: CreateHelpRequestInput,
): Promise<HelpRequest> {
  const now = new Date().toISOString()
  const snapshot = await readDatabase()

  const helpRequest: HelpRequest = {
    id: randomUUID(),
    question: input.question.trim(),
    customerPhone: input.customerPhone.trim(),
    customerName: input.customerName?.trim(),
    channel: input.channel ?? 'voice',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }

  snapshot.helpRequests.unshift(helpRequest)
  await writeDatabase(snapshot)
  return helpRequest
}

export async function listHelpRequests(options?: {
  status?: HelpRequestStatus | 'all'
}): Promise<HelpRequest[]> {
  const snapshot = await readDatabase()
  const status = options?.status ?? 'all'
  const sorted = [...snapshot.helpRequests].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  )
  if (status === 'all') {
    return sorted
  }
  return sorted.filter((request) => request.status === status)
}

export async function getHelpRequest(id: string): Promise<HelpRequest | null> {
  const snapshot = await readDatabase()
  return snapshot.helpRequests.find((request) => request.id === id) ?? null
}

export interface ResolveHelpRequestInput {
  id: string
  answer: string
  supervisorName?: string
  supervisorNotes?: string
  shouldAddToKnowledgeBase?: boolean
}

export async function resolveHelpRequest(
  input: ResolveHelpRequestInput,
): Promise<HelpRequest> {
  const snapshot = await readDatabase()
  const requestIndex = snapshot.helpRequests.findIndex(
    (request) => request.id === input.id,
  )

  if (requestIndex === -1) {
    throw new Error(`Help request ${input.id} not found`)
  }

  const now = new Date().toISOString()
  const existing = snapshot.helpRequests[requestIndex]!
  const resolved: HelpRequest = {
    ...existing,
    status: 'resolved',
    answer: input.answer.trim(),
    supervisorNotes: input.supervisorNotes?.trim(),
    supervisorName: input.supervisorName?.trim(),
    updatedAt: now,
    resolvedAt: now,
  }
  snapshot.helpRequests[requestIndex] = resolved

  if (input.shouldAddToKnowledgeBase !== false) {
    await upsertKnowledgeBaseEntry({
      question: existing.question,
      answer: resolved.answer!,
      source: 'human',
      relatedRequestId: existing.id,
    })
  }

  await writeDatabase(snapshot)
  return resolved
}

export async function markHelpRequestTimeout(id: string): Promise<HelpRequest> {
  const snapshot = await readDatabase()
  const requestIndex = snapshot.helpRequests.findIndex(
    (request) => request.id === id,
  )
  if (requestIndex === -1) {
    throw new Error(`Help request ${id} not found`)
  }

  const now = new Date().toISOString()
  const existing = snapshot.helpRequests[requestIndex]!
  if (existing.status !== 'pending') {
    return existing
  }

  const updated: HelpRequest = {
    ...existing,
    status: 'timeout',
    updatedAt: now,
  }

  snapshot.helpRequests[requestIndex] = updated
  await writeDatabase(snapshot)
  return updated
}

export async function listKnowledgeBase(options?: {
  query?: string
  limit?: number
}): Promise<KnowledgeBaseEntry[]> {
  const snapshot = await readDatabase()
  let entries = [...snapshot.knowledgeBase].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  )
  if (options?.query) {
    entries = searchEntries(entries, options.query)
  }
  if (options?.limit) {
    entries = entries.slice(0, options.limit)
  }
  return entries
}

export interface UpsertKnowledgeBaseInput {
  id?: string
  question: string
  answer: string
  source?: KnowledgeBaseEntry['source']
  tags?: string[]
  relatedRequestId?: string
}

export async function upsertKnowledgeBaseEntry(
  input: UpsertKnowledgeBaseInput,
): Promise<KnowledgeBaseEntry> {
  const snapshot = await readDatabase()
  const now = new Date().toISOString()
  const normalisedQuestion = input.question.trim()

  const existingIndex = snapshot.knowledgeBase.findIndex(
    (entry) =>
      entry.id === input.id ||
      entry.question.toLowerCase() === normalisedQuestion.toLowerCase(),
  )

  if (existingIndex !== -1) {
    const existing = snapshot.knowledgeBase[existingIndex]!
    const merged: KnowledgeBaseEntry = {
      ...existing,
      question: normalisedQuestion,
      answer: input.answer.trim(),
      updatedAt: now,
      source: input.source ?? existing.source,
      tags: input.tags ?? existing.tags,
      relatedRequestId: input.relatedRequestId ?? existing.relatedRequestId,
    }
    snapshot.knowledgeBase[existingIndex] = merged
    await writeDatabase(snapshot)
    return merged
  }

  const entry: KnowledgeBaseEntry = {
    id: input.id ?? randomUUID(),
    question: normalisedQuestion,
    answer: input.answer.trim(),
    createdAt: now,
    updatedAt: now,
    source: input.source ?? 'human',
    tags: input.tags,
    relatedRequestId: input.relatedRequestId,
  }

  snapshot.knowledgeBase.unshift(entry)
  await writeDatabase(snapshot)
  return entry
}

function searchEntries(
  entries: KnowledgeBaseEntry[],
  query: string,
): KnowledgeBaseEntry[] {
  const normalised = query.trim().toLowerCase()
  if (!normalised) {
    return entries
  }

  const tokens = normalised
    .split(/\W+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const scored = entries.map((entry) => {
    const haystack = `${entry.question} ${entry.answer}`
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean)

    const overlap = tokens.reduce((score, token) => {
      return score + (haystack.includes(token) ? 1 : 0)
    }, 0)

    const prefixScore = tokens.reduce((score, token) => {
      return (
        score + (haystack.some((word) => word.startsWith(token)) ? 0.5 : 0)
      )
    }, 0)

    const totalScore =
      overlap + prefixScore + (entry.question.toLowerCase().includes(normalised) ? 2 : 0)

    return { entry, score: totalScore }
  })

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.entry)
}
