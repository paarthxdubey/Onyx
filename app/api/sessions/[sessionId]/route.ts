// app/api/sessions/[sessionId]/route.ts
// PATCH  -> rename a session, body: { label }
// DELETE -> delete a session AND every Attempt tied to it (cascade)
//
// CASCADE ASSUMPTION: this is an irreversible data-loss decision, made
// deliberately rather than silently — orphaned Attempt docs with no parent
// Session seemed worse for a tool built around reviewing session history.
//
// FIX: params is now a Promise in this Next.js version (App Router dynamic
// route context), not a plain object — must be awaited before destructuring.

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoClient";
import { Session } from "@/lib/models/Session";
import { Attempt } from "@/lib/models/Attempt";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export const PATCH = async (req: NextRequest, { params }: RouteParams) => {
  try {
    const { sessionId } = await params;
    const body = await req.json().catch(() => ({}));
    const label: string | undefined = body.label?.trim();

    if (!label) {
      return NextResponse.json({ error: "label is required" }, { status: 400 });
    }

    await connectToDatabase();

    const updated = await Session.findOneAndUpdate({ sessionId }, { label }, { new: true });

    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    console.error("PATCH /api/sessions/[sessionId] failed:", err);
    return NextResponse.json({ error: "Failed to rename session" }, { status: 500 });
  }
};

export const DELETE = async (_req: NextRequest, { params }: RouteParams) => {
  try {
    const { sessionId } = await params;

    await connectToDatabase();

    const deleted = await Session.findOneAndDelete({ sessionId });
    if (!deleted) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { deletedCount } = await Attempt.deleteMany({ sessionId });

    return NextResponse.json(
      { deleted: true, sessionId, attemptsDeleted: deletedCount },
      { status: 200 }
    );
  } catch (err) {
    console.error("DELETE /api/sessions/[sessionId] failed:", err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
};