import { NextResponse } from "next/server";

import {
  listKnowledgeEntries,
  searchKnowledgeEntries,
  upsertKnowledgeEntry,
  type UpsertKnowledgeEntryInput,
} from "@/lib/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limitParam = searchParams.get("limit");

  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  if (query && query.trim().length > 0) {
    const results = await searchKnowledgeEntries(query, limit ?? 5);
    return NextResponse.json(results);
  }

  const all = await listKnowledgeEntries();
  return NextResponse.json(all.slice(0, limit ?? all.length));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UpsertKnowledgeEntryInput;

    if (!body?.question || !body?.answer) {
      return NextResponse.json(
        { error: "question and answer are required" },
        { status: 400 },
      );
    }

    const result = await upsertKnowledgeEntry({
      question: body.question,
      answer: body.answer,
      tags: body.tags,
      source: body.source,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to upsert knowledge entry", error);
    return NextResponse.json(
      { error: "Failed to upsert knowledge entry" },
      { status: 500 },
    );
  }
}
