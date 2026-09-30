// app/api/attempt/route.ts
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongoClient";
import { Attempt } from "@/lib/models/Attempt";
import { Session } from "@/lib/models/Session";
import { sendPrompt } from "@/lib/server/targetAdapter";
import { score as runJudge } from "@/lib/server/judgeRunner";
import { aggregate } from "@/lib/server/scorer";
import type { ReasoningSource } from "@/types";

// Models/providers known to expose genuine reasoning traces.
// TODO: expand this list as you wire up targets that support it
// (e.g. Claude extended thinking, OpenAI o-series, DeepSeek-R1, Gemini thinking mode).
// Currently empty because Groq/Gemini free-tier models don't expose native reasoning.
const NATIVE_REASONING_MODELS: string[] = [
  // "gemini-2.0-flash-thinking-exp", // example — uncomment/add once you test this
];

function getReasoningSource(targetModel: string): ReasoningSource {
  return NATIVE_REASONING_MODELS.includes(targetModel) ? "native" : "inferred";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, sessionId, tags } = body;

    // FIX: targetModel was read from the body but never validated or
    // defaulted — if the caller omitted it, `undefined` flowed all the way
    // through to Attempt.create() and only failed there, after the target
    // + judge API calls had already run (wasted cost + a confusing 500).
    // Default it from env so manual/curl testing doesn't need to specify it
    // every time, but still require SOME value be resolvable.
    const targetModel: string | undefined =
      body.targetModel ?? process.env.TARGET_LLM_MODEL;

    if (!prompt || !sessionId) {
      return NextResponse.json(
        { error: "prompt and sessionId are required" },
        { status: 400 }
      );
    }

    if (!targetModel) {
      return NextResponse.json(
        {
          error:
            "targetModel is required — pass it in the request body or set TARGET_LLM_MODEL in your env.",
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Look up the session by the string field, NOT _id — sessionId is a
    // client-generated free-form string, never a Mongo ObjectId.
    let session = await Session.findOne({ sessionId });
    if (!session) {
      session = await Session.create({ sessionId, targetModel, attemptCount: 0 });
    }

    // 1. Hit the target model
    const targetResponse = await sendPrompt(prompt, targetModel);

    // 2. Send prompt + response to judge(s)
    const judgeResults = await runJudge(prompt, targetResponse.responseText);
    // TODO: once judgeRunner.ts supports multiple judges (2-3 ensemble),
    // judgeResults will naturally be an array of >1 — no change needed here,
    // but double check aggregate() handles variance correctly with more entries.

    // 3. Aggregate into a final score + disagreement flag
    const { finalScore, judgeDisagreement } = aggregate(judgeResults);

    // 4. Determine whether this model gives real reasoning traces or we're inferring
    const reasoning_source = getReasoningSource(targetModel);
    // TODO: if you add a native-reasoning model, also check whether targetAdapter.ts
    // needs to return the raw reasoning trace alongside targetResponse (right now it
    // only returns the final text) — you'd extend sendPrompt's return type to
    // { text: string; reasoningTrace?: string } and store reasoningTrace on Attempt.

    // 5. Persist the full record
    const attempt = await Attempt.create({
      sessionId,
      prompt,
      tags: tags ?? [],
      targetModel,
      targetResponse: targetResponse.responseText,
      judgeResults,
      finalScore, // number | undefined — matches InferSchemaType, don't cast to null
      judgeDisagreement,
      reasoning_source,
    });

    // Keep Session.attemptCount live rather than computed lazily elsewhere.
    // Query by the string field here too, not _id.
    await Session.findOneAndUpdate(
      { sessionId },
      { $inc: { attemptCount: 1 } }
    );

    return NextResponse.json(attempt, { status: 201 });
  } catch (err) {
    console.error("=== POST /api/attempt failed ===");
    console.error(err instanceof Error ? err.stack : err);
    console.error("================================");
    return NextResponse.json(
      { error: "Failed to process attempt" },
      { status: 500 }
    );
  }
}
export const maxDuration = 60;