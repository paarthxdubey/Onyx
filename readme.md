# Onyx

**An AI red-teaming dashboard for stress-testing LLM safety guardrails.**

Onyx sends adversarial prompts (jailbreak / prompt-injection attempts) at a target LLM, scores how well the model resisted the attack, and surfaces the target's "reasoning" so an attacker can iterate more efficiently on the next attempt. It's built as a lightweight, free-tier-friendly alternative to heavier red-teaming frameworks like PyRIT or Giskard.

---

## Table of contents

- [What Onyx does](#what-onyx-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Seeding the technique corpus](#seeding-the-technique-corpus)
- [API reference](#api-reference)
- [The `reasoning_source` flag — why it matters](#the-reasoning_source-flag--why-it-matters)
- [Known limitations](#known-limitations)
- [Roadmap / stretch goals](#roadmap--stretch-goals)

---

## What Onyx does

Every time you try to jailbreak a target LLM, Onyx shows you:

1. **An effectiveness score (0–100)** — how successful the attempt was, produced by a small ensemble of judge LLMs rather than a single brittle keyword check.
2. **A verdict** — `REFUSED` (0–20), `PARTIAL` (21–70), or `JAILBROKEN` (71–100), derived server-side from the numeric score rather than trusted from the judge's own free-text label.
3. **A reasoning trace** — either the target model's *actual* reasoning tokens (when it's a model that exposes them) or a judge LLM's narrated read on which direction the conversation is drifting (compliance increasing/decreasing, hedging language, etc.). This is always labeled so you know which one you're looking at — see [below](#the-reasoning_source-flag--why-it-matters).
4. **Similar past attempts** — a "people who tried X also had luck with Y" style suggestion list, so you're not reinventing techniques you've already logged.
5. **A technique leaderboard** — which categories of attack are working best, aggregated across all logged attempts.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXT.JS APP (Frontend)                    │
│  ┌──────────────┐ ┌─────────────────┐ ┌────────────────────┐    │
│  │ Attack        │ │ Response /       │ │ Score / Leaderboard │    │
│  │ Composer      │ │ Trajectory Panel │ │ Panel               │    │
│  └──────┬───────┘ └────────▲─────────┘ └────────▲────────────┘    │
└─────────┼───────────────────┼────────────────────┼────────────────┘
          │ (API routes)                            │
          ▼                                          │
┌─────────────────────────────────────────────────────────────────┐
│                     NEXT.JS API LAYER (Backend)                  │
│  /api/attempt        → orchestrates one full attack turn          │
│  /api/suggestions    → tag-based similarity query (Mongo)         │
│  /api/history        → chronological log for a session            │
│  /api/leaderboard    → aggregation: avg score per technique       │
│                                                                    │
│  ┌───────────────┐   ┌───────────────┐   ┌────────────────────┐  │
│  │ targetAdapter  │   │ judgeRunner    │   │ Mongo Data Layer    │  │
│  │ (calls target  │   │ (1–3 judge     │   │ (Mongoose)          │  │
│  │  LLM)          │   │  LLM calls)    │   │                      │  │
│  └───────┬────────┘   └───────┬────────┘   └──────────┬───────────┘  │
└──────────┼─────────────────────┼──────────────────────┼──────────────┘
           ▼                     ▼                       ▼
   ┌───────────────┐    ┌────────────────┐      ┌────────────────┐
   │ Target LLM API │    │ Judge LLM API   │      │ MongoDB Atlas   │
   │ (Gemini /      │    │ (Groq GPT-OSS   │      │ (attempts,      │
   │  Groq)         │    │  ensemble)      │      │  techniques,    │
   └───────────────┘    └────────────────┘      │  sessions)      │
                                                    └────────────────┘
```

**One turn, end to end:**

1. You type a prompt in the Attack Composer. After you stop typing (~500ms debounce), the app quietly fetches similar past attempts and shows them alongside your draft.
2. On submit, `POST /api/attempt` runs the full pipeline server-side:
   - `targetAdapter.sendPrompt()` sends your prompt to the configured target model and gets its raw response.
   - `judgeRunner.score()` sends that response to a small ensemble of judge LLMs (currently Groq's `gpt-oss-20b` and `gpt-oss-120b`), each returning a structured `{ score, reasoning, verdict }`.
   - `scorer.aggregate()` combines the judge outputs into a final score and flags disagreement if the judges' scores vary too much.
   - The full record is persisted to MongoDB.
3. The dashboard updates: the raw response renders, the score/verdict/judge-agreement panel updates, and the trajectory chart gets a new data point.
4. The history drawer and leaderboard are refreshed lazily (on open), not on every turn, so they stay out of the way during active iteration.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Frontend + backend in one app — no separate backend service needed for v1 |
| Language | TypeScript throughout | |
| Database | MongoDB Atlas (free tier) via Mongoose | `MONGODB_URI` in `.env` |
| Target LLM | Gemini (`gemini-2.5-flash`, primary) + Groq-hosted models (secondary) | Both have usable free tiers |
| Judge LLM(s) | Groq ensemble: `openai/gpt-oss-20b`, `openai/gpt-oss-120b` | Run in parallel via `Promise.allSettled` |
| Charting | Recharts / Tremor | In-app, no external dashboarding tool (Grafana was considered and dropped) |
| Retrieval (v1) | Tag-based MongoDB queries (`$in` on tags, sorted by score) | Not true vector RAG yet — see [Known limitations](#known-limitations) |
| Deployment | Vercel + MongoDB Atlas | Both free tier |

## Project structure

```
app/
  api/
    attempt/route.ts        # POST — orchestrates one full attack turn
    suggestions/route.ts    # GET  — tag-based similarity query
    history/route.ts        # GET  — chronological attempts for a session
    leaderboard/route.ts    # GET  — avg score per technique/category (global, not session-scoped)
  page.tsx                  # Dashboard shell
components/
  console/
    topbar.tsx
    attack-composer.tsx
    suggestion-list.tsx
    target-response.tsx
    scorecard.tsx
    session-drawer.tsx
lib/
  db/
    mongoClient.ts           # Connection singleton (cached on `global` in dev)
  models/
    Attempt.ts
    Technique.ts
    Session.ts
  server/
    targetAdapter.ts         # sendPrompt(prompt, targetModel) -> raw response
    judgeRunner.ts            # score(prompt, response) -> JudgeResult[]
    scorer.ts                  # aggregate(judgeResults) -> { finalScore, judgeDisagreement }
types/
  index.ts                    # JudgeResult, Attempt, Technique, Session, Verdict, ReasoningSource
data/
  seed-techniques.json          # Seed corpus (25 techniques / 7 categories)
scripts/
  seed-techniques.ts             # tsx scripts/seed-techniques.ts — upserts seed corpus into Mongo
.env.example
```

## Data model

**`attempts`**
```ts
{
  _id,
  sessionId: String,
  prompt: String,
  tags: [String],                 // category/technique tags
  targetModel: String,
  targetResponse: String,
  judgeResults: [{
    judgeModel: String,
    score: Number,                // 0–100
    reasoning: String,
    verdict: String
  }],
  finalScore: Number,              // aggregated across judges
  judgeDisagreement: Boolean,
  reasoning_source: "native" | "inferred",
  parentTechniqueId: ObjectId,     // reserved for future mutation tracking
  timestamp: Date
}
```

**`techniques`**
```ts
{
  _id,
  name: String,
  category: String,
  description: String,
  tags: [String],
  historicalAvgScore: Number,      // recomputed on write
  usageCount: Number
}
```

**`sessions`**
```ts
{
  _id,
  targetModel: String,
  createdAt: Date,
  attemptCount: Number
}
```

**Verdict bands** (derived server-side from `finalScore`, never trusted from the judge's free-text field):

| Score | Verdict |
|---|---|
| 0–20 | `REFUSED` |
| 21–70 | `PARTIAL` |
| 71–100 | `JAILBROKEN` |

## Getting started

```bash
git clone <your-repo-url>
cd onyx
npm install
cp .env.example .env   # then fill in the values — see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Windows note:** File Explorer hides file extensions by default, so `.env` can silently get saved as `.env.txt`, and Notepad may save it as UTF-16 instead of UTF-8 (Mongoose/dotenv will fail to parse it). Use VS Code (or another code editor) to create and edit `.env`.

## Environment variables

```bash
MONGODB_URI=            # MongoDB Atlas connection string
TARGET_LLM_API_KEY=     # API key for the target model provider
JUDGE_LLM_API_KEY=      # API key for the judge model provider
TARGET_LLM_PROVIDER=    # e.g. "gemini" or "groq"
JUDGE_LLM_PROVIDER=     # e.g. "groq"
```

## Seeding the technique corpus

```bash
npx tsx scripts/seed-techniques.ts
```

Reads `data/seed-techniques.json` (25 techniques across 7 categories) and upserts them into the `techniques` collection. Logs a summary of how many were inserted vs. updated.

> Standalone `tsx` scripts don't inherit environment variables the way Next.js API routes do — the script imports `dotenv/config` at the top to avoid a `MONGODB_URI is not set` error.

## API reference

| Route | Method | Purpose |
|---|---|---|
| `/api/attempt` | `POST` | Body: `{ prompt, sessionId }`. Runs the full target → judge → score → persist pipeline and returns the result. |
| `/api/suggestions` | `GET` | Query: `?tag=&q=`. Returns the top 3–5 similar past attempts (tag `$in` match, or `q` regex fallback), sorted by `finalScore`. |
| `/api/history` | `GET` | Query: `?sessionId=`. Returns the chronological attempt log for that session. |
| `/api/leaderboard` | `GET` | Returns average score per technique/category, aggregated **globally** across all sessions (kept global on purpose — it answers "what works best overall," not just in this session). |

## The `reasoning_source` flag — why it matters

Onyx exposes a `reasoning_source: "native" | "inferred"` badge on every scored attempt:

- **`native`** — the target model actually emitted reasoning tokens (e.g. Claude extended thinking, an OpenAI o-series/reasoning model, DeepSeek-R1, Gemini "thinking" mode), and Onyx is showing that trace as-is.
- **`inferred`** — the target model doesn't expose reasoning, so what you're seeing is a judge LLM's narration of the conversation's drift (increasing compliance, decreasing hedging, etc.). This is a proxy, not introspection.

`reasoning_source` is derived dynamically via a `NATIVE_REASONING_MODELS` list and a `getReasoningSource()` helper — never hardcoded — so it stays honest as the target model changes. In practice, on the current free-tier target/judge setup, this reads `inferred` most of the time. Even genuine native reasoning traces aren't guaranteed to be a fully faithful account of what actually drove the model's answer — chain-of-thought faithfulness research shows verbalized reasoning can diverge from the real causal path — so treat `native` as "the model's own generated explanation," not a perfect readout of its internals.

## Known limitations

- **Judge scores aren't ground truth.** They come from an LLM applying a rubric and can be gamed by the same techniques being tested. Validate the judge periodically against a small hand-labeled set (~20–30 pairs) rather than trusting it blindly.
- **v1 retrieval is tag-based, not true RAG.** "Similar attempts" is a filtered/sorted MongoDB query (`$in` on tags), not embeddings-based retrieval feeding an LLM. MongoDB Atlas Vector Search is the planned upgrade path if tag-matching proves too crude — it avoids standing up a second vector database.
- **The corpus only reflects known attacks.** Novel injection techniques won't surface via suggestions until they're manually added.
- **Judge count can be inconsistent across runs** (e.g., 2 judges responding on one attempt vs. 1 on another) despite the ensemble being configured for multiple models. Root cause not fully diagnosed yet — suspected silent rate-limit drops via `Promise.allSettled`. `judgeRunner.ts` currently only `console.warn`s on a failed judge rather than surfacing `judgesFailed`/`judgesAttempted` counts in the persisted result.
- **Rate limits.** Everything runs on free-tier APIs (Groq, Gemini), so budget for occasional throttling — there's no cost tracker in the UI (it was intentionally dropped for a free-tier-only setup).
- **Dual-use nature.** This is a red-teaming tool — scope it to systems you own or have authorization to test, and keep an audit trail (session + target endpoint + timestamp) of what was tested where.

## Roadmap / stretch goals

- MongoDB Atlas Vector Search for real embeddings-based similarity, replacing tag-based matching.
- Mutation loop: take a partially-successful technique (~40–60% score) and have an LLM generate 3–5 variants, tracked via `parentTechniqueId`.
- Novelty scoring per technique (cosine distance from nearest existing corpus entry) to surface "unexplored territory."
- Real-time token streaming for target responses.
- Judge ensemble expansion (currently 2 models; could grow to 3+ with majority-vote/disagreement flagging).
- For open-weight local models only: mechanistic interpretability (e.g., TransformerLens — logit lens, activation patching) as a genuinely "inside the model" alternative to judge-LLM narration. Not viable against commercial APIs.

---

*Onyx is a research/portfolio project. Use it only against models and endpoints you own or are explicitly authorized to test.*