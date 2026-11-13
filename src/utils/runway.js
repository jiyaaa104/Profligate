import mongoose from "mongoose";

import { User } from "../models/user.models.js";
import { Transaction } from "../models/transaction.model.js";
import { Notification } from "../models/notification.model.js";
import {
  getDateParts,
  getValidTimezone,
  zonedDateTimeToUtc,
} from "./alertEngine.js";

const WINDOW_DAYS = 14;
const MIN_HISTORY_DAYS = 7;
const MIN_SPENDING_DAYS = 3;
// A day counts as at most 3x a typical spending day, so a one-off fee payment
// doesn't make the forecast predict the student is about to go broke.
const OUTLIER_MULTIPLIER = 3;
const ALERT_COOLDOWN_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const toDayNumber = ({ year, month, day }) =>
  Date.UTC(year, month - 1, day) / DAY_MS;

const dateKeyToDayNumber = (dateKey) => Date.parse(dateKey) / DAY_MS;

const dayNumberToDateKey = (dayNumber) =>
  new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);

const getMedian = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

// Allowance day in a given month. A "31st" allowance lands on the last day of
// shorter months.
const allowanceDayNumber = (year, month, allowanceDay) => {
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return toDayNumber({
    year,
    month,
    day: Math.min(allowanceDay, lastDayOfMonth),
  });
};

// If today is allowance day and no income is recorded yet, the allowance is
// still on its way, so the next allowance is today rather than next month.
const getNextAllowance = (today, allowanceDay, incomeToday) => {
  const todayNumber = toDayNumber(today);
  const thisMonth = allowanceDayNumber(today.year, today.month, allowanceDay);

  if (thisMonth > todayNumber) return thisMonth;
  if (thisMonth === todayNumber && !incomeToday) return thisMonth;

  return today.month === 12
    ? allowanceDayNumber(today.year + 1, 1, allowanceDay)
    : allowanceDayNumber(today.year, today.month + 1, allowanceDay);
};

// Pure forecast. All dates are calendar days in the user's timezone.
export const calculateRunway = ({
  balancePaise,
  dailyExpenses,
  firstExpenseDate,
  today,
  allowanceDay = null,
  incomeToday = false,
  savingsGoalPaise = 0,
}) => {
  const todayNumber = toDayNumber(today);

  // Only complete days count: today's spending is still in progress.
  const daysOfHistory = firstExpenseDate
    ? Math.max(0, todayNumber - dateKeyToDayNumber(firstExpenseDate))
    : 0;
  const windowDays = Math.min(WINDOW_DAYS, daysOfHistory);
  const windowStart = todayNumber - windowDays;

  const spendingDays = dailyExpenses
    .filter(({ date }) => {
      const dayNumber = dateKeyToDayNumber(date);
      return dayNumber >= windowStart && dayNumber < todayNumber;
    })
    .map(({ totalPaise }) => totalPaise)
    .filter((totalPaise) => totalPaise > 0);

  if (
    daysOfHistory < MIN_HISTORY_DAYS ||
    spendingDays.length < MIN_SPENDING_DAYS
  ) {
    return { status: "insufficient_data" };
  }

  const dayCap = getMedian(spendingDays) * OUTLIER_MULTIPLIER;
  const cappedTotal = spendingDays.reduce(
    (sum, totalPaise) => sum + Math.min(totalPaise, dayCap),
    0,
  );
  const dailyPacePaise = Math.max(1, Math.round(cappedTotal / windowDays));

  // The savings goal is set aside first; only the rest is spendable.
  const availablePaise = Math.max(0, balancePaise);
  const reservedPaise = Math.min(savingsGoalPaise, availablePaise);
  const spendableBalance = availablePaise - reservedPaise;
  const daysLeft = Math.floor(spendableBalance / dailyPacePaise);
  const daysLeftWithoutSavings = Math.floor(availablePaise / dailyPacePaise);

  const runway = {
    status: "ready",
    today: dayNumberToDateKey(todayNumber),
    balancePaise,
    dailyPacePaise,
    windowDays,
    daysLeft,
    runOutDate: dayNumberToDateKey(todayNumber + daysLeft),
    savingsGoalPaise,
    reservedPaise,
    spendablePaise: spendableBalance,
    goalFits: savingsGoalPaise <= availablePaise,
    daysLeftWithoutSavings,
    runOutDateWithoutSavings:
      savingsGoalPaise > 0
        ? dayNumberToDateKey(todayNumber + daysLeftWithoutSavings)
        : null,
    nextAllowanceDate: null,
    daysUntilAllowance: null,
    willRunShort: false,
    daysShort: 0,
    safeDailyPaise: null,
  };

  if (!allowanceDay) return runway;

  const nextAllowance = getNextAllowance(today, allowanceDay, incomeToday);
  const daysUntilAllowance = nextAllowance - todayNumber;

  runway.nextAllowanceDate = dayNumberToDateKey(nextAllowance);
  runway.daysUntilAllowance = daysUntilAllowance;
  runway.willRunShort = daysLeft < daysUntilAllowance;
  runway.daysShort = Math.max(0, daysUntilAllowance - daysLeft);

  if (daysUntilAllowance > 0) {
    runway.safeDailyPaise = Math.floor(spendableBalance / daysUntilAllowance);
  }

  return runway;
};

