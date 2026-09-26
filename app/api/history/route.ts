// GET /api/history?sessionId=...
// Chronological attempts for a session — feeds SessionDrawer's table and
// (via page.tsx) TrajectoryChart's score-over-turns.

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoClient";
import { Attempt } from "@/lib/models/Attempt";

export const GET = async (req: NextRequest) => {
  try {
    await connectToDatabase();

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const attempts = await Attempt.find({ sessionId })
      .sort({ timestamp: 1 })
      .select({ tags: 1, finalScore: 1, timestamp: 1 })
      .lean();

    const history = attempts.map((a, i) => ({
      turn: i + 1,
      // NOTE: this is the first tag, not a real technique name — Attempt
      // doesn't persist a technique display name, only raw tags.
      technique: a.tags?.[0] ?? "untagged",
      score: a.finalScore ?? 0,
      time: new Date(a.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    return NextResponse.json({ history }, { status: 200 });
  } catch (err) {
    console.error("GET /api/history failed:", err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
};