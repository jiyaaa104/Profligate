import mongoose, { Schema } from "mongoose";

// A bill that repeats every month on the same day (rent, phone, Netflix…).
// The runway forecast sets unpaid bills aside before the next allowance.
const fixedCostSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [60, "Name cannot exceed 60 characters"],
    },

    amountPaise: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be greater than 0"],
      validate: {
        validator: Number.isSafeInteger,
        message: "Amount must be a valid integer in paise",
      },
    },

    // Day of the month it's due (1-31). A "31st" bill falls on the last day
    // of shorter months.
    dueDay: {
      type: Number,
      required: [true, "Due day is required"],
      min: [1, "Due day must be between 1 and 31"],
      max: [31, "Due day must be between 1 and 31"],
      validate: {
        validator: Number.isInteger,
        message: "Due day must be a whole number",
      },
    },

    // Category used for the expense when the bill is marked as paid.
    category: {
      type: String,
      trim: true,
      default: "Other",
    },

    // Latest month paid ("YYYY-MM"). Months up to and including this one
    // are treated as paid.
    lastPaidPeriod: {
      type: String,
      default: null,
    },

    // The expense created by the latest "Mark paid", and the period that was
    // paid before it, so deleting that expense can undo the payment.
    lastPaidTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    previousPaidPeriod: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

fixedCostSchema.index({ userId: 1 });

export const FixedCost = mongoose.model("FixedCost", fixedCostSchema);
