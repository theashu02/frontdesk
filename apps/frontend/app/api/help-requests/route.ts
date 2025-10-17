import { NextResponse } from "next/server";

import {
  createHelpRequest,
  listHelpRequests,
  type CreateHelpRequestInput,
} from "@/lib/store";
import type { HelpRequestStatus } from "@/lib/types";

const VALID_STATUS: Array<HelpRequestStatus | "all"> = [
  "pending",
  "resolved",
  "timeout",
  "all",
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusParam = (searchParams.get("status") ?? "pending").toLowerCase();

  if (!VALID_STATUS.includes(statusParam as HelpRequestStatus | "all")) {
    return NextResponse.json(
      { error: "Invalid status filter" },
      { status: 400 },
    );
  }

  const data = await listHelpRequests(statusParam as HelpRequestStatus | "all");
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateHelpRequestInput;

    if (!payload?.question || typeof payload.question !== "string") {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 },
      );
    }

    const entry = await createHelpRequest({
      question: payload.question,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      channel: payload.channel,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Failed to create help request", error);
    return NextResponse.json(
      { error: "Failed to create help request" },
      { status: 500 },
    );
  }
}
