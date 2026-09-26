/**
 * Shared TypeScript types for attempts, techniques, sessions, and judge scoring.
 */

export type ReasoningSource = "native" | "inferred"

export type Verdict = "REFUSED" | "PARTIAL" | "JAILBROKEN"

export interface JudgeResult {
  judgeModel: string
  score: number
  reasoning: string
  verdict: Verdict
}

export interface Attempt {
  sessionId: string
  prompt: string
  tags: string[]
  targetModel: string
  targetResponse: string
  judgeResults: JudgeResult[]
  finalScore: number
  judgeDisagreement: boolean
  reasoning_source: ReasoningSource
  parentTechniqueId?: string
  timestamp: Date | string
}

export interface Technique {
  name: string
  category: string
  description: string
  tags: string[]
  historicalAvgScore: number
  usageCount: number
}

export interface Session {
  targetModel: string
  createdAt: Date | string
  attemptCount: number
}

export interface TargetAdapterResult {
  responseText: string;
  reasoningTrace: string | null;
  reasoningSource: ReasoningSource;
  provider: string;
  modelUsed: string;
}

export type Suggestion = {
  id: string;
  prompt: string;
  tags: string[];
  historicalSuccessRate: number;
  reasoningSource: ReasoningSource;
  timestamp: string;
};