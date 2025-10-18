import path from "node:path";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";

import type {
  FrontdeskDatabase,
  HelpRequest,
  HelpRequestStatus,
  KnowledgeEntry,
} from "./types";

const normalizedCwd = path.resolve(process.cwd());
const appPathSuffix = path.join("apps", "frontend");
const isAppDirectory = normalizedCwd.endsWith(appPathSuffix);
const baseDir = isAppDirectory
  ? normalizedCwd
  : path.join(normalizedCwd, "apps", "frontend");

const DATA_DIR = path.join(baseDir, "data");
const DB_PATH = path.join(DATA_DIR, "frontdesk-db.json");

const DEFAULT_DB: FrontdeskDatabase = {
  knowledgeBase: [
    {
      id: "hours",
      question: "What are your business hours?",
      answer:
        "Radiance Glow Salon is open Monday through Friday from 9am to 7pm, Saturday from 9am to 4pm, and closed on Sundays.",
      tags: ["schedule", "hours"],
      source: "seed",
      createdAt: "2025-10-15T12:00:00.000Z",
      updatedAt: "2025-10-15T12:00:00.000Z",
    },
    {
      id: "location",
      question: "Where is the salon located?",
      answer:
        "We are located at 123 Market Street, Denver, CO 80202. Validated parking is available in the Market Street Garage across the street.",
      tags: ["location", "parking"],
      source: "seed",
      createdAt: "2025-10-15T12:00:00.000Z",
      updatedAt: "2025-10-15T12:00:00.000Z",
    },
    {
      id: "services",
      question: "What services do you provide?",
      answer:
        "Our menu includes signature haircuts, balayage color, restorative conditioning treatments, and the Glow & Go package (cut, gloss, and blowout).",
      tags: ["services"],
      source: "seed",
      createdAt: "2025-10-15T12:00:00.000Z",
      updatedAt: "2025-10-15T12:00:00.000Z",
    },
    {
      id: "pricing",
      question: "What are your prices like?",
      answer:
        "Haircuts start at $85, specialty color from $185, and the Glow & Go package is $230. Quotes are confirmed before each appointment begins.",
      tags: ["pricing"],
      source: "seed",
      createdAt: "2025-10-15T12:00:00.000Z",
      updatedAt: "2025-10-15T12:00:00.000Z",
    },
    {
      id: "cancellation",
      question: "What is the cancellation policy?",
      answer:
        "Please provide 24 hours notice to cancel or reschedule. Late cancellations or no-shows incur a $50 fee.",
      tags: ["policies"],
      source: "seed",
      createdAt: "2025-10-15T12:00:00.000Z",
      updatedAt: "2025-10-15T12:00:00.000Z",
    },
  ],
  helpRequests: [],
};

async function ensureDatabaseFile(): Promise<void> {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
  }
}

async function readDatabase(): Promise<FrontdeskDatabase> {
  await ensureDatabaseFile();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(raw) as FrontdeskDatabase;
}

async function writeDatabase(db: FrontdeskDatabase): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export async function listHelpRequests(
  status: HelpRequestStatus | "all" = "pending",
): Promise<HelpRequest[]> {
  const db = await readDatabase();
  if (status === "all") {
    return db.helpRequests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return db.helpRequests
    .filter((req) => req.status === status)
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function getHelpRequest(id: string): Promise<HelpRequest | undefined> {
  const db = await readDatabase();
  return db.helpRequests.find((req) => req.id === id);
}

export interface CreateHelpRequestInput {
  question: string;
  customerName?: string;
  customerPhone?: string;
  channel?: string;
}

export async function createHelpRequest(
  input: CreateHelpRequestInput,
): Promise<HelpRequest> {
  const db = await readDatabase();
  const timestamp = new Date().toISOString();
  const entry: HelpRequest = {
    id: randomUUID(),
    question: input.question.trim(),
    customerName: input.customerName?.trim() || undefined,
    customerPhone: input.customerPhone?.trim() || undefined,
    channel: input.channel || "voice",
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.helpRequests.push(entry);
  await writeDatabase(db);

  console.info(`Hey, I need help answering "${entry.question}".`);
  console.info(
    `[supervisor-alert] request=${entry.id} caller=${entry.customerName ?? "caller"} channel=${entry.channel}`,
  );

  return entry;
}

export interface ResolveHelpRequestInput {
  action?: "timeout";
  answer?: string;
  supervisorName?: string;
  supervisorNotes?: string;
  shouldAddToKnowledgeBase?: boolean;
}

export async function updateHelpRequest(
  id: string,
  input: ResolveHelpRequestInput,
): Promise<HelpRequest> {
  const db = await readDatabase();
  const request = db.helpRequests.find((req) => req.id === id);

  if (!request) {
    throw new Error("Help request not found");
  }

  const now = new Date().toISOString();

  if (input.action === "timeout") {
    request.status = "timeout";
    request.updatedAt = now;
    request.timedOutAt = now;
  } else {
    request.status = "resolved";
    request.answer = input.answer?.trim();
    request.supervisorName = input.supervisorName?.trim() || undefined;
    request.supervisorNotes = input.supervisorNotes?.trim() || undefined;
    request.resolvedAt = now;
    request.updatedAt = now;
    request.respondedAt = now;
    const destination = request.customerPhone ?? "(unknown number)";
    const message =
      request.answer ??
      "Your question has been reviewed by a supervisor and we will follow up shortly.";
    console.info(`[caller-update] to=${destination} message="${message}"`);
  }

  await writeDatabase(db);
  return request;
}

export async function listKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  const db = await readDatabase();
  return db.knowledgeBase.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function searchKnowledgeEntries(
  query: string,
  limit = 5,
): Promise<KnowledgeEntry[]> {
  const db = await readDatabase();
  const needle = query.toLowerCase();

  const scored = db.knowledgeBase
    .map((entry) => {
      const score =
        (entry.question.toLowerCase().includes(needle) ? 2 : 0) +
        (entry.answer.toLowerCase().includes(needle) ? 1 : 0) +
        (entry.tags?.some((tag) => tag.toLowerCase().includes(needle)) ? 1 : 0);
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => entry);

  return scored;
}

export interface UpsertKnowledgeEntryInput {
  question: string;
  answer: string;
  tags?: string[];
  source?: string;
}

export async function upsertKnowledgeEntry(
  input: UpsertKnowledgeEntryInput,
): Promise<KnowledgeEntry> {
  const db = await readDatabase();
  const question = input.question.trim();
  const existing = db.knowledgeBase.find(
    (entry) => entry.question.toLowerCase() === question.toLowerCase(),
  );
  const now = new Date().toISOString();

  if (existing) {
    existing.answer = input.answer.trim();
    existing.tags = input.tags?.map((tag) => tag.trim()).filter(Boolean);
    existing.source = input.source ?? existing.source;
    existing.updatedAt = now;
    await writeDatabase(db);
    return existing;
  }

  const entry: KnowledgeEntry = {
    id: randomUUID(),
    question,
    answer: input.answer.trim(),
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean),
    source: input.source ?? "supervisor",
    createdAt: now,
    updatedAt: now,
  };

  db.knowledgeBase.push(entry);
  await writeDatabase(db);
  return entry;
}

export async function addAnswerToKnowledgeBase(
  question: string,
  answer: string,
  tags?: string[],
): Promise<KnowledgeEntry> {
  return upsertKnowledgeEntry({
    question,
    answer,
    tags,
    source: "supervisor",
  });
}
