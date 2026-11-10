import mongoose, { Schema } from "mongoose";

/**
 * Budget Schema
 * Stored amounts in integer paise (₹1 = 100 paise)
 * month formatted as "YYYY-MM" (e.g., "2026-11")
 */
const budgetSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    limitPaise: {
      type: Number,
      required: [true, "Budget limit is required"],
      min: [1, "Budget limit must be greater than 0"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Budget limit must be a valid integer in paise",
      },
    },
    month: {
      type: String,
      required: [true, "Month is required"],
      trim: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format"],
    },
  },
  { timestamps: true }
);

// Ensure a user cannot create duplicate budgets for the same category in the same month
budgetSchema.index({ userId: 1, category: 1, month: 1 }, { unique: true });

export const Budget = mongoose.model("Budget", budgetSchema);

