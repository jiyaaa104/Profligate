import mongoose from "mongoose";

/**
 * RefreshToken — persisted refresh-token store.
 *
 * Why a separate collection (not inline on User)?
 * - Allows multiple active sessions per user (different devices).
 * - Enables true token rotation: on refresh, delete the old document
 *   and create a new one, so a stolen token cannot be reused.
 * - TTL index auto-expires documents so the collection self-cleans
 *   without a cron job.
 *
 * Adopted from Streakies auth infrastructure; adapted to Profligate
 * naming conventions and export style.
 */

const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // speeds up lookups when invalidating all sessions for a user
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// MongoDB TTL index: automatically removes the document once
// the wall-clock time passes expiresAt. expireAfterSeconds: 0
// means "delete at the expiresAt timestamp exactly".
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

