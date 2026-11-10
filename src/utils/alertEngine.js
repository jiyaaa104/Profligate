import mongoose from "mongoose";

import { User } from "../models/user.models.js";
import { Transaction } from "../models/transaction.model.js";
import { Notification } from "../models/notification.model.js";

// Get date components in the user's timezone.
const getDateParts = (date, timezone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
};

// Convert a local date/time in a timezone into a UTC Date.
const zonedDateTimeToUtc = (year, month, day, timezone) => {
  const target = Date.UTC(year, month - 1, day);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let result = target;

  // Iteratively correct the UTC timestamp using the timezone offset.
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(result));

    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );

    const representedAsUtc = Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    );

    const difference = target - representedAsUtc;

    result += difference;

    if (difference === 0) break;
  }

  return new Date(result);
};

// Get the start and end of the transaction's local day.
const getDayBoundaries = (date, timezone) => {
  const { year, month, day } = getDateParts(date, timezone);

  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

  const nextYear = nextDay.getUTCFullYear();
  const nextMonth = nextDay.getUTCMonth() + 1;
  const nextDate = nextDay.getUTCDate();

  const startOfDay = zonedDateTimeToUtc(year, month, day, timezone);

  const startOfNextDay = zonedDateTimeToUtc(
    nextYear,
    nextMonth,
    nextDate,
    timezone,
  );

  const dateKey = [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");

  return {
    startOfDay,
    startOfNextDay,
    dateKey,
  };
};

// Validate timezone and fall back to Asia/Kolkata.
const getValidTimezone = (timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    });

    return timezone;
  } catch {
    return "Asia/Kolkata";
  }
};

// Check and maintain the user's daily spending limit notification.

export const checkDailyLimit = async (userId, newTransaction) => {
  if (!mongoose.isValidObjectId(userId)) return;

  if (newTransaction?.type !== "expense") return;

  const transactionDate = new Date(newTransaction.transactionDate);

  if (Number.isNaN(transactionDate.getTime())) return;

  const user = await User.findById(userId).select(
    "timezone preferences.dailyLimitPaise preferences.alertEnabled",
  );

  if (!user) return;

  const timezone = getValidTimezone(user.timezone || "Asia/Kolkata");

  const { startOfDay, startOfNextDay, dateKey } = getDayBoundaries(
    transactionDate,
    timezone,
  );

  const dedupeKey = `daily_limit:${userId}:${dateKey}`;

  const dailyLimit = user.preferences?.dailyLimitPaise;

  // Remove stale alerts when alerts are disabled or the limit is invalid.
  if (
    !user.preferences?.alertEnabled ||
    !Number.isSafeInteger(dailyLimit) ||
    dailyLimit <= 0
  ) {
    await Notification.deleteOne({ userId, dedupeKey });
    return;
  }

  // Recalculate spending from the database.
  // This works even after a transaction has been deleted.
  const dailyExpenses = await Transaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: "expense",
        transactionDate: {
          $gte: startOfDay,
          $lt: startOfNextDay,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: "$amountPaise" },
      },
    },
  ]);

  const totalSpent = dailyExpenses[0]?.totalSpent ?? 0;

  // If spending is within the limit, remove the existing alert.
  if (totalSpent <= dailyLimit) {
    await Notification.deleteOne({ userId, dedupeKey });
    return;
  }

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(transactionDate);

  const title = "Daily Limit Exceeded! 🚨";

  const message = `You spent ₹${(totalSpent / 100).toFixed(2)} on ${formattedDate}, exceeding your daily limit of ₹${(dailyLimit / 100).toFixed(2)} by ₹${((totalSpent - dailyLimit) / 100).toFixed(2)}.`;

  try {
    // Check whether this notification already exists.
    const existingNotification = await Notification.findOne({
      userId,
      dedupeKey,
    }).select("_id title message type isRead");

    if (existingNotification) {
      const contentChanged =
        existingNotification.title !== title ||
        existingNotification.message !== message ||
        existingNotification.type !== "daily_limit";

      const updateFields = {
        title,
        message,
        type: "daily_limit",
      };

      // A materially updated alert must become unread again.
      if (contentChanged) {
        updateFields.isRead = false;
      }

      await Notification.updateOne(
        { _id: existingNotification._id },
        { $set: updateFields },
      );

      return;
    }

    // Create a new unread notification.
    await Notification.create({
      userId,
      dedupeKey,
      title,
      message,
      type: "daily_limit",
      isRead: false,
    });
  } catch (error) {
    // Handle concurrent requests creating the same notification.
    if (error.code === 11000) {
      const existingNotification = await Notification.findOne({
        userId,
        dedupeKey,
      });

      if (!existingNotification) throw error;

      const contentChanged =
        existingNotification.title !== title ||
        existingNotification.message !== message ||
        existingNotification.type !== "daily_limit";

      const updateFields = {
        title,
        message,
        type: "daily_limit",
      };

      if (contentChanged) {
        updateFields.isRead = false;
      }

      await Notification.updateOne(
        { _id: existingNotification._id },
        { $set: updateFields },
      );
    } else {
      throw error;
    }
  }
};

