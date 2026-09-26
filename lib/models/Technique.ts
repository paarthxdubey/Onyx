/**
 * Mongoose schema/model for reusable prompt techniques and their stats.
 */

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose"

const TechniqueSchema = new Schema({
  name: { type: String, required: true, unique: true },
  category: { type: String, required: true, index: true },   // ← added index
  description: { type: String, default: "" },
  tags: { type: [String], default: [], index: true },        // ← added index
  historicalAvgScore: { type: Number, default: 0 },
  usageCount: { type: Number, default: 0 },
})

export type TechniqueDocument = InferSchemaType<typeof TechniqueSchema>

export const Technique: Model<TechniqueDocument> =
  (mongoose.models.Technique as Model<TechniqueDocument>) ??
  mongoose.model<TechniqueDocument>("Technique", TechniqueSchema)
