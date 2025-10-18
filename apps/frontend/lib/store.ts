"use server";

import { randomUUID } from "node:crypto";

import { FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";

import type {
  HelpRequest,
  HelpRequestStatus,
  KnowledgeEntry,
} from "./types";
import { getDb } from "./firebase-admin";

const HELP_REQUESTS_COLLECTION = "helpRequests";
const KNOWLEDGE_COLLECTION = "knowledgeBase";

type HelpRequestRecord = HelpRequest;
type KnowledgeRecord = KnowledgeEntry & {
  questionLower: string;
};

const DEFAULT_KNOWLEDGE_SEED: KnowledgeEntry[] = [
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
];

let knowledgeSeedPromise: Promise<void> | null = null;

function toIsoString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date.toISOString();
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function sanitizeHelpRequest(data: FirebaseFirestore.DocumentData, id: string): HelpRequest {
  return {
    id,
    question: data.question,
    customerName: data.customerName ?? undefined,
    customerPhone: data.customerPhone ?? undefined,
    channel: data.channel ?? undefined,
    status: data.status,
    createdAt: toIsoString(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date().toISOString(),
    answer: data.answer ?? undefined,
    supervisorName: data.supervisorName ?? undefined,
    supervisorNotes: data.supervisorNotes ?? undefined,
    resolvedAt: toIsoString(data.resolvedAt),
    respondedAt: toIsoString(data.respondedAt),
    timedOutAt: toIsoString(data.timedOutAt),
  };
}

function sanitizeKnowledgeEntry(
  doc: DocumentSnapshot<FirebaseFirestore.DocumentData>,
): KnowledgeEntry {
  const data = doc.data() as KnowledgeRecord;

  return {
    id: data.id ?? doc.id,
    question: data.question,
    answer: data.answer,
    tags: data.tags,
    source: data.source,
    createdAt: toIsoString(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date().toISOString(),
  };
}

async function ensureKnowledgeSeed() {
  if (knowledgeSeedPromise) {
    return knowledgeSeedPromise;
  }

  knowledgeSeedPromise = (async () => {
    const db = await getDb();
    const collection = db.collection(KNOWLEDGE_COLLECTION);
    const snapshot = await collection.limit(1).get();
    if (!snapshot.empty) {
      return;
    }

    await Promise.all(
      DEFAULT_KNOWLEDGE_SEED.map(async (entry) => {
        const docRef = collection.doc(entry.id);
        await docRef.set({
          ...entry,
          id: docRef.id,
          questionLower: entry.question.toLowerCase(),
        });
      }),
    );
  })().catch((error) => {
    knowledgeSeedPromise = null;
    throw error;
  });

  return knowledgeSeedPromise;
}

export async function listHelpRequests(
  status: HelpRequestStatus | "all" = "pending",
): Promise<HelpRequest[]> {
  const db = await getDb();
  const collection = db.collection(HELP_REQUESTS_COLLECTION);
  let snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;

  if (status === "all") {
    snapshot = await collection.orderBy("createdAt", "desc").get();
  } else {
    snapshot = await collection.where("status", "==", status).get();
  }

  const items = snapshot.docs.map((doc) => sanitizeHelpRequest(doc.data(), doc.id));

  if (status === "all") {
    return items;
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getHelpRequest(id: string): Promise<HelpRequest | undefined> {
  const db = await getDb();
  const doc = await db.collection(HELP_REQUESTS_COLLECTION).doc(id).get();
  if (!doc.exists) {
    return undefined;
  }

  return sanitizeHelpRequest(doc.data()!, doc.id);
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
  const db = await getDb();
  const collection = db.collection(HELP_REQUESTS_COLLECTION);
  const docRef = collection.doc();
  const now = new Date().toISOString();

  const record: HelpRequestRecord = {
    id: docRef.id,
    question: input.question.trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const customerName = input.customerName?.trim();
  if (customerName) {
    record.customerName = customerName;
  }

  const customerPhone = input.customerPhone?.trim();
  if (customerPhone) {
    record.customerPhone = customerPhone;
  }

  const channel = input.channel?.trim();
  if (channel) {
    record.channel = channel;
  }

  await docRef.set(record);
  return record;
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
  const db = await getDb();
  const docRef = db.collection(HELP_REQUESTS_COLLECTION).doc(id);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    throw new Error("Help request not found");
  }

  const existing = sanitizeHelpRequest(snapshot.data()!, snapshot.id);
  const now = new Date().toISOString();

  if (input.action === "timeout") {
    await docRef.update({
      status: "timeout",
      updatedAt: now,
      timedOutAt: now,
    });

    return {
      ...existing,
      status: "timeout",
      updatedAt: now,
      timedOutAt: now,
    };
  }

  const answer = input.answer?.trim();
  if (!answer) {
    throw new Error("answer is required when resolving");
  }

  const supervisorName = input.supervisorName?.trim();
  const supervisorNotes = input.supervisorNotes?.trim();

  const updates: FirebaseFirestore.UpdateData<HelpRequestRecord> = {
    status: "resolved",
    answer,
    updatedAt: now,
    resolvedAt: now,
    respondedAt: now,
    timedOutAt: FieldValue.delete(),
  };

  if (supervisorName) {
    updates.supervisorName = supervisorName;
  } else {
    updates.supervisorName = FieldValue.delete();
  }

  if (supervisorNotes) {
    updates.supervisorNotes = supervisorNotes;
  } else {
    updates.supervisorNotes = FieldValue.delete();
  }

  await docRef.update(updates);

  const result: HelpRequest = {
    ...existing,
    status: "resolved",
    answer,
    updatedAt: now,
    resolvedAt: now,
    respondedAt: now,
  };

  if (supervisorName) {
    result.supervisorName = supervisorName;
  } else {
    delete result.supervisorName;
  }

  if (supervisorNotes) {
    result.supervisorNotes = supervisorNotes;
  } else {
    delete result.supervisorNotes;
  }

  delete result.timedOutAt;

  const destination = existing.customerPhone ?? "(unknown number)";
  const message =
    result.answer ??
    "Your question has been reviewed by a supervisor and we will follow up shortly.";
  console.info(`[caller-update] to=${destination} message="${message}"`);

  return result;
}

export async function listKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  await ensureKnowledgeSeed();

  const db = await getDb();
  const collection = db.collection(KNOWLEDGE_COLLECTION);
  const snapshot = await collection.orderBy("updatedAt", "desc").get();

  return snapshot.docs.map((doc) => sanitizeKnowledgeEntry(doc));
}

export async function searchKnowledgeEntries(
  query: string,
  limit = 5,
): Promise<KnowledgeEntry[]> {
  await ensureKnowledgeSeed();

  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  const db = await getDb();
  const allSnapshot = await db.collection(KNOWLEDGE_COLLECTION).get();
  const entries = allSnapshot.docs.map((doc) => sanitizeKnowledgeEntry(doc));

  const scored = entries
    .map((entry) => {
      const score =
        (entry.question.toLowerCase().includes(trimmed) ? 2 : 0) +
        (entry.answer.toLowerCase().includes(trimmed) ? 1 : 0) +
        (entry.tags?.some((tag) => tag.toLowerCase().includes(trimmed)) ? 1 : 0);
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
  await ensureKnowledgeSeed();

  const db = await getDb();
  const collection = db.collection(KNOWLEDGE_COLLECTION);
  const question = input.question.trim();
  const questionLower = question.toLowerCase();
  const tags = input.tags?.map((tag) => tag.trim()).filter(Boolean);
  const now = new Date().toISOString();

  const existingSnapshot = await collection
    .where("questionLower", "==", questionLower)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const doc = existingSnapshot.docs[0];

    const update: FirebaseFirestore.UpdateData<KnowledgeRecord> = {
      answer: input.answer.trim(),
      updatedAt: now,
    };

    if (tags && tags.length > 0) {
      update.tags = tags;
    } else {
      update.tags = FieldValue.delete();
    }

    if (input.source) {
      update.source = input.source;
    }

    await doc.ref.update(update);
    const refreshed = await doc.ref.get();
    return sanitizeKnowledgeEntry(refreshed);
  }

  const docRef = collection.doc(randomUUID());
  const record: KnowledgeRecord = {
    id: docRef.id,
    question,
    answer: input.answer.trim(),
    source: input.source ?? "supervisor",
    createdAt: now,
    updatedAt: now,
    questionLower,
  };

  if (tags && tags.length > 0) {
    record.tags = tags;
  }

  await docRef.set(record);
  const saved = await docRef.get();
  return sanitizeKnowledgeEntry(saved);
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