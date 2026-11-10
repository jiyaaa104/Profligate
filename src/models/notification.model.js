import mongoose, { Schema } from "mongoose";
const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 500,
    },

    type: {
      type: String,
      enum: ["daily_limit", "budget_alert", "system"],
      required: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
    dedupeKey: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

// Fetch a user's notifications, newest first.
notificationSchema.index({ userId: 1, createdAt: -1 });

// Fetch unread notifications for a specific user.
notificationSchema.index({ userId: 1, isRead: 1 });

export const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

