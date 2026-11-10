import mongoose from "mongoose";

const passwordAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Keeps login and password-change attempts separate.
    attemptType: {
      type: String,
      enum: ["login", "changePassword"],
      required: true,
    },

    failedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// One record per user per attempt type.
passwordAttemptSchema.index({ userId: 1, attemptType: 1 }, { unique: true });

// Automatically remove inactive attempt records after 24 hours.
passwordAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export const PasswordAttempt = mongoose.model(
  "PasswordAttempt",
  passwordAttemptSchema,
);
