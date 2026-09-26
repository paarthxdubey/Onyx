/**
 * Mongoose schema/model for a scoring session against a target model.
 * sessionId is server-generated (crypto.randomUUID()) and is what every
 * other collection (Attempt) keys off — never query Session by Mongo's own
 * _id. label is the human-readable display name (defaults to "Session N"
 * at creation, user-renamable via PATCH /api/sessions/[sessionId]).
 */

import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  label: { type: String, required: true },
  targetModel: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  attemptCount: { type: Number, default: 0 },
});

export type SessionDocument = InferSchemaType<typeof SessionSchema>;

export const Session: Model<SessionDocument> =
  (mongoose.models.Session as Model<SessionDocument>) ??
  mongoose.model<SessionDocument>("Session", SessionSchema);