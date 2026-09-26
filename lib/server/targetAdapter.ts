/**
 * targetAdapter.ts
 * Provider-agnostic adapter for calling the "target" LLM under test.
 * Supports Groq and Gemini free-tier APIs. The rest of the app only
 * calls sendPrompt() and never needs to know which provider is active.
 *
 * FIX (rate limits / hangs): both provider calls now go through
 * fetchWithRetry instead of raw fetch — adds a 20s timeout per attempt and
 * automatic retry-with-backoff on 429s, which free-tier Groq/Gemini return
 * under real load. See lib/server/fetchWithRetry.ts.
 */

import type { ReasoningSource } from "@/types";
import { fetchWithRetry } from "@/lib/server/fetchWithRetry";

export interface TargetAdapterResult {
  responseText: string;
  reasoningTrace: string | null;
  reasoningSource: ReasoningSource; // "native" | "inferred"
  provider: string;
  modelUsed: string;
}

type Provider = "groq" | "gemini";

function getProvider(): Provider {
  const provider = (process.env.TARGET_LLM_PROVIDER || "").toLowerCase();
  if (provider === "groq" || provider === "gemini") return provider as Provider;
  throw new Error(
    `TARGET_LLM_PROVIDER must be "groq" or "gemini", got: "${process.env.TARGET_LLM_PROVIDER}"`
  );
}

export async function sendPrompt(
  prompt: string,
  targetModel: string
): Promise<TargetAdapterResult> {
  const provider = getProvider();
  return provider === "groq" ? callGroq(prompt, targetModel) : callGemini(prompt, targetModel);
}

// ---------- Groq ----------

async function callGroq(prompt: string, model: string): Promise<TargetAdapterResult> {
  const apiKey = process.env.TARGET_LLM_API_KEY;
  if (!apiKey) throw new Error("TARGET_LLM_API_KEY is not set");

  const res = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      // "parsed" puts reasoning in its own field (message.reasoning) instead of
      // inline <think> tags. Non-reasoning models just ignore this param.
      reasoning_format: "parsed",
      temperature: 0.7,
      max_completion_tokens: 1024,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  if (!message) throw new Error("Groq API returned no message in response");

  const reasoningTrace: string | null = message.reasoning ?? null;

  return {
    responseText: message.content ?? "",
    reasoningTrace,
    // TODO (Step 3): once judgeRunner exists, a missing native trace should
    // fall back to judge-LLM narration before this is labeled "inferred".
    // For now, absence of a native trace just means "no trace captured".
    reasoningSource: reasoningTrace ? "native" : "inferred",
    provider: "groq",
    modelUsed: model,
  };
}

// ---------- Gemini ----------

async function callGemini(prompt: string, model: string): Promise<TargetAdapterResult> {
  const apiKey = process.env.TARGET_LLM_API_KEY;
  if (!apiKey) throw new Error("TARGET_LLM_API_KEY is not set");

  // FIX: was hardcoded to "gemini-2.5-flash" regardless of what was passed in —
  // now uses the actual `model` argument so targetModel from the request body
  // is respected instead of silently ignored.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // Only honored by "thinking" models (gemini-2.5-flash, gemini-3-flash-preview, etc.)
        thinkingConfig: { includeThoughts: true },
        // FIX: added maxOutputTokens. Without an explicit budget, thinking mode
        // can consume the entire token allowance on internal reasoning and leave
        // nothing for the actual answer — producing an empty responseText with
        // finishReason "MAX_TOKENS". This was the likely cause of targetResponse
        // coming back as "".
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();

  // TODO: temporary debug log — remove once responseText is reliably non-empty
  // across several test runs. finishReason "STOP" = normal completion,
  // "MAX_TOKENS" = truncated (the bug this fix targets), "SAFETY" = blocked
  // (candidates may have no parts at all in that case, a separate issue).
  console.log("Gemini finishReason:", data?.candidates?.[0]?.finishReason);

  const parts = data?.candidates?.[0]?.content?.parts ?? [];

  let responseText = "";
  let reasoningTrace = "";

  for (const part of parts) {
    if (!part.text) continue;
    if (part.thought) reasoningTrace += part.text;
    else responseText += part.text;
  }

  return {
    responseText,
    reasoningTrace: reasoningTrace || null,
    reasoningSource: reasoningTrace ? "native" : "inferred",
    provider: "gemini",
    modelUsed: model,
  };
}