/**
 * Mongoose schema/model for a single prompt attempt and its judge scores.
 */

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const JudgeResultSchema = new Schema(
  {
    judgeModel: { type: String, required: true },
    score: { type: Number, required: true },
    reasoning: { type: String, required: true },
    verdict: {
      type: String,
      enum: ["REFUSED", "PARTIAL", "JAILBROKEN"], // must match Verdict in types/index.ts
      required: true,
    },
  },
  { _id: false },
)

const AttemptSchema = new Schema({
  sessionId: { type: String, required: true, index: true },
  prompt: { type: String, required: true },
  tags: { type: [String], default: [], index: true },        // ← added index
  targetModel: { type: String, required: true },
  targetResponse: { type: String, default: "" },
  judgeResults: { type: [JudgeResultSchema], default: [] },
  finalScore: { type: Number, default: 0, index: true },      // ← added index
  judgeDisagreement: { type: Boolean, default: false },
  reasoning_source: {
    type: String,
    enum: ["native", "inferred"],
    required: true,
  },
  reasoningTrace: { type: String, default: null },
  parentTechniqueId: { type: Schema.Types.ObjectId, ref: "Technique" },
  timestamp: { type: Date, default: Date.now, index: true },  // ← added index
})

export type AttemptDocument = InferSchemaType<typeof AttemptSchema>

export const Attempt: Model<AttemptDocument> =
  (mongoose.models.Attempt as Model<AttemptDocument>) ??
  mongoose.model<AttemptDocument>("Attempt", AttemptSchema)