// Load the user's data and calculate their runway. Returns null if the user
// no longer exists. `purchasePaise` previews the runway as if that amount
// were spent right now ("Can I afford this?"); nothing is saved.
export const getRunwayForUser = async (userId, { purchasePaise = 0 } = {}) => {
  const user = await User.findById(userId)
    .select(
      "openingBalancePaise timezone preferences.allowanceDay preferences.monthlySavingsGoalPaise",
    )
    .lean();

  if (!user) return null;

  const objectId = new mongoose.Types.ObjectId(userId);
  const timezone = getValidTimezone(user.timezone || "Asia/Kolkata");
  const today = getDateParts(new Date(), timezone);
  const todayStart = zonedDateTimeToUtc(
    today.year,
    today.month,
    today.day,
    timezone,
  );

  const windowStartDay = new Date(
    Date.UTC(today.year, today.month - 1, today.day - WINDOW_DAYS),
  );
  const windowStart = zonedDateTimeToUtc(
    windowStartDay.getUTCFullYear(),
    windowStartDay.getUTCMonth() + 1,
    windowStartDay.getUTCDate(),
    timezone,
  );

  const tomorrowDay = new Date(
    Date.UTC(today.year, today.month - 1, today.day + 1),
  );
  const tomorrowStart = zonedDateTimeToUtc(
    tomorrowDay.getUTCFullYear(),
    tomorrowDay.getUTCMonth() + 1,
    tomorrowDay.getUTCDate(),
    timezone,
  );

  const [totals, dailyExpenses, firstExpense, incomeToday] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId: objectId } },
      { $group: { _id: "$type", total: { $sum: "$amountPaise" } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          userId: objectId,
          type: "expense",
          transactionDate: { $gte: windowStart, $lt: todayStart },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$transactionDate",
              timezone,
            },
          },
          totalPaise: { $sum: "$amountPaise" },
        },
      },
    ]),
    Transaction.findOne({ userId: objectId, type: "expense" })
      .sort({ transactionDate: 1 })
      .select("transactionDate")
      .lean(),
    Transaction.exists({
      userId: objectId,
      type: "income",
      transactionDate: { $gte: todayStart, $lt: tomorrowStart },
    }),
  ]);

  const totalFor = (type) => totals.find((t) => t._id === type)?.total ?? 0;

  let firstExpenseDate = null;
  if (firstExpense) {
    const { year, month, day } = getDateParts(
      firstExpense.transactionDate,
      timezone,
    );
    firstExpenseDate = dayNumberToDateKey(toDayNumber({ year, month, day }));
  }

  return calculateRunway({
    balancePaise:
      (user.openingBalancePaise ?? 0) +
      totalFor("income") -
      totalFor("expense") -
      purchasePaise,
    dailyExpenses: dailyExpenses.map(({ _id, totalPaise }) => ({
      date: _id,
      totalPaise,
    })),
    firstExpenseDate,
    today,
    allowanceDay: user.preferences?.allowanceDay ?? null,
    savingsGoalPaise: user.preferences?.monthlySavingsGoalPaise ?? 0,
    incomeToday: Boolean(incomeToday),
  });
};

const formatDay = (dateKey) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(dateKey));

const formatRupees = (paise) =>
  `₹${Math.floor(paise / 100).toLocaleString("en-IN")}`;

export const buildRunwayMessage = (runway) => {
  const dayLabel = runway.daysShort === 1 ? "day" : "days";
  const goal = formatRupees(runway.savingsGoalPaise);

  if (runway.balancePaise <= 0) {
    return `Your recorded balance has run out, ${runway.daysShort} ${dayLabel} before your next allowance.`;
  }

  if (runway.savingsGoalPaise > 0 && runway.spendablePaise <= 0) {
    return `Your balance of ${formatRupees(runway.balancePaise)} doesn't cover your ${goal} savings goal, so anything you spend before your next allowance comes out of your savings.`;
  }

  const savingNote =
    runway.savingsGoalPaise > 0 ? ` while keeping ${goal} aside for savings` : "";
  const opening = `At this pace your money lasts until ${formatDay(runway.runOutDate)}${savingNote}, ${runway.daysShort} ${dayLabel} short of your next allowance.`;

  return runway.safeDailyPaise >= 100
    ? `${opening} Keep spending under ${formatRupees(runway.safeDailyPaise)} a day to make it.`
    : opening;
};

// Warn the user when their money won't reach the next allowance, at most once
// every few days.
export const checkRunwayAlert = async (userId) => {
  const user = await User.findById(userId)
    .select("preferences.alertEnabled")
    .lean();

  if (!user?.preferences?.alertEnabled) return;

  const runway = await getRunwayForUser(userId);

  if (runway?.status !== "ready" || !runway.willRunShort) return;

  const recentAlert = await Notification.exists({
    userId,
    type: "runway_alert",
    createdAt: { $gte: new Date(Date.now() - ALERT_COOLDOWN_DAYS * DAY_MS) },
  });

  if (recentAlert) return;

  try {
    await Notification.create({
      userId,
      dedupeKey: `runway_alert:${userId}:${runway.today}`,
      title: "Your money may run out early",
      message: buildRunwayMessage(runway),
      type: "runway_alert",
      isRead: false,
    });
  } catch (error) {
    // A concurrent request already created today's alert.
    if (error.code !== 11000) throw error;
  }
};
