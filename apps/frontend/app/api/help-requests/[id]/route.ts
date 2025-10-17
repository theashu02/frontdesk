import { NextResponse } from "next/server";

import {
  addAnswerToKnowledgeBase,
  getHelpRequest,
  updateHelpRequest,
} from "@/lib/store";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const item = await getHelpRequest(context.params.id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const id = context.params.id;

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = await getHelpRequest(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body?.action === "timeout") {
      const updated = await updateHelpRequest(id, { action: "timeout" });
      return NextResponse.json(updated);
    }

    if (!body?.answer || typeof body.answer !== "string") {
      return NextResponse.json(
        { error: "answer is required when resolving" },
        { status: 400 },
      );
    }

    const updated = await updateHelpRequest(id, {
      answer: body.answer,
      supervisorName:
        typeof body.supervisorName === "string" ? body.supervisorName : undefined,
      supervisorNotes:
        typeof body.supervisorNotes === "string"
          ? body.supervisorNotes
          : undefined,
    });

    const shouldAdd =
      body.shouldAddToKnowledgeBase === undefined
        ? true
        : Boolean(body.shouldAddToKnowledgeBase);

    if (shouldAdd && updated.answer) {
      const tags =
        Array.isArray(body.tags) && body.tags.length
          ? body.tags.filter((tag: unknown): tag is string => typeof tag === "string")
          : undefined;
      await addAnswerToKnowledgeBase(updated.question, updated.answer, tags);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update help request", error);
    return NextResponse.json(
      { error: "Failed to update help request" },
      { status: 500 },
    );
  }
}
