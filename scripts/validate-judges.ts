// scripts/validate-judges.ts
// Runs the real judgeRunner + scorer against a hand-labeled validation set
// and reports agreement stats. Run with: tsx scripts/validate-judges.ts
//
// This does NOT call the target model — targetResponse is already fixed
// in the labeled set. It only tests judge quality.

console.log("SCRIPT ENTRY POINT REACHED");

import { readFileSync } from "fs";
import { join } from "path";
import { score as judgeScore } from "../lib/server/judgeRunner";
import { aggregate } from "../lib/server/scorer";

import type { Verdict } from "../types";
// Verdict = "REFUSED" | "PARTIAL" | "JAILBROKEN" — REFUSED means the target's
// guardrails held (low score), JAILBROKEN means they gave way (high score).
// See judgeRunner.ts for the score bands this is derived from.

type ValidationEntry = {
  id: string;
  prompt: string;
  targetResponse: string;
  targetModel: string;
  difficulty: "clear-refusal" | "clear-jailbreak" | "ambiguous";
  humanLabel: {
    verdict: Verdict;
    score: number;
    notes: string;
  };
};

export const runValidation = async () => {
  const setPath = join(process.cwd(), "data", "validation-set.json");
  const entries: ValidationEntry[] = JSON.parse(readFileSync(setPath, "utf-8"));

  const results: {
    id: string;
    difficulty: string;
    humanVerdict: Verdict;
    humanScore: number;
    judgeVerdict: string;
    judgeScore: number;
    judgeDisagreement: boolean;
    verdictMatch: boolean;
    scoreError: number;
  }[] = [];

  for (const entry of entries) {
    // TODO: judgeRunner.score's real signature — confirm (prompt, response)
    // matches what you actually wired in route.ts
    const judgeResults = await judgeScore(entry.prompt, entry.targetResponse);
    const { finalScore, judgeDisagreement } = aggregate(judgeResults);

    // Majority verdict across the judge ensemble, for comparison against
    // the human label. Falls back to the first judge's verdict on a tie.
    const verdictCounts = new Map<string, number>();
    for (const jr of judgeResults) {
      verdictCounts.set(jr.verdict, (verdictCounts.get(jr.verdict) ?? 0) + 1);
    }
    const majorityVerdict = [...verdictCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0][0];

    results.push({
      id: entry.id,
      difficulty: entry.difficulty,
      humanVerdict: entry.humanLabel.verdict,
      humanScore: entry.humanLabel.score,
      judgeVerdict: majorityVerdict,
      judgeScore: finalScore,
      judgeDisagreement,
      verdictMatch: majorityVerdict === entry.humanLabel.verdict,
      scoreError: Math.abs(finalScore - entry.humanLabel.score),
    });
  }

  // --- Summary stats ---
  const total = results.length;
  const verdictMatches = results.filter((r) => r.verdictMatch).length;
  const meanAbsScoreError =
    results.reduce((sum, r) => sum + r.scoreError, 0) / total;

  const ambiguous = results.filter((r) => r.difficulty === "ambiguous");
  const ambiguousFlaggedRate =
    ambiguous.filter((r) => r.judgeDisagreement).length / (ambiguous.length || 1);

  const clearCases = results.filter((r) => r.difficulty !== "ambiguous");
  const clearFalseFlagRate =
    clearCases.filter((r) => r.judgeDisagreement).length / (clearCases.length || 1);

  // Per-verdict confusion (simple counts, not a full matrix — enough to spot bias)
  const confusion: Record<string, Record<string, number>> = {};
  for (const r of results) {
    confusion[r.humanVerdict] = confusion[r.humanVerdict] ?? {};
    confusion[r.humanVerdict][r.judgeVerdict] =
      (confusion[r.humanVerdict][r.judgeVerdict] ?? 0) + 1;
  }

  console.log("\n=== Judge Validation Results ===\n");
  console.table(results);

  console.log(`\nVerdict agreement: ${verdictMatches}/${total} (${(
    (verdictMatches / total) *
    100
  ).toFixed(1)}%)`);
  console.log(`Mean absolute score error: ${meanAbsScoreError.toFixed(1)} pts`);
  console.log(
    `judgeDisagreement correctly flagged ambiguous cases: ${(
      ambiguousFlaggedRate * 100
    ).toFixed(1)}% (want this high)`
  );
  console.log(
    `judgeDisagreement false-flagged clear cases: ${(
      clearFalseFlagRate * 100
    ).toFixed(1)}% (want this low)`
  );
  console.log("\nConfusion (human label -> judge majority verdict):");
  console.table(confusion);

  // TODO: decide your own pass bar, e.g. >=80% verdict agreement and
  // <=15pt mean score error before trusting the judges for the dashboard
};

runValidation().catch((err) => {
  console.error("Validation run failed:", err);
  process.exit(1);
});