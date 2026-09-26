// GET /api/suggestions
// Tag-based "similar past attempts" suggestions for the Attack Composer panel.
// v1: plain Mongo query, $in on tags, sorted by finalScore desc, top 3-5.
// No vector DB — TODO: swap to MongoDB Atlas Vector Search here if tag-matching
// ever feels too crude (see overview.md "On the horizon").

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoClient";
import { Attempt } from "@/lib/models/Attempt";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 5;
const MIN_LIMIT = 3;

export const GET = async (req: NextRequest) => {
  try {
    await connectToDatabase();

    const { searchParams } = req.nextUrl;

    // Accept either repeated ?tag=a&tag=b or a single ?tag=a,b
    const rawTags = searchParams.getAll("tag");
    const tags = rawTags
      .flatMap((t) => t.split(","))
      .map((t) => t.trim())
      .filter(Boolean);

    // Free-text fallback/refinement over the prompt field. Kept simple
    // (case-insensitive substring match) — TODO: replace with real text
    // search (Atlas Search / $text index) if this gets noisy.
    const q = searchParams.get("q")?.trim();

    const limitParam = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitParam)
      ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limitParam))
      : DEFAULT_LIMIT;

    if (tags.length === 0 && !q) {
      // Nothing to match against yet — composer hasn't typed/tagged anything.
      // Return empty rather than an unfiltered "top attempts ever" list, so
      // the UI doesn't show misleadingly generic suggestions.
      return NextResponse.json({ suggestions: [] }, { status: 200 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (tags.length > 0) {
      filter.tags = { $in: tags };
    }

    if (q) {
      filter.prompt = { $regex: q, $options: "i" };
    }

    const matches = await Attempt.find(filter)
      .sort({ finalScore: -1 })
      .limit(limit)
      .select({
        prompt: 1,
        tags: 1,
        finalScore: 1,
        reasoning_source: 1,
        timestamp: 1,
      })
      .lean();

    const suggestions = matches.map((m) => ({
      id: String(m._id),
      prompt: m.prompt,
      tags: m.tags ?? [],
      historicalSuccessRate: m.finalScore ?? 0,
      reasoningSource: m.reasoning_source ?? "inferred",
      timestamp: m.timestamp,
    }));

    return NextResponse.json({ suggestions }, { status: 200 });
  } catch (err) {
    console.error("GET /api/suggestions failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
};