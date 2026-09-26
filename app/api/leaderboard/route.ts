// GET /api/leaderboard
// Avg score per technique tag, across all sessions — "which techniques
// work best overall." Simple aggregation, no ML.

import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoClient";
import { Attempt } from "@/lib/models/Attempt";

const TOP_N = 6;

export const GET = async () => {
  try {
    await connectToDatabase();

    const rows = await Attempt.aggregate([
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          avgScore: { $avg: "$finalScore" },
          count: { $sum: 1 },
        },
      },
      { $sort: { avgScore: -1 } },
      { $limit: TOP_N },
    ]);

    const leaderboard = rows.map((r) => ({
      cat: r._id as string,
      pct: Math.round(r.avgScore),
    }));

    return NextResponse.json({ leaderboard }, { status: 200 });
  } catch (err) {
    console.error("GET /api/leaderboard failed:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
};