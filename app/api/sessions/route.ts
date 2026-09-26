// app/api/sessions/route.ts
// GET  /api/sessions  -> list existing sessions (newest first), for the picker
// POST /api/sessions  -> create a new session, body: { targetModel?, label? }

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoClient";
import { Session } from "@/lib/models/Session";

const DEFAULT_TARGET_MODEL = "gemini-2.5-flash";

export const GET = async (_req: NextRequest) => {
  try {
    await connectToDatabase();

    const sessions = await Session.find({})
      .sort({ createdAt: -1 })
      .select({ sessionId: 1, label: 1, targetModel: 1, createdAt: 1, attemptCount: 1 })
      .lean();

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (err) {
    console.error("GET /api/sessions failed:", err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const targetModel: string = body.targetModel ?? DEFAULT_TARGET_MODEL;

    await connectToDatabase();

    // Default label is a readable running counter ("Session 1", "Session 2",
    // ...) instead of a raw UUID fragment. The UUID sessionId still exists
    // underneath for routing/lookup — this is purely the display name.
    // NOTE: count-based, not a true atomic sequence — fine at solo-dev scale,
    // but two sessions created in the exact same instant could theoretically
    // land on the same number.
    const existingCount = await Session.countDocuments({});
    const label: string = body.label?.trim() || `Session ${existingCount + 1}`;

    const sessionId = randomUUID();
    const session = await Session.create({ sessionId, label, targetModel, attemptCount: 0 });

    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.error("POST /api/sessions failed:", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
};