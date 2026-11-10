import mongoose, { Schema } from "mongoose";

const transactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },

    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "card", "upi", "netbanking", "other"],
      default: "upi",
    },
  },
  { timestamps: true },
);

// Optimizes user-specific transaction history and date sorting
transactionSchema.index({ userId: 1, transactionDate: -1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
