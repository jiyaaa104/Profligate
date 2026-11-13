import mongoose from "mongoose";

import { FixedCost } from "../models/fixedCost.model.js";
import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  checkDailyLimit,
  getDateParts,
  getValidTimezone,
} from "../utils/alertEngine.js";
import {
  checkRunwayAlert,
  getNextUnpaidOccurrence,
  toBillInput,
} from "../utils/runway.js";

const MAX_BILLS_PER_USER = 20;
const MAX_AMOUNT_PAISE = 10_000_000_000; // ₹10 crore
const PAYMENT_METHODS = ["cash", "card", "upi", "netbanking", "other"];

const getUserToday = async (userId) => {
  const user = await User.findById(userId).select("timezone").lean();
  const timezone = getValidTimezone(user?.timezone || "Asia/Kolkata");
  return { timezone, today: getDateParts(new Date(), timezone) };
};

// Add the next payment date so the UI can show "Due 1 Dec" / "Overdue".
const withNextDue = (bill, today, timezone) => ({
  _id: bill._id,
  name: bill.name,
  amountPaise: bill.amountPaise,
  dueDay: bill.dueDay,
  category: bill.category,
  lastPaidPeriod: bill.lastPaidPeriod,
  nextDue: getNextUnpaidOccurrence(toBillInput(bill, timezone), today),
});

// Validate the fields a bill can be created or updated with.
const parseBillFields = (body, { partial }) => {
  const fields = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (has("name") || !partial) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw new ApiError(400, "Bill name is required.");
    }
    if (body.name.trim().length > 60) {
      throw new ApiError(400, "Bill name cannot exceed 60 characters.");
    }
    fields.name = body.name.trim();
  }

  if (has("amountPaise") || !partial) {
    if (
      !Number.isSafeInteger(body.amountPaise) ||
      body.amountPaise < 1 ||
      body.amountPaise > MAX_AMOUNT_PAISE
    ) {
      throw new ApiError(400, "Amount must be a positive whole number of paise.");
    }
    fields.amountPaise = body.amountPaise;
  }

  if (has("dueDay") || !partial) {
    if (!Number.isInteger(body.dueDay) || body.dueDay < 1 || body.dueDay > 31) {
      throw new ApiError(400, "Due day must be a whole number between 1 and 31.");
    }
    fields.dueDay = body.dueDay;
  }

  if (has("category")) {
    if (typeof body.category !== "string" || !body.category.trim()) {
      throw new ApiError(400, "Category must be a non-empty string.");
    }
    fields.category = body.category.trim();
  }

  return fields;
};

const assertValidId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid bill ID.");
  }
};

/** GET /api/v1/fixed-costs */
const getFixedCosts = asyncHandler(async (req, res) => {
  const [{ today, timezone }, bills] = await Promise.all([
    getUserToday(req.user._id),
    FixedCost.find({ userId: req.user._id }).sort({ dueDay: 1, createdAt: 1 }).lean(),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      bills.map((bill) => withNextDue(bill, today, timezone)),
      "Bills fetched successfully.",
    ),
  );
});

/** POST /api/v1/fixed-costs */
const createFixedCost = asyncHandler(async (req, res) => {
  const fields = parseBillFields(req.body ?? {}, { partial: false });

  const count = await FixedCost.countDocuments({ userId: req.user._id });
  if (count >= MAX_BILLS_PER_USER) {
    throw new ApiError(400, `You can add up to ${MAX_BILLS_PER_USER} bills.`);
  }

  const bill = await FixedCost.create({ ...fields, userId: req.user._id });
  const { today, timezone } = await getUserToday(req.user._id);

  return res
    .status(201)
    .json(new ApiResponse(201, withNextDue(bill.toObject(), today, timezone), "Bill added."));
});

/** PATCH /api/v1/fixed-costs/:id */
const updateFixedCost = asyncHandler(async (req, res) => {
  assertValidId(req.params.id);
  const fields = parseBillFields(req.body ?? {}, { partial: true });

  if (Object.keys(fields).length === 0) {
    throw new ApiError(400, "Provide at least one field to update.");
  }

  const bill = await FixedCost.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: fields },
    { returnDocument: "after", runValidators: true },
  ).lean();

  if (!bill) throw new ApiError(404, "Bill not found.");

  const { today, timezone } = await getUserToday(req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, withNextDue(bill, today, timezone), "Bill updated."));
});

/** DELETE /api/v1/fixed-costs/:id — expenses already recorded are kept. */
const deleteFixedCost = asyncHandler(async (req, res) => {
  assertValidId(req.params.id);

  const bill = await FixedCost.findOneAndDelete({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!bill) throw new ApiError(404, "Bill not found.");

  return res.status(200).json(new ApiResponse(200, {}, "Bill deleted."));
});

/**
 * POST /api/v1/fixed-costs/:id/pay
 * Records the bill's next unpaid payment as an expense and marks that month
 * as paid.
 */
const payFixedCost = asyncHandler(async (req, res) => {
  assertValidId(req.params.id);

  const paymentMethod = req.body?.paymentMethod ?? "upi";
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new ApiError(400, "Invalid payment method.");
  }

  const bill = await FixedCost.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!bill) throw new ApiError(404, "Bill not found.");

  const { today, timezone } = await getUserToday(req.user._id);
  const next = getNextUnpaidOccurrence(toBillInput(bill, timezone), today);
  if (!next) throw new ApiError(400, "This bill has no unpaid payments.");

  const transaction = await Transaction.create({
    userId: req.user._id,
    amountPaise: bill.amountPaise,
    type: "expense",
    category: bill.category || "Other",
    description: `${bill.name} (bill)`.slice(0, 200),
    paymentMethod,
    fixedCostId: bill._id,
  });

  // Only mark it paid if nobody paid the same month at the same moment.
  const updated = await FixedCost.findOneAndUpdate(
    { _id: bill._id, lastPaidPeriod: bill.lastPaidPeriod },
    {
      $set: {
        lastPaidPeriod: next.period,
        previousPaidPeriod: bill.lastPaidPeriod,
        lastPaidTransactionId: transaction._id,
      },
    },
    { returnDocument: "after" },
  ).lean();

  if (!updated) {
    await Transaction.deleteOne({ _id: transaction._id });
    throw new ApiError(409, "This bill was just updated. Please refresh and try again.");
  }

  // Alerts must never block the payment itself.
  try {
    await checkDailyLimit(req.user._id, transaction);
  } catch (error) {
    console.error("Daily limit alert error:", error);
  }
  try {
    await checkRunwayAlert(req.user._id);
  } catch (error) {
    console.error("Runway alert error:", error);
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      { bill: withNextDue(updated, today, timezone), transaction },
      `${bill.name} marked as paid.`,
    ),
  );
});

export {
  getFixedCosts,
  createFixedCost,
  updateFixedCost,
  deleteFixedCost,
  payFixedCost,
};
