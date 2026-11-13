import mongoose from "mongoose";

import { User } from "../models/user.models.js";
import { Transaction } from "../models/transaction.model.js";
import {
  getDateParts,
  getValidTimezone,
  zonedDateTimeToUtc,
} from "./alertEngine.js";

export const DAILY_DAYS = 30;
export const MONTHS = 6;

const pad = (n) => String(n).padStart(2, "0");

// Calendar day `offset` days from `today` (UTC arithmetic on a date-only value).
const shiftDay = ({ year, month, day }, offset) => {
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

const shiftMonth = ({ year, month }, offset) => {
  const index = year * 12 + (month - 1) + offset;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

const dayKey = ({ year, month, day }) => `${year}-${pad(month)}-${pad(day)}`;
const monthKey = ({ year, month }) => `${year}-${pad(month)}`;

/**
 * Fill the gaps so every day / month in the range appears, with zeros where
 * nothing was recorded. Pure, so it's easy to test.
 */
export const buildChartSeries = ({ today, dailyRows, monthlyRows, categoryRows }) => {
  const dailyTotals = new Map(dailyRows.map((r) => [r._id, r.totalPaise]));
  const daily = Array.from({ length: DAILY_DAYS }, (_, i) => {
    const date = dayKey(shiftDay(today, i - (DAILY_DAYS - 1)));
    return { date, totalPaise: dailyTotals.get(date) ?? 0 };
  });

  const monthly = Array.from({ length: MONTHS }, (_, i) => {
    const period = monthKey(shiftMonth(today, i - (MONTHS - 1)));
    const find = (type) =>
      monthlyRows.find((r) => r._id.period === period && r._id.type === type)
        ?.totalPaise ?? 0;
    return { period, incomePaise: find("income"), expensePaise: find("expense") };
  });

  const categories = categoryRows
    .map((r) => ({ category: r.label, totalPaise: r.totalPaise }))
    .sort((a, b) => b.totalPaise - a.totalPaise);

  return { today: dayKey(today), daily, categories, monthly };
};

/** Spending and income for the dashboard charts, in the user's timezone. */
export const getChartDataForUser = async (userId) => {
  const user = await User.findById(userId).select("timezone").lean();
  if (!user) return null;

  const timezone = getValidTimezone(user.timezone || "Asia/Kolkata");
  const today = getDateParts(new Date(), timezone);
  const startOf = ({ year, month, day = 1 }) =>
    zonedDateTimeToUtc(year, month, day, timezone);

  const dailyStart = startOf(shiftDay(today, -(DAILY_DAYS - 1)));
  const tomorrowStart = startOf(shiftDay(today, 1));
  const monthStart = startOf({ year: today.year, month: today.month });
  const nextMonthStart = startOf(shiftMonth(today, 1));
  const monthsStart = startOf(shiftMonth(today, -(MONTHS - 1)));
  const objectId = new mongoose.Types.ObjectId(userId);
  const localDate = (format) => ({
    $dateToString: { format, date: "$transactionDate", timezone },
  });

  const [dailyRows, categoryRows, monthlyRows] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          userId: objectId,
          type: "expense",
          transactionDate: { $gte: dailyStart, $lt: tomorrowStart },
        },
      },
      { $group: { _id: localDate("%Y-%m-%d"), totalPaise: { $sum: "$amountPaise" } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          userId: objectId,
          type: "expense",
          transactionDate: { $gte: monthStart, $lt: nextMonthStart },
        },
      },
      // "Food" and "food " count as one category, shown with the first spelling.
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$category" } } },
          label: { $first: { $trim: { input: "$category" } } },
          totalPaise: { $sum: "$amountPaise" },
        },
      },
    ]),
    Transaction.aggregate([
      {
        $match: {
          userId: objectId,
          transactionDate: { $gte: monthsStart, $lt: nextMonthStart },
        },
      },
      {
        $group: {
          _id: { period: localDate("%Y-%m"), type: "$type" },
          totalPaise: { $sum: "$amountPaise" },
        },
      },
    ]),
  ]);

  return buildChartSeries({ today, dailyRows, monthlyRows, categoryRows });
};